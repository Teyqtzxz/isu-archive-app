import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  applyVerifyLink, checkResetLink, isFirebaseSignInLink, linkEmailOnThisBrowser, linkReset, setNewPassword,
  signOutUser, signedInEmailWhenReady,
} from "../data";
import { AUTH_MSG, authErrorCode, checkConfirm, checkEmail, checkNewPassword, maskEmail, messageFor } from "../auth";
import { ResetSteps, StateBadge, type BadgeKind } from "./ForgotPassword";
import { ButtonSpinner, ISUSeal, Icon, IsuEmailInput, PasswordChecklist, PasswordInput } from "./shared";
import { ThemeToggle } from "./ThemeToggle";

/** Where the user goes when they leave this screen. */
export type AuthActionExit = "sign-in" | "forgot";

type View =
  | { kind: "checking" }
  | { kind: "reset-form"; email: string }
  | { kind: "reset-done" }
  | { kind: "verified" }
  | { kind: "bad-link"; reset: boolean }
  | { kind: "unsupported" }
  /** Sign-in link (errata #85) opened where Forgot password was not asked. */
  | { kind: "ask-email" }
  /** Sign-in link while an account is signed in here: nothing is done until it signs out. */
  | { kind: "signed-in"; email: string }
  /** Sign-in link: expired, used, wrong email or no account — one text for all. */
  | { kind: "link-unusable" }
  /** Email/Password sign-in is switched off in the Firebase console. */
  | { kind: "disabled" };

/** Expired, already used, cut short when copied, or for a deleted account —
 *  anything but a lost connection. Logs the code only, never the link. */
function isBadLink(e: unknown): boolean {
  const code = authErrorCode(e);
  console.warn("[email-link]", code || "not an auth error");
  return code !== "" && code !== "auth/network-request-failed";
}

/** Firebase still emails reset links while Email/Password is off, then refuses them. */
const isDisabled = (e: unknown) => authErrorCode(e) === "auth/operation-not-allowed";

/**
 * Opened from a link in a Firebase email (?mode=…&oobCode=…), once the
 * console's action URL points here instead of Firebase's plain page (docs/17 §6):
 * - resetPassword → "Create a new password" (step ③ of Forgot password)
 * - verifyEmail   → confirms the address from the Create account email
 * - signInHref    → Forgot password's email sign-in link (errata #85): the
 *   same "Create a new password" form. The link is used only when Save is
 *   pressed (data.ts linkReset), so a reload on the form does not burn it.
 *   App.tsx holds its routing meanwhile and ends the session on leaving.
 */
