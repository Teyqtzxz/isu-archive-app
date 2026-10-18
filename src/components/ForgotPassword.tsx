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
      {["Email", "Check inbox", "New password"].map((label, i) => {
        const done = current > i + 1;
        const now = current === i + 1;
        return (
          <li key={label} className={now ? "is-current" : done ? "is-done" : ""} aria-current={now ? "step" : undefined}>
            <span className="reset-steps-dot" aria-hidden="true">
              {done ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span>{label}{done && <span className="sr-only"> (done)</span>}</span>
          </li>
        );
      })}
    </ol>
  );
}

export type BadgeKind = "mail" | "lock" | "success" | "warn" | "busy";

/** The round icon at the top of each email-link screen. Decorative: the heading says the same. */
export function StateBadge({ kind }: { kind: BadgeKind }) {
  return (
    <div className={`state-badge state-badge--${kind}`} aria-hidden="true">
      {kind === "mail" && <Icon name="mail" size={26} />}
      {kind === "warn" && <Icon name="alert" size={26} />}
      {kind === "busy" && <span className="animate-spin page-spinner" />}
      {kind === "lock" && (
        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4M12 15v2" />
        </svg>
      )}
      {kind === "success" && (
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}
          strokeLinecap="round" strokeLinejoin="round" focusable="false">
          {/* pathLength 1 lets the CSS draw the tick from 0 to 1. */}
          <path className="state-badge-tick" d="M5 13l4 4L19 7" pathLength={1} />
        </svg>
      )}
    </div>
  );
}

/** "Didn't get it?" under the email-sent screens (Forgot password, Check your ISU inbox). */
export function DidntGetIt() {
  return (
    <div className="help-block">
      <p className="help-block-title">Didn't get it?</p>
      <ul>
        <li>Check Spam and All Mail.</li>
        <li>It comes from <strong className="help-block-sender">noreply@isu-archive-9253b.firebaseapp.com</strong>.</li>
        <li>Open the newest email; older links stop working.</li>
      </ul>
    </div>
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

      {step === "email" ? (
        <>
          <StateBadge kind="lock" />
          <p className="state-help">We'll email a link to set a new e-library password.</p>
        </>
      ) : (
        <>
          <StateBadge kind="mail" />
          <h2 className="state-title">Check your ISU inbox</h2>
          {/* The same words whether or not the account exists, so this
              screen cannot be used to find out who has an account. */}
          <p className="state-help">
            If an account exists for <strong>{maskEmail(checkEmail(email).value)}</strong>, we sent a link to set a new password.
          </p>
        </>
      )}

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
          <div className="info-pill info-pill--after">
            <Icon name="info" size={16} />
            <p>
              Your Gmail password does not change. This also adds a password to an account
              that has only used Continue with Google.
            </p>
          </div>
        </form>
      )}

      {step === "sent" && (
        <div className="login-form">
          <DidntGetIt />
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
