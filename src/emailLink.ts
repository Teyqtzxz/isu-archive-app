// Forgot password by email sign-in link (errata #85). Pure: Firebase and the
// browser's storage are passed in by data.ts, so emailLink.check.ts can run
// every step on fake data.
//
// Why a sign-in link: Google does not let this project change the action URL
// of its emails, so a reset email always opens Firebase's own plain page. An
// email SIGN-IN link must always be finished in the app, so it opens our
// "Create a new password" page. The free plan sends only a few of these a day
// for the whole project, so on any send error but a typing or connection
// problem the old reset email is sent instead (docs/17 §9).

// ─── Which email link opened the app ─────────────────────────────────────────

export type EmailAction =
  /** Old reset email (also the fallback). */
  | { kind: "reset"; mode: "resetPassword"; oobCode: string }
  /** The Create account verification email. */
  | { kind: "verify"; mode: "verifyEmail"; oobCode: string }
  /** Forgot password's sign-in link. `href` is the full link, kept for Firebase. */
  | { kind: "sign-in"; href: string }
  /** A mode this app does not handle: "Link not recognised", as before. */
  | { kind: "other"; mode: string; oobCode: string };

/** The link's own mode and code, or the same inside a `link=` parameter. */
function modeAndCode(params: URLSearchParams): { mode: string; oobCode: string } | null {
  const mode = params.get("mode"), oobCode = params.get("oobCode");
  if (mode && oobCode) return { mode, oobCode };
  const inner = params.get("link");
  if (!inner) return null;
  try {
    const p = new URL(inner).searchParams;
    const m = p.get("mode"), c = p.get("oobCode");
    return m === "signIn" && c ? { mode: m, oobCode: c } : null;
  } catch {
    return null;
  }
}

/** Decides what the address bar holds: one of the three links, another mode, or nothing. */
export function parseEmailAction(href: string): EmailAction | null {
  let params: URLSearchParams;
  try {
    params = new URL(href).searchParams;
  } catch {
    return null;
  }
  const found = modeAndCode(params);
  if (!found) return null;
  const { mode, oobCode } = found;
  if (mode === "resetPassword") return { kind: "reset", mode, oobCode };
  if (mode === "verifyEmail") return { kind: "verify", mode, oobCode };
  if (mode === "signIn") return { kind: "sign-in", href };
  return { kind: "other", mode, oobCode };
}

/** "[email-link] mode=signIn params=apiKey,lang,mode,oobCode": parameter NAMES
 *  only, never a value, so the line can be read out safely (docs/17 §9). */
export function describeLinkForLog(href: string): string {
  try {
    const params = new URL(href).searchParams;
    const names = [...new Set([...params.keys()])].sort();
    const mode = (params.get("mode") ?? "").replace(/[^A-Za-z]/g, "").slice(0, 20) || "none";
    return `[email-link] mode=${mode} params=${names.join(",")}`;
  } catch {
    return "[email-link] mode=none params=";
  }
}

// ─── Sending ─────────────────────────────────────────────────────────────────

/** The only send errors shown to the user; every other one sends the reset
 *  email instead (the real daily-limit code is unknown). */
const SHOW_NOT_FALL_BACK = new Set(["auth/network-request-failed", "auth/invalid-email", "auth/missing-email"]);

export function errorCode(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : "";
  return typeof code === "string" ? code : "";
}

export function shouldFallBack(e: unknown): boolean {
  return !SHOW_NOT_FALL_BACK.has(errorCode(e));
}

