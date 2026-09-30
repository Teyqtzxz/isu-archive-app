import { useState } from "react";
import { FirebaseError } from "firebase/app";
import { signInWithGoogle } from "../data";
import { ISUSeal } from "./shared";

/** Turn a sign-in failure into something a user can act on. */
function signInErrorMessage(e: unknown): string | null {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return null; // the user closed the window — not an error
      case "auth/popup-blocked":
        return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
      case "auth/unauthorized-domain":
        return "Sign-in is not enabled for this web address yet. Contact the Research Department.";
      case "auth/network-request-failed":
        return "No connection. Check your internet and try again.";
    }
  }
  return e instanceof Error ? e.message : "Sign-in failed. Try again.";
}

/**
 * One real Google sign-in button. There is no role picker: the role comes from
 * the user's Firestore profile, and App.tsx routes to the right dashboard once
 * onAuthStateChanged fires. This screen only starts sign-in and shows errors.
 */
export function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      // Success: App.tsx's auth listener takes over and leaves this screen.
    } catch (e) {
      setError(signInErrorMessage(e) ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      {/* Top brand stripe */}
      <div className="login-stripe" />

      {/* BG circles */}
      <div className="bg-circle bg-circle--a" />
      <div className="bg-circle bg-circle--b" />

      <div className="animate-fade-in login-card">
        {/* Seal */}
        <div className="login-seal-row">
          <ISUSeal size={72} />
        </div>

        <h1 className="login-h1">
          ISU Thesis Archive
        </h1>
        <p className="login-sub-title">
          Isabela State University
        </p>
        <p className="login-sub-campus">
          Echague Campus
        </p>

        <div className="login-divider" />

        {/* Info pill */}
        <div className="info-pill">
          <p>
            🔍 Search & browse the archive · Research staff can also register theses
          </p>
        </div>

        {error && (
          <p role="alert" style={{
            margin: "0 0 14px", padding: "10px 12px", borderRadius: 8, fontSize: 13, lineHeight: 1.4,
            background: "var(--isu-red-light)", color: "var(--isu-red)", border: "1px solid rgba(205,32,43,0.25)",
          }}>
            {error}
          </p>
        )}

        {/* Google sign-in */}
        <button
          onClick={handleSignIn}
          disabled={busy}
          className="gbtn"
        >
          {busy ? (
            <>
              <div className="animate-spin" style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(0,100,57,0.15)", borderTopColor: "#006439" }} />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with ISU Google Account
            </>
          )}
        </button>

        <p className="login-foot">
          Secure login with your @isu.edu.ph account
        </p>
      </div>

      <div className="site-foot">
        <p>© 2025 Isabela State University · Echague Campus</p>
      </div>
    </div>
  );
}
