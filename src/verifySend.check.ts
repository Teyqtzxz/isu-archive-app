// Examples for verifySend.ts (Create account, then the verification email; errata #84).
// Run with:
//   node src/verifySend.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// Fake data only: no Firebase, no email.
import { createAccountThenVerify, createSendFailureBox } from "./verifySend.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}

const sendErr = { code: "auth/invalid-continue-uri" };
const createErr = { code: "auth/email-already-in-use" };

/** A fake run: which steps happened, what was logged, what the screen heard. */
async function run(opts: { createFails?: boolean; nameFails?: boolean; sendFails?: boolean; subscribeFirst?: boolean }) {
  const box = createSendFailureBox();
  const steps: string[] = [];
  const warned: string[] = [];
  const heard: unknown[] = [];
  if (opts.subscribeFirst) box.subscribe(e => heard.push(e)); // screen already open
  let thrown: unknown = null, user: unknown = null;
  try {
    user = await createAccountThenVerify({
      create: async () => { steps.push("create"); if (opts.createFails) throw createErr; return { uid: "u1" }; },
      setName: async () => { steps.push("name"); if (opts.nameFails) throw new Error("name"); },
      sendVerification: async () => { steps.push("send"); if (opts.sendFails) throw sendErr; },
      box,
      warn: what => warned.push(what),
    });
  } catch (e) { thrown = e; }
  if (!opts.subscribeFirst) box.subscribe(e => heard.push(e)); // screen opened after
  return { steps, warned, heard, thrown, user, box };
}

// All good.
{
  const r = await run({});
  check("ok: create, name, send in that order", r.steps, ["create", "name", "send"]);
  check("ok: the account is returned", r.user, { uid: "u1" });
  check("ok: nothing thrown", r.thrown, null);
  check("ok: the screen hears nothing", r.heard, []);
  check("ok: nothing logged", r.warned, []);
}

// The email cannot be sent: the account still exists, no throw, the screen is told.
{
  const r = await run({ sendFails: true, subscribeFirst: true });
  check("send fails, screen open first: account created", r.user, { uid: "u1" });
  check("send fails, screen open first: not thrown (still lands on the inbox screen)", r.thrown, null);
  check("send fails, screen open first: the screen hears the error", r.heard, [sendErr]);
  check("send fails: logged", r.warned, ["could not send the verification email"]);
}
{
  const r = await run({ sendFails: true, subscribeFirst: false });
  check("send fails, screen opens after: the screen still hears it", r.heard, [sendErr]);
  check("send fails, screen opens after: not thrown", r.thrown, null);
}

// The name fails: only logged; the email is still sent; the screen hears nothing.
{
  const r = await run({ nameFails: true });
  check("name fails: email still sent", r.steps, ["create", "name", "send"]);
  check("name fails: not thrown", r.thrown, null);
  check("name fails: only logged", r.warned, ["could not save the name"]);
  check("name fails: the screen hears nothing", r.heard, []);
}

// Create fails: thrown to the form, nothing else runs, the screen hears nothing.
{
  const r = await run({ createFails: true, subscribeFirst: true });
  check("create fails: thrown to the form", r.thrown, createErr);
  check("create fails: no name, no email", r.steps, ["create"]);
  check("create fails: the screen hears nothing", r.heard, []);
}

// The box itself.
{
  const box = createSendFailureBox();
  const a: unknown[] = [];
  const stop = box.subscribe(e => a.push(e));
  box.report("e1");
  check("box: a listener hears a report", a, ["e1"]);
  stop();
  box.report("e2");
  check("box: not heard after unsubscribe", a, ["e1"]);
  box.clear();
  const b: unknown[] = [];
  box.subscribe(e => b.push(e));
  check("box: cleared (Resend sent, sign-out) means nothing waits", b, []);
}
{
  // A new Create account clears an older failure before it starts.
  const box = createSendFailureBox();
  box.report("old");
  await createAccountThenVerify({
    create: async () => ({}), setName: async () => {}, sendVerification: async () => {}, box, warn: () => {},
  });
  const c: unknown[] = [];
  box.subscribe(e => c.push(e));
  check("box: a new account clears the old failure", c, []);
}

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