/** Sign-in link first; the old reset email on any error but the three above. */
export async function sendResetLink(email: string, steps: {
  sendLink: (email: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  /** Only after the link is sent: the link page reads it back. */
  remember: (email: string) => void;
  forget: () => void;
  warn: (what: string, code: string) => void;
}): Promise<"link" | "reset"> {
  try {
    await steps.sendLink(email);
    steps.remember(email);
    return "link";
  } catch (e) {
    if (!shouldFallBack(e)) throw e;
    steps.warn("sign-in link not sent, sending the reset email instead", errorCode(e) || "not an auth error");
    steps.forget();
    await steps.sendReset(email);
    return "reset";
  }
}

// ─── The email kept for the link (Firebase's advice) ─────────────────────────

export const STORED_EMAIL_KEY = "isu.resetLinkEmail";
/** Older than this is ignored: the link has long expired. */
export const STORED_EMAIL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type KeyStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function rememberEmail(store: KeyStore | null, email: string, now: number): void {
  try {
    store?.setItem(STORED_EMAIL_KEY, JSON.stringify({ email, at: now }));
  } catch { /* storage blocked: the link page asks for the username instead */ }
}

export function readEmail(store: KeyStore | null, now: number): string | null {
  try {
    const raw = store?.getItem(STORED_EMAIL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { email?: unknown; at?: unknown };
    if (typeof v.email !== "string" || !v.email.includes("@") || typeof v.at !== "number") return null;
    if (now - v.at > STORED_EMAIL_MAX_AGE_MS || now < v.at) return null;
    return v.email;
  } catch {
    return null;
  }
}

export function forgetEmail(store: KeyStore | null): void {
  try {
    store?.removeItem(STORED_EMAIL_KEY);
  } catch { /* nothing to do */ }
}

// ─── Opening the link and saving the new password ────────────────────────────

/**
 * - saved: password set, session ended.
 * - unusable: expired, used, wrong email, no account (that account was deleted
 *   again), or Firebase refused; ONE message for all, so nothing tells a
 *   stranger whether an email has an account. Session ended.
 * - signed-in: an account is signed in on this browser; nothing was done.
 */
export type SaveResult = { kind: "saved" } | { kind: "unusable" } | { kind: "signed-in"; email: string };

export type LinkResetSteps<U> = {
  /** The email of whoever is signed in on this browser now, or null. */
  signedInEmail: () => string | null;
  /** Keep the coming session in this tab's memory only (no other tab sees it,
   *  closing the tab ends it). */
  useMemorySession: () => Promise<void>;
  /** signInWithEmailLink; isNew from getAdditionalUserInfo. */
  signIn: (email: string) => Promise<{ user: U; isNew: boolean }>;
  deleteUser: (user: U) => Promise<void>;
  setPassword: (user: U, password: string) => Promise<void>;
  /** Sign out and switch back to the normal saved session. Never throws. */
  endSession: () => Promise<void>;
  forgetEmail: () => void;
  warn: (what: string, code: string) => void;
};

export type LinkReset = {
  /** Signs in with the link (once), then sets the password. Throws only what
   *  the form shows and can retry: a lost connection or a weak password. */
  save: (email: string, password: string) => Promise<SaveResult>;
  /** Leaving early: ends a session this flow started; never touches another. */
  leave: () => Promise<void>;
};

const isNetwork = (e: unknown) => errorCode(e) === "auth/network-request-failed";
const isWeak = (e: unknown) => {
  const c = errorCode(e);
  return c === "auth/weak-password" || c === "auth/password-does-not-meet-requirements";
};

/**
 * One per link. The link is used at Save, not when the page opens, so a
 * reload on the form does not burn it. A second Save while one runs gets the
 * same promise (a link works once: a second sign-in would report a good link
 * as used); after the end every Save returns the same result and calls nothing.
 */
export function createLinkReset<U>(steps: LinkResetSteps<U>): LinkReset {
  let user: U | null = null;
  let started = false;
  let finished: SaveResult | null = null;
  let running: Promise<SaveResult> | null = null;

  async function end(result: SaveResult): Promise<SaveResult> {
    user = null;
    finished = result;
    steps.forgetEmail();
    await steps.endSession();
    started = false;
    return result;
  }

  async function run(email: string, password: string): Promise<SaveResult> {
    if (user === null) {
      const other = steps.signedInEmail();
      if (other !== null) return { kind: "signed-in", email: other };
      started = true;
      let signed: { user: U; isNew: boolean };
      try {
        await steps.useMemorySession();
        signed = await steps.signIn(email);
      } catch (e) {
        if (isNetwork(e)) throw e;
        steps.warn("sign-in link refused", errorCode(e) || "not an auth error");
        return end({ kind: "unusable" });
      }
      if (signed.isNew) {
        // No account had this email: Firebase just made one. Forgot password
        // must never create an account (it would skip Create account).
        try {
          await steps.deleteUser(signed.user);
        } catch (first) {
          steps.warn("could not delete the new account, trying again", errorCode(first) || "not an auth error");
          await steps.deleteUser(signed.user).catch((e: unknown) =>
            steps.warn("could not delete the new account", errorCode(e) || "not an auth error"));
        }
        return end({ kind: "unusable" });
      }
      user = signed.user;
    }
    try {
      await steps.setPassword(user, password);
    } catch (e) {
      if (isNetwork(e) || isWeak(e)) throw e; // the form says why; Save again
      steps.warn("could not set the password", errorCode(e) || "not an auth error");
      if (errorCode(e)) return end({ kind: "unusable" }); // e.g. requires-recent-login
      throw e;
    }
    return end({ kind: "saved" });
  }

  return {
    save(email, password) {
      if (finished) return Promise.resolve(finished);
      if (!running) running = run(email, password).finally(() => { running = null; });
      return running;
    },
    async leave() {
      if (running) await running.catch(() => undefined);
      if (started && !finished) await end({ kind: "unusable" });
    },
  };
}
