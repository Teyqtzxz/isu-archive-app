import { useEffect, useRef, useState, type FormEvent } from "react";
import { applyVerifyLink, checkResetLink, setNewPassword } from "../data";
import { AUTH_MSG, authErrorCode, checkConfirm, checkNewPassword, messageFor } from "../auth";
import { ResetSteps } from "./ForgotPassword";
import { ButtonSpinner, ISUSeal, Icon, PasswordInput } from "./shared";
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
 */
export function AuthActionScreen({ mode, oobCode, onExit }: {
  mode: string;
  oobCode: string;
  onExit: (to: AuthActionExit) => void;
}) {
  const [view, setView] = useState<View>({ kind: "checking" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A link works once. React's dev StrictMode runs effects twice, and the
  // second applyActionCode would report a good link as "already used".
  const started = useRef(false);
  // Set at once, so a fast double click never saves twice.
  const inFlight = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (mode === "resetPassword") {
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
  }, [mode, oobCode]);
  // (A lost connection lands on "unsupported", whose text says to check it.)

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
    view.kind === "bad-link" ? "This link no longer works" :
    view.kind === "disabled" ? "Password sign-in is turned off" :
    "Link not recognised";

  return (
    <div className="login-wrap">
      <div className="login-stripe" />
      <ThemeToggle variant="page" />

      <div className="animate-fade-in login-card">
        <div className="login-seal-row">
          <ISUSeal size={72} />
        </div>
        <h1 className="login-h1">{heading}</h1>
        <p className="login-sub-title">Isabela State University</p>
        <p className="login-sub-campus">Echague Campus</p>
        <div className="login-divider" />

        {view.kind === "checking" && (
          <div className="reset-done" role="status" aria-label="Checking the link">
            <span className="animate-spin page-spinner" aria-hidden="true" />
          </div>
        )}

        {view.kind === "reset-form" && (
          <>
            <ResetSteps current={3} />
            <div className="info-pill">
              <Icon name="info" size={16} />
              <p>
                Choose a new e-library password for <strong>{view.email}</strong>. It is only for
                this site; your Gmail password does not change.
              </p>
            </div>

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
              <button type="submit" disabled={busy} className="btn btn-primary login-submit">
                {busy ? <><ButtonSpinner /><span>Saving...</span></> : "Save password"}
              </button>
            </form>
          </>
        )}

        {view.kind === "reset-done" && (
          <Result icon="check" text="Your new e-library password is saved. Sign in with your ISU email and this password. Your Gmail password is unchanged."
            button="Sign in" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "verified" && (
          <Result icon="check" text="Your ISU email is confirmed. You can now use the e-library."
            button="Continue" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "bad-link" && view.reset && (
          <Result icon="alert" warn
            text="The link has expired or was already used. A link works for 1 hour, and each new request cancels the older links, so always open the newest email."
            button="Send a new link" onClick={() => onExit("forgot")} />
        )}

        {view.kind === "bad-link" && !view.reset && (
          <Result icon="alert" warn
            text="The link has expired or was already used. If you already verified your email, just continue. Otherwise sign in and tap Resend email."
            button="Continue" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "disabled" && (
          <Result icon="alert" warn
            text="Passwords cannot be set yet because password sign-in is turned off for this e-library. Contact the Research Department. You can still use Continue with Google."
            button="Back to sign in" onClick={() => onExit("sign-in")} />
        )}

        {view.kind === "unsupported" && (
          <Result icon="alert" warn text="This link could not be opened. Check your connection, or request a new email."
            button="Back to sign in" onClick={() => onExit("sign-in")} />
        )}
      </div>
    </div>
  );
}

function Result({ icon, text, button, onClick, warn }: {
  icon: "check" | "alert";
  text: string;
  button: string;
  onClick: () => void;
  warn?: boolean;
}) {
  return (
    <div className="reset-done">
      <div className={`reset-done-icon${warn ? " reset-done-icon--warn" : ""}`}><Icon name={icon} size={24} /></div>
      <p className="reset-done-desc">{text}</p>
      <button type="button" onClick={onClick} className="btn btn-primary login-submit">{button}</button>
    </div>
  );
}
