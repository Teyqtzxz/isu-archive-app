import { useRef, useState, type FormEvent } from "react";
import { createPasswordAccount, signInWithGoogle, signInWithPassword } from "../data";
import {
  AUTH_MSG, authErrorCode, checkConfirm, checkEmail, checkFullName, checkNewPassword, checkPassword, messageFor,
} from "../auth";
import { ButtonSpinner, ISUSeal, Icon, IsuEmailInput, PasswordInput } from "./shared";
import { ForgotPassword } from "./ForgotPassword";
import { ThemeToggle } from "./ThemeToggle";

/** Sign in, Create account, or ask for a link to reset (or first set) the password. */
export type LoginMode = "sign-in" | "create" | "forgot";

/** Create account asks for the full name so the dashboards greet people by
 *  name, not by email. OPTIONAL (owner's call): set to false to drop the field. */
const ASK_FULL_NAME: boolean = true;

type Field = "name" | "email" | "password" | "confirm";
type FieldErrors = Partial<Record<Field, string>>;

/**
 * The login card: ISU email + e-library password, Create account, Forgot
 * password, and Continue with Google (docs/17). There is no role picker: the
 * role comes from the Firestore profile, and App.tsx routes once
 * onAuthStateChanged fires — also to "Check your ISU inbox" for an unverified
 * account. This screen only starts sign-in and shows errors.
 */
