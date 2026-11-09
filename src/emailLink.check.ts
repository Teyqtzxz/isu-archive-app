// Examples for emailLink.ts (Forgot password by email sign-in link; errata #85).
// Run with:
//   node src/emailLink.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// Fake data only: no Firebase, no email. The codes below are made up.
import {
  STORED_EMAIL_KEY, STORED_EMAIL_MAX_AGE_MS, createLinkReset, describeLinkForLog, forgetEmail,
  parseEmailAction, readEmail, rememberEmail, sendResetLink, shouldFallBack, type KeyStore,
} from "./emailLink.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

const site = "https://example.test/";

// ─── parseEmailAction ────────────────────────────────────────────────────────
check("reset link", parseEmailAction(`${site}?mode=resetPassword&oobCode=FAKE1&apiKey=K&lang=en`),
  { kind: "reset", mode: "resetPassword", oobCode: "FAKE1" });
check("verify link", parseEmailAction(`${site}?mode=verifyEmail&oobCode=FAKE2`),
  { kind: "verify", mode: "verifyEmail", oobCode: "FAKE2" });
const signInHref = `${site}?apiKey=K&oobCode=FAKE3&mode=signIn&lang=en`;
check("sign-in link keeps the full href", parseEmailAction(signInHref), { kind: "sign-in", href: signInHref });
check("sign-in without a code is nothing", parseEmailAction(`${site}?mode=signIn`), null);
check("code without a mode is nothing", parseEmailAction(`${site}?oobCode=FAKE`), null);
check("mode in the wrong case is not a sign-in link", parseEmailAction(`${site}?mode=SIGNIN&oobCode=FAKE`),
  { kind: "other", mode: "SIGNIN", oobCode: "FAKE" });
check("unknown mode → other (Link not recognised)", parseEmailAction(`${site}?mode=recoverEmail&oobCode=FAKE`),
  { kind: "other", mode: "recoverEmail", oobCode: "FAKE" });
const nested = `${site}?link=${encodeURIComponent("https://x.test/__/auth/action?mode=signIn&oobCode=FAKE4")}`;
check("sign-in link inside link=", parseEmailAction(nested), { kind: "sign-in", href: nested });
const nestedReset = `${site}?link=${encodeURIComponent("https://x.test/?mode=resetPassword&oobCode=FAKE")}`;
check("only a sign-in link is taken from link=", parseEmailAction(nestedReset), null);
check("broken link= is nothing", parseEmailAction(`${site}?link=not%20a%20url`), null);
check("plain page is nothing", parseEmailAction(site), null);
check("not a URL is nothing", parseEmailAction("::"), null);

// ─── describeLinkForLog: names only, never values ────────────────────────────
check("log line has names, not the code or key",
  describeLinkForLog(`${site}?oobCode=SECRETCODE&apiKey=SECRETKEY&mode=signIn&lang=en`),
  "[email-link] mode=signIn params=apiKey,lang,mode,oobCode");
check("log line never repeats a strange mode as typed",
  describeLinkForLog(`${site}?mode=<b>x</b>&oobCode=S`), "[email-link] mode=bxb params=mode,oobCode");
check("log line with no mode", describeLinkForLog(site), "[email-link] mode=none params=");

// ─── shouldFallBack ──────────────────────────────────────────────────────────
check("network error is shown", shouldFallBack({ code: "auth/network-request-failed" }), false);
check("invalid email is shown", shouldFallBack({ code: "auth/invalid-email" }), false);
check("missing email is shown", shouldFallBack({ code: "auth/missing-email" }), false);
for (const code of ["auth/quota-exceeded", "auth/operation-not-allowed", "auth/too-many-requests",
  "auth/unauthorized-continue-uri", "auth/internal-error", "auth/some-new-code"]) {
  check(`${code} falls back`, shouldFallBack({ code }), true);
}
check("an error without a code falls back", shouldFallBack(new Error("x")), true);