export function AuthActionScreen({ mode, oobCode, signInHref, onExit }: {
  mode: string;
  oobCode: string;
  signInHref?: string;
  onExit: (to: AuthActionExit) => void;
}) {
  const [view, setView] = useState<View>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typedEmail, setTypedEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  // A link works once. React's dev StrictMode runs effects twice, and the
  // second applyActionCode would report a good link as "already used".
  const started = useRef(false);
  // Set at once, so a fast double click never saves twice.
  const inFlight = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (signInHref !== undefined) {
      openSignInLink(signInHref).catch(() => setView({ kind: "unsupported" }));
    } else if (mode === "resetPassword") {
      checkResetLink(oobCode)
        .then(email => setView({ kind: "reset-form", email }))
        .catch(e => setView(isDisabled(e) ? { kind: "disabled" } : isBadLink(e) ? { kind: "bad-link", reset: true } : { kind: "unsupported" }));
    } else if (mode === "verifyEmail") {
      applyVerifyLink(oobCode)
        .then(() => setView({ kind: "verified" }))
        .catch(e => setView(isDisabled(e) ? { kind: "disabled" } : isBadLink(e) ? { kind: "bad-link", reset: false } : { kind: "unsupported" }));
    } else {
      setView({ kind: "unsupported" });
    }
  }, [mode, oobCode, signInHref]);
  // (A lost connection lands on "unsupported", whose text says to check it.)

  /** Who is signed in here, then the email: kept from Forgot password, or asked. */
  async function openSignInLink(href: string) {
    if (!isFirebaseSignInLink(href)) { setView({ kind: "link-unusable" }); return; }
    const signedIn = await signedInEmailWhenReady();
    if (signedIn !== null) { setView({ kind: "signed-in", email: signedIn }); return; }
    const kept = linkEmailOnThisBrowser();
    setView(kept ? { kind: "reset-form", email: kept } : { kind: "ask-email" });
  }

  function handleEmail(e: FormEvent) {
    e.preventDefault();
    const checked = checkEmail(typedEmail);
    if (checked.error) { setEmailError(checked.error); return; }
    setView({ kind: "reset-form", email: checked.value });
  }

  async function signOutAndContinue() {
    if (inFlight.current || signInHref === undefined) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await signOutUser();
      await openSignInLink(signInHref);
    } catch (err) {
      setError(messageFor(err, "sign-in") ?? AUTH_MSG.failed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** The sign-in link's Save: sign in with the link (once), then the password. */
  async function saveWithLink(href: string, email: string) {
    const result = await linkReset(href).save(email, password);
    setPassword("");
    setConfirm("");
    if (result.kind === "saved") setView({ kind: "reset-done" });
    else if (result.kind === "signed-in") setView({ kind: "signed-in", email: result.email });
    else setView({ kind: "link-unusable" });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError("");
    const pwErr = checkNewPassword(password) ?? "";
    const cfErr = pwErr ? "" : checkConfirm(password, confirm) ?? "";
    setPasswordError(pwErr);
    setConfirmError(cfErr);
    if (pwErr || cfErr) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (signInHref !== undefined) {
        if (view.kind === "reset-form") await saveWithLink(signInHref, view.email);
        return;
      }
      await setNewPassword(oobCode, password);
      setPassword("");
      setConfirm("");
      setView({ kind: "reset-done" });
    } catch (err) {
      const code = authErrorCode(err);
      if (isDisabled(err)) setView({ kind: "disabled" });
      else if (code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements") setPasswordError(AUTH_MSG.weakPassword);
      else if (isBadLink(err)) setView({ kind: "bad-link", reset: true });
      else setError(messageFor(err, "new-password") ?? AUTH_MSG.failed);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const heading =
    view.kind === "checking" ? "One moment..." :
    view.kind === "reset-form" ? "Create a new password" :
    view.kind === "reset-done" ? "Password changed" :
    view.kind === "verified" ? "Email verified" :
    view.kind === "bad-link" || view.kind === "link-unusable" ? "This link no longer works" :
    view.kind === "ask-email" ? "Confirm your ISU email" :
    view.kind === "signed-in" ? "Sign out first" :
    view.kind === "disabled" ? "Password sign-in is turned off" :
    "Link not recognised";

  const badge: BadgeKind =
    view.kind === "checking" ? "busy" :
    view.kind === "reset-form" || view.kind === "ask-email" ? "lock" :
    view.kind === "reset-done" || view.kind === "verified" ? "success" :
    "warn";

  return (
    <div className="login-wrap">
      <div className="login-stripe" />
      <ThemeToggle variant="page" />

      <div className="animate-fade-in login-card">
        <div className="login-seal-row login-seal-row--small">
          <ISUSeal size={56} />
        </div>
        <p className="state-brand">Isabela State University · Echague Campus</p>
        <div className="login-divider" />

        {(view.kind === "reset-form" || view.kind === "ask-email") && <ResetSteps current={3} />}
        {view.kind === "checking"
          ? <div role="status" aria-label="Checking the link"><StateBadge kind="busy" /></div>
          : <StateBadge kind={badge} />}
        <h1 className="login-h1">{heading}</h1>

        {view.kind === "reset-form" && (
          <>
            <p className="state-help">
              For <strong className="verify-email">{view.email}</strong>. Only for this site; your Gmail
              password does not change.
            </p>

            {error && (
              <div role="alert" className="login-error">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="login-form" noValidate>
              {/* Lets the browser's password manager save the new password for this account. */}
              <input type="email" value={view.email} autoComplete="username" readOnly hidden />
              <div>
                <label className="field-label" htmlFor="new-password">New password</label>
                <PasswordInput id="new-password" value={password} autoComplete="new-password" disabled={busy} autoFocus
                  hint={AUTH_MSG.passwordHint} error={passwordError}
                  onChange={v => { setPassword(v); setPasswordError(""); }}
                  onBlur={() => { if (password) setPasswordError(checkNewPassword(password) ?? ""); }} />
              </div>
              <div>
                <label className="field-label" htmlFor="confirm-password">Confirm new password</label>
                <PasswordInput id="confirm-password" value={confirm} autoComplete="new-password" disabled={busy}
                  error={confirmError}
                  onChange={v => { setConfirm(v); setConfirmError(""); }}
                  onBlur={() => { if (confirm && password) setConfirmError(checkConfirm(password, confirm) ?? ""); }} />
              </div>
              <PasswordChecklist password={password} confirm={confirm} />
              <button type="submit" disabled={busy} className="btn btn-primary login-submit">
                {busy ? <><ButtonSpinner /><span>Saving...</span></> : "Save password"}
              </button>
              {/* Sign-in link only: leaving signs out (App.tsx), so no session stays behind. */}
              {signInHref !== undefined && (
                <button type="button" onClick={() => onExit("sign-in")} disabled={busy} className="gbtn">Cancel</button>
              )}
            </form>
          </>
        )}

        {view.kind === "ask-email" && (
          <>
            <p className="state-help">{AUTH_MSG.linkAskEmail}</p>
            <form onSubmit={handleEmail} className="login-form" noValidate>
              <div>
                <label className="field-label" htmlFor="link-email">ISU username</label>
                <IsuEmailInput id="link-email" value={typedEmail} error={emailError} autoFocus
                  onChange={v => { setTypedEmail(v); setEmailError(""); }}
                  onBlur={() => { if (typedEmail.trim()) setEmailError(checkEmail(typedEmail).error ?? ""); }} />
              </div>
              <button type="submit" className="btn btn-primary login-submit">Continue</button>
              <button type="button" onClick={() => onExit("sign-in")} className="gbtn">Cancel</button>
            </form>
          </>
        )}

        {view.kind === "signed-in" && (
          <>
            {/* Neutral: it may be the same account as the link, or another one. */}
            <p className="state-help">
              An account is signed in on this browser
              {view.email && <> (<strong className="verify-email">{maskEmail(view.email)}</strong>)</>}.
              Sign out to set a new password with this link, or cancel to keep using it.
            </p>
            {error && (
              <div role="alert" className="login-error">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="login-form">
              <button type="button" onClick={signOutAndContinue} disabled={busy} className="btn btn-primary login-submit">
                {busy ? <><ButtonSpinner /><span>Signing out...</span></> : "Sign out and continue"}
              </button>
              <button type="button" onClick={() => onExit("sign-in")} disabled={busy} className="gbtn">Cancel</button>
            </div>
          </>
        )}

        {view.kind === "link-unusable" && (
          <Result text={AUTH_MSG.linkUnusable} button="Send a new link" onClick={() => onExit("forgot")} />
        )}

        {view.kind === "reset-done" && (
          <Result text="Your new e-library password is saved. Sign in with your ISU email and this password. Your Gmail password is unchanged."
            button="Sign in" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "verified" && (
          <Result text="Your ISU email is confirmed. You can now use the e-library."
            button="Continue" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "bad-link" && view.reset && (
          <Result
            text="The link has expired or was already used. Each new request cancels the older links, so always open the newest email."
            button="Send a new link" onClick={() => onExit("forgot")} />
        )}

        {view.kind === "bad-link" && !view.reset && (
          <Result
            text="The link has expired or was already used. If you already verified your email, just continue. Otherwise sign in and tap Resend email."
            button="Continue" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "disabled" && (
          <Result
            text="Passwords cannot be set yet because password sign-in is turned off for this e-library. Contact the Research Department. You can still use Continue with Google."
            button="Back to sign in" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "unsupported" && (
          <Result text="This link could not be opened. Check your connection, or request a new email."
            button="Back to sign in" onClick={() => onExit("sign-in")} />
        )}
      </div>
    </div>
  );
}

/** The badge above the heading carries the icon; this is the text and the one button. */
function Result({ text, button, onClick }: { text: string; button: string; onClick: () => void }) {
  return (
    <div className="reset-done">
      <p className="reset-done-desc">{text}</p>
      <button type="button" onClick={onClick} className="btn btn-primary login-submit">{button}</button>
    </div>
  );
}