export function LoginScreen({ initialMode = "sign-in" }: { initialMode?: LoginMode }) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [busy, setBusy] = useState(false);
  // Set at once (state waits for a re-render), so a fast double click never
  // sends a request twice; the disabled buttons cover every later click.
  const inFlight = useRef(false);
  // A Firebase error that belongs to no single field.
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Set when Continue with Google found a password account for this email.
  const [linkEmail, setLinkEmail] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    setFieldErrors({});
    setPassword("");
    setConfirm("");
  }

  function edit(field: Field, set: (v: string) => void) {
    return (v: string) => {
      set(v);
      // Nothing shows an error while typing; an old one goes as soon as the box changes.
      setFieldErrors(f => ({ ...f, [field]: undefined }));
    };
  }

  /** Format checks on leaving a box (only once something is typed). */
  function blurCheck(field: Field) {
    let msg: string | null = null;
    if (field === "email" && email.trim()) msg = checkEmail(email).error;
    if (field === "name" && name.trim()) msg = checkFullName(name).error;
    if (field === "password" && password && mode === "create") msg = checkNewPassword(password);
    if (field === "confirm" && confirm && password) msg = checkConfirm(password, confirm);
    setFieldErrors(f => ({ ...f, [field]: msg ?? undefined }));
  }

  /** Runs one auth call with the busy flag and error message handled. */
  async function run(action: () => Promise<void>, onError: (e: unknown) => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      await action();
      // Success: App.tsx's auth listener takes over and leaves this screen.
    } catch (e) {
      onError(e);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function handleSignIn(e: FormEvent) {
    e.preventDefault();
    const em = checkEmail(email);
    const errs: FieldErrors = { email: em.error ?? undefined, password: checkPassword(password) ?? undefined };
    setFieldErrors(errs);
    if (errs.email || errs.password) return;
    run(() => signInWithPassword(em.value, password), err => setError(messageFor(err, "sign-in") ?? ""));
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const nm = ASK_FULL_NAME ? checkFullName(name) : { value: "", error: null };
    const em = checkEmail(email);
    const pwErr = checkNewPassword(password);
    // Password = confirm is checked BEFORE Firebase is called.
    const errs: FieldErrors = {
      name: nm.error ?? undefined,
      email: em.error ?? undefined,
      password: pwErr ?? undefined,
      confirm: pwErr ? undefined : checkConfirm(password, confirm) ?? undefined,
    };
    setFieldErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    if (nm.value) setName(nm.value); // shown as it will be saved (capitals fixed)
    run(() => createPasswordAccount(em.value, password, nm.value), err => {
      const code = authErrorCode(err);
      const msg = messageFor(err, "create") ?? "";
      // Under its own field, like the Register form.
      if (code === "auth/email-already-in-use" || code === "auth/invalid-email") setFieldErrors({ email: msg });
      else if (code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements") setFieldErrors({ password: msg });
      else setError(msg);
    });
  }

  function handleGoogle() {
    run(async () => {
      const result = await signInWithGoogle();
      if (!result.signedIn) {
        // The email already has a password account: sign in with it once to
        // connect Google to that same account (data.ts keeps the credential).
        switchMode("sign-in");
        setEmail(result.linkEmail);
        setLinkEmail(result.linkEmail);
      }
    }, err => setError(messageFor(err, "google") ?? ""));
  }

  const heading = mode === "create" ? "Create account" : mode === "forgot" ? "Reset password" : "Research Study E-Library";

  return (
    <div className="login-wrap">
      {/* Top brand stripe */}
      <div className="login-stripe" />

      {/* No header here, so the theme button sits in the corner. */}
      <ThemeToggle variant="page" />

      {/* BG circles */}
      <div className="bg-circle bg-circle--a" />
      <div className="bg-circle bg-circle--b" />

      <div className="animate-fade-in login-card">
        {/* Seal */}
        <div className="login-seal-row">
          <ISUSeal size={72} />
        </div>

        <h1 className="login-h1">
          {heading}
        </h1>
        <p className="login-sub-title">
          Isabela State University
        </p>
        <p className="login-sub-campus">
          Echague Campus
        </p>

        <div className="login-divider" />

        {mode === "sign-in" && !linkEmail && (
          <div className="info-pill">
            <Icon name="info" size={16} />
            <p>
              Search and read the university's research studies. Research Department
              staff can also register and post new ones.
            </p>
          </div>
        )}

        {mode === "sign-in" && linkEmail && (
          // The real owner may not know this password: someone else may have
          // created the account with their email. Forgot password takes it
          // back through their own inbox (docs/17 §3).
          <div role="status" className="login-notice">
            <Icon name="info" size={16} />
            <span>
              <strong className="verify-email">{linkEmail}</strong> already has an e-library password.
              Sign in with it once below to connect Google to the same account.
              Don't know this password? Use{" "}
              <button type="button" className="login-link login-link--inline" disabled={busy}
                onClick={() => switchMode("forgot")}>Forgot password?</button>{" "}
              to set a new one through your ISU inbox, then sign in here.
            </span>
          </div>
        )}

        {error && mode !== "forgot" && (
          <div role="alert" className="login-error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        {mode === "forgot" && <ForgotPassword initialEmail={linkEmail || email} />}

        {mode === "sign-in" && (
          <>
            <form onSubmit={handleSignIn} className="login-form" noValidate>
              <div>
                <label className="field-label" htmlFor="login-email">Email or ISU username</label>
                <IsuEmailInput id="login-email" value={email} onChange={edit("email", setEmail)}
                  onBlur={() => blurCheck("email")} error={fieldErrors.email} disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="login-password">Password</label>
                <PasswordInput id="login-password" value={password} onChange={edit("password", setPassword)}
                  autoComplete="current-password" error={fieldErrors.password} disabled={busy}
                  autoFocus={!!linkEmail} />
              </div>
              <button type="submit" disabled={busy} className="btn btn-primary login-submit">
                {busy ? <><ButtonSpinner /><span>Signing in...</span></> : "Sign in"}
              </button>
            </form>

            <div className="login-links">
              <button type="button" className="login-link" disabled={busy} onClick={() => switchMode("forgot")}>
                Forgot password?
              </button>
              <button type="button" className="login-link" disabled={busy} onClick={() => switchMode("create")}>
                Create account
              </button>
            </div>

            <div className="login-or"><span>or</span></div>

            {/* Google sign-in: the first one creates the account (STUDENT), as before. */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="gbtn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path style={{ fill: "var(--google-blue)" }} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path style={{ fill: "var(--google-green)" }} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path style={{ fill: "var(--google-yellow)" }} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path style={{ fill: "var(--google-red)" }} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {mode === "create" && (
          <>
            <form onSubmit={handleCreate} className="login-form" noValidate>
              {ASK_FULL_NAME && (
                <div>
                  <label className="field-label" htmlFor="create-name">Full name</label>
                  <input id="create-name" className="input" value={name} onChange={e => edit("name", setName)(e.target.value)}
                    onBlur={() => blurCheck("name")} autoComplete="name" placeholder="Juan Dela Cruz" disabled={busy}
                    aria-invalid={fieldErrors.name ? true : undefined}
                    aria-describedby={fieldErrors.name ? "create-name-error" : undefined} />
                  {fieldErrors.name && <p id="create-name-error" className="field-error">{fieldErrors.name}</p>}
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="create-email">ISU email</label>
                <IsuEmailInput id="create-email" value={email} onChange={edit("email", setEmail)}
                  onBlur={() => blurCheck("email")} error={fieldErrors.email} disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="create-password">Password</label>
                <PasswordInput id="create-password" value={password} onChange={edit("password", setPassword)}
                  onBlur={() => blurCheck("password")} autoComplete="new-password" hint={AUTH_MSG.passwordHint}
                  error={fieldErrors.password} disabled={busy} />
              </div>
              <div>
                <label className="field-label" htmlFor="create-confirm">Confirm password</label>
                <PasswordInput id="create-confirm" value={confirm} onChange={edit("confirm", setConfirm)}
                  onBlur={() => blurCheck("confirm")} autoComplete="new-password"
                  error={fieldErrors.confirm} disabled={busy} />
              </div>
              <button type="submit" disabled={busy} className="btn btn-primary login-submit">
                {busy ? <><ButtonSpinner /><span>Creating account...</span></> : "Create account"}
              </button>
            </form>
            <p className="login-switch">
              Already have an account?{" "}
              <button type="button" className="login-link" disabled={busy} onClick={() => switchMode("sign-in")}>
                Sign in
              </button>
            </p>
          </>
        )}

        {mode === "forgot" && (
          <p className="login-switch">
            <button type="button" className="login-link" onClick={() => switchMode("sign-in")}>
              ← Back to sign in
            </button>
          </p>
        )}

        <p className="login-foot">
          Use your @isu.edu.ph account. Personal accounts are not accepted.
        </p>
      </div>

      <div className="site-foot">
        <p>© {new Date().getFullYear()} Isabela State University · Echague Campus · Research Department</p>
      </div>
    </div>
  );
}
