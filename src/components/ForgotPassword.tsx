import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendPasswordReset } from "../data";
import { checkEmail, maskEmail, messageFor } from "../auth";
import { ButtonSpinner, Icon, IsuEmailInput } from "./shared";

/** ① Email → ② Check your inbox → ③ New password (AuthActionScreen, opened from the link). */
type Step = "email" | "sent";

/** Firebase limits how often it emails one address; this keeps users under it. */
const RESEND_COOLDOWN_S = 60;

/** The step indicator shared with AuthActionScreen's "New password" step. */
export function ResetSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="reset-steps" aria-label="Steps">
      {["Email", "Check inbox", "New password"].map((label, i) => (
        <li key={label} className={current === i + 1 ? "is-current" : current > i + 1 ? "is-done" : ""}
          aria-current={current === i + 1 ? "step" : undefined}>
          <span>{current > i + 1 ? "✓" : i + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}

/**
 * The Forgot password view inside the login card. Firebase emails a link; the
 * link opens this app on AuthActionScreen to choose the new password. The same
 * link adds a first password to a Google-only account, and lets the real
 * owner take back an account someone else created with their email (docs/17).
 */
export function ForgotPassword({ initialEmail }: { initialEmail: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // Set at once (state waits for a re-render), so a fast double click never
  // sends two emails; the disabled button covers every later click.
  const inFlight = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(isResend: boolean) {
    if (inFlight.current) return;
    const checked = checkEmail(email);
    if (checked.error) { setEmailError(checked.error); setStep("email"); return; }
    setError("");
    setNotice("");
    inFlight.current = true;
    setBusy(true);
    try {
      await sendPasswordReset(checked.value);
      setCooldown(RESEND_COOLDOWN_S);
      setStep("sent");
      if (isResend) setNotice("A new link was sent. Use the newest email: older links stop working.");
    } catch (e) {
      setError(messageFor(e, "email") ?? "");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(false);
  }

  return (
    <>
      <ResetSteps current={step === "email" ? 1 : 2} />

      <div className="info-pill">
        <Icon name="mail" size={16} />
        <p>
          {step === "email"
            ? "Enter your ISU email. We'll send a link to set a new e-library password. Your Gmail password does not change. This also adds a password to an account that has only used Continue with Google."
            // The same words whether or not the account exists, so this
            // screen cannot be used to find out who has an account.
            : <>If an account exists for <strong>{maskEmail(checkEmail(email).value)}</strong>, we sent a link to set a new password. Open the <strong>newest</strong> email and click the link within 1 hour. Check your Inbox and Spam folder.</>}
        </p>
      </div>

      {error && (
        <div role="alert" className="login-error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="login-notice">
          <Icon name="check" size={16} />
          <span>{notice}</span>
        </div>
      )}

      {step === "email" && (
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div>
            <label className="field-label" htmlFor="reset-email">ISU email</label>
            <IsuEmailInput id="reset-email" value={email} disabled={busy} error={emailError}
              onChange={v => { setEmail(v); setEmailError(""); }}
              onBlur={() => { if (email.trim()) setEmailError(checkEmail(email).error ?? ""); }} />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary login-submit">
            {busy ? <><ButtonSpinner /><span>Sending...</span></> : "Send reset link"}
          </button>
        </form>
      )}

      {step === "sent" && (
        <div className="login-form">
          <button type="button" onClick={() => send(true)} disabled={busy || cooldown > 0} className="gbtn">
            {busy ? "Sending..." : cooldown > 0 ? `Resend link (${cooldown}s)` : "Resend link"}
          </button>
          <p className="login-switch login-switch--tight">
            <button type="button" className="login-link" disabled={busy}
              onClick={() => { setStep("email"); setError(""); setNotice(""); }}>
              Use a different email
            </button>
          </p>
        </div>
      )}
    </>
  );
}