// ─── sendResetLink ───────────────────────────────────────────────────────────
async function send(linkErr: unknown, resetErr?: unknown) {
  const steps: string[] = [];
  let result: unknown = null, thrown: unknown = null;
  try {
    result = await sendResetLink("a@isu.edu.ph", {
      sendLink: async () => { steps.push("link"); if (linkErr) throw linkErr; },
      sendReset: async () => { steps.push("reset"); if (resetErr) throw resetErr; },
      remember: e => steps.push(`remember ${e}`),
      forget: () => steps.push("forget"),
      warn: (_w, code) => steps.push(`warn ${code}`),
    });
  } catch (e) { thrown = e; }
  return { steps, result, thrown };
}
check("link sent → email remembered", await send(null),
  { steps: ["link", "remember a@isu.edu.ph"], result: "link", thrown: null });
check("daily limit (unknown code) → reset email", await send({ code: "auth/quota-exceeded" }),
  { steps: ["link", "warn auth/quota-exceeded", "forget", "reset"], result: "reset", thrown: null });
check("email link turned off → reset email", await send({ code: "auth/operation-not-allowed" }),
  { steps: ["link", "warn auth/operation-not-allowed", "forget", "reset"], result: "reset", thrown: null });
check("no connection → shown, no reset", await send({ code: "auth/network-request-failed" }),
  { steps: ["link"], result: null, thrown: { code: "auth/network-request-failed" } });
check("both fail → the reset error is shown", await send({ code: "auth/quota-exceeded" }, { code: "auth/too-many-requests" }),
  { steps: ["link", "warn auth/quota-exceeded", "forget", "reset"], result: null, thrown: { code: "auth/too-many-requests" } });

// ─── stored email ────────────────────────────────────────────────────────────
function memoryStore(): KeyStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
}
const throwing: KeyStore = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};
const store = memoryStore();
rememberEmail(store, "a@isu.edu.ph", 1000);
check("round trip", readEmail(store, 2000), "a@isu.edu.ph");
check("older than 24 h → ignored", readEmail(store, 1000 + STORED_EMAIL_MAX_AGE_MS + 1), null);
check("from the future (clock changed) → ignored", readEmail(store, 10), null);
forgetEmail(store);
check("forgotten", readEmail(store, 2000), null);
store.data.set(STORED_EMAIL_KEY, "{not json");
check("broken JSON → null", readEmail(store, 2000), null);
store.data.set(STORED_EMAIL_KEY, JSON.stringify({ email: 5, at: 1 }));
check("wrong shape → null", readEmail(store, 2000), null);
check("storage that throws: read is null", readEmail(throwing, 1), null);
rememberEmail(throwing, "a@isu.edu.ph", 1);
forgetEmail(throwing);
check("storage that throws: write and forget do not throw", true, true);
check("no storage at all", readEmail(null, 1), null);

// ─── createLinkReset ─────────────────────────────────────────────────────────
type FakeUser = { uid: string };
function flow(opts: {
  signedIn?: string | null;
  signInErr?: unknown;
  isNew?: boolean;
  deleteFails?: number;
  passwordErrs?: unknown[];
} = {}) {
  const calls: string[] = [];
  let signedIn = opts.signedIn ?? null;
  let deleteFails = opts.deleteFails ?? 0;
  const passwordErrs = [...(opts.passwordErrs ?? [])];
  const reset = createLinkReset<FakeUser>({
    signedInEmail: () => signedIn,
    useMemorySession: async () => { calls.push("memory"); },
    signIn: async email => {
      calls.push(`signIn ${email}`);
      await Promise.resolve();
      if (opts.signInErr) throw opts.signInErr;
      return { user: { uid: opts.isNew ? "new" : "u1" }, isNew: !!opts.isNew };
    },
    deleteUser: async u => { calls.push(`delete ${u.uid}`); if (deleteFails-- > 0) throw { code: "auth/network-request-failed" }; },
    setPassword: async u => { calls.push(`password ${u.uid}`); const e = passwordErrs.shift(); if (e) throw e; },
    endSession: async () => { calls.push("end"); },
    forgetEmail: () => calls.push("forget"),
    warn: (_w, code) => calls.push(`warn ${code}`),
  });
  return { reset, calls, signOutOther: () => { signedIn = null; } };
}
async function attempt(r: { save: (e: string, p: string) => Promise<unknown> }) {
  try { return await r.save("a@isu.edu.ph", "Pw1!good"); } catch (e) { return { thrown: e }; }
}

