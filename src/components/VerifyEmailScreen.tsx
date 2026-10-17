import { useEffect, useRef, useState } from "react";
import { checkEmailVerified, resendVerification, signOutUser } from "../data";
import { AUTH_MSG, messageFor } from "../auth";
import { ButtonSpinner, ISUSeal, Icon } from "./shared";
import { ThemeToggle } from "./ThemeToggle";

/** Firebase limits how often a verification email can be sent; this keeps users under it. */
const RESEND_COOLDOWN_S = 60;

/**
 * "Check your ISU inbox": the only screen a signed-in but UNVERIFIED password
 * account ever sees. The rules deny every read until the email is verified, so
 * there is no dashboard to show. Offers: "I've verified" (reload + a fresh
 * token, then App.tsx routes on), resend the email, or sign out.
 */
export function VerifyEmailScreen({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  // Under "I've verified" (still unverified, or no connection).
  const [checkError, setCheckError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The email was just sent on Create account, so start with the cooldown running.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  // Set at once, so a fast double click never runs a request twice.
  const inFlight = useRef(false);
  const busy = checking || sending;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleCheck() {
    if (inFlight.current) return;
    inFlight.current = true;
    setCheckError("");
    setError("");
    setNotice("");
    setChecking(true);
    try {
      if (await checkEmailVerified()) {
        onVerified(); // App.tsx moves to the dashboard
        return;
      }
      setCheckError(AUTH_MSG.notVerified);
    } catch (e) {
      setCheckError(messageFor(e, "sign-in") ?? AUTH_MSG.failed);
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }

  async function handleResend() {
    if (inFlight.current) return;
    inFlight.current = true;
    setCheckError("");
    setError("");
    setNotice("");
    setSending(true);
    try {
      await resendVerification();
      setNotice("A new link was sent. Check your Inbox and Spam folder, and open the newest email.");
      setCooldown(RESEND_COOLDOWN_S);
    } catch (e) {
      setError(messageFor(e, "email") ?? AUTH_MSG.failed);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-stripe" />
      <ThemeToggle variant="page" />

      <div className="animate-fade-in login-card">
        <div className="login-seal-row">
          <ISUSeal size={72} />
        </div>

        <h1 className="login-h1">Check your ISU inbox</h1>
        <p className="login-sub-campus">
          We sent a verification link to <strong className="verify-email">{email}</strong>
        </p>

        <div className="login-divider" />

        <div className="info-pill">
          <Icon name="mail" size={16} />
          <p>
            Open the email from the ISU Research Study E-Library and click the link. This
            proves the ISU address is yours. Then come back here and tap{" "}
            <strong>I've verified</strong>.
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

        <div className="login-form">
          <div>
            <button type="button" onClick={handleCheck} disabled={busy} className="btn btn-primary login-submit"
              aria-describedby={checkError ? "verify-check-error" : undefined}>
              {checking ? <><ButtonSpinner /><span>Checking...</span></> : "I've verified"}
            </button>
            {checkError && <p id="verify-check-error" role="alert" className="field-error">{checkError}</p>}
          </div>
          <button type="button" onClick={handleResend} disabled={busy || cooldown > 0} className="gbtn">
            {sending ? "Sending..." : cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend email"}
          </button>
        </div>

        <p className="login-switch">
          <button type="button" className="login-link" disabled={busy}
            onClick={() => { signOutUser().catch(() => {}); }}>
            Use a different account
          </button>
        </p>
      </div>
    </div>
  );
}