{
  const f = flow();
  check("existing account → saved", await attempt(f.reset), { kind: "saved" });
  check("… steps: memory, sign in, password on the returned user, forget, end", f.calls,
    ["memory", "signIn a@isu.edu.ph", "password u1", "forget", "end"]);
  check("… Save again calls nothing", [await attempt(f.reset), f.calls.length], [{ kind: "saved" }, 5]);
}
{
  const f = flow();
  const [a, b] = await Promise.all([attempt(f.reset), attempt(f.reset)]);
  check("double Save (StrictMode, fast clicks) signs in once", [a, b, f.calls.filter(c => c.startsWith("signIn")).length],
    [{ kind: "saved" }, { kind: "saved" }, 1]);
}
{
  const f = flow({ isNew: true });
  check("no account → unusable", await attempt(f.reset), { kind: "unusable" });
  check("… the new account is deleted, no password set", f.calls, ["memory", "signIn a@isu.edu.ph", "delete new", "forget", "end"]);
}
{
  const f = flow({ isNew: true, deleteFails: 1 });
  await attempt(f.reset);
  check("delete fails once → tried again", f.calls,
    ["memory", "signIn a@isu.edu.ph", "delete new", "warn auth/network-request-failed", "delete new", "forget", "end"]);
}
{
  const f = flow({ isNew: true, deleteFails: 2 });
  check("delete fails twice → still unusable", await attempt(f.reset), { kind: "unusable" });
  check("… and still signed out", f.calls.slice(-2), ["forget", "end"]);
}
{
  const f = flow({ signedIn: "staff@isu.edu.ph" });
  check("someone signed in → nothing done", await attempt(f.reset), { kind: "signed-in", email: "staff@isu.edu.ph" });
  check("… no sign-in, no password, no sign out", f.calls, []);
  await f.reset.leave();
  check("… leaving keeps that account signed in", f.calls, []);
  f.signOutOther();
  check("… after signing that one out, Save works", await attempt(f.reset), { kind: "saved" });
}
for (const code of ["auth/invalid-action-code", "auth/expired-action-code", "auth/invalid-email", "auth/user-disabled", "auth/operation-not-allowed"]) {
  const f = flow({ signInErr: { code } });
  check(`${code} at sign-in → the one safe result`, [await attempt(f.reset), f.calls.slice(-2)], [{ kind: "unusable" }, ["forget", "end"]]);
}
{
  const f = flow({ signInErr: { code: "auth/network-request-failed" } });
  check("no connection at sign-in → shown, can retry", await attempt(f.reset), { thrown: { code: "auth/network-request-failed" } });
  check("… session not ended yet", f.calls.includes("end"), false);
  await f.reset.leave();
  check("… leaving ends it", f.calls.slice(-2), ["forget", "end"]);
}
{
  const f = flow({ passwordErrs: [{ code: "auth/weak-password" }] });
  check("weak password → shown", await attempt(f.reset), { thrown: { code: "auth/weak-password" } });
  check("… Save again: no second sign-in", [await attempt(f.reset), f.calls],
    [{ kind: "saved" }, ["memory", "signIn a@isu.edu.ph", "password u1", "password u1", "forget", "end"]]);
}
{
  const f = flow({ passwordErrs: [{ code: "auth/network-request-failed" }] });
  check("no connection at save → shown", await attempt(f.reset), { thrown: { code: "auth/network-request-failed" } });
  check("… retry saves", await attempt(f.reset), { kind: "saved" });
}
{
  const f = flow({ passwordErrs: [{ code: "auth/requires-recent-login" }] });
  check("requires-recent-login → unusable, signed out", [await attempt(f.reset), f.calls.slice(-2)], [{ kind: "unusable" }, ["forget", "end"]]);
}
{
  const f = flow();
  await f.reset.leave();
  check("leaving before Save: nothing to end", f.calls, []);
}

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
