// Sign-in, Create account and password rules, and the words shown for every
// Firebase Auth error. Pure: no React, no Firebase — like validation.ts, so
// every rule can be checked on its own (node src/auth.check.ts).
//
// These are browser-side checks only. The security boundary is firestore.rules
// (a verified @isu.edu.ph email) and, for the password length, the console's
// password policy (docs/17 §4). Passwords are never stored or logged here:
// they go straight from the form to Firebase Auth, which keeps only a hash.
import { MSG as FORM_MSG, checkAuthor, type Checked } from "./validation.ts";

export const ISU_DOMAIN = "@isu.edu.ph";
export const PASSWORD_MIN = 8;

export const AUTH_MSG = {
  emailRequired: "Please fill in your ISU email.",
  emailFormat: "That email address is not valid.",
  notIsu: "Use your ISU email address (@isu.edu.ph).",
  passwordRequired: "Please type your password.",
  newPasswordRequired: "Please type a password.",
  passwordShort: `The password must be at least ${PASSWORD_MIN} characters.`,
  confirmRequired: "Please type the password again.",
  mismatch: "The passwords don't match.",
  nameRequired: "Please fill in your full name.",
  nameFull: "Type your full name, e.g. Juan Dela Cruz",
  passwordHint: `At least ${PASSWORD_MIN} characters. Not your Gmail password.`,
  // Firebase answers the same for a wrong password and an unknown email (email
  // enumeration protection), so this page cannot be used to find out who has
  // an account.
  wrongCredentials: "Email or password is incorrect.",
  tooManySignIn: "Too many attempts. Wait a few minutes and try again, or use Forgot password?",
  tooManyEmails: "Too many emails sent. Wait a few minutes and try again.",
  emailInUse: "This ISU email already has an account. Sign in, or use Forgot password? to set a password.",
  weakPassword: `Choose a longer password: at least ${PASSWORD_MIN} characters.`,
  offline: "No connection. Check your internet and try again.",
  passwordOff: "Password sign-in is not turned on yet. Contact the Research Department.",
  disabled: "This account is turned off. Contact the Research Department.",
  popupBlocked: "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  unauthorizedDomain: "Sign-in is not enabled for this web address yet. Contact the Research Department.",
  linkDomain: "Email links are not enabled for this web address yet. Contact the Research Department.",
  badLink: "This link no longer works. Request a new one.",
  googleInUse: "This Google account is already connected to another e-library account.",
  notVerified: "Not verified yet. Open the link in your ISU inbox first.",
  failed: "Something went wrong. Try again.",
} as const;

const ok = (value: string): Checked => ({ value, error: null });
const fail = (value: string, error: string): Checked => ({ value, error });

/** Client-side UX check only. firestore.rules enforces the domain for real. */
export function isIsuEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(ISU_DOMAIN);
}

/** " Juan.DelaCruz " → "juan.delacruz@isu.edu.ph"; a full address is kept, lowercased. */
export function toIsuEmail(typed: string): string {
  const u = typed.trim().toLowerCase();
  if (!u) return "";
  return u.includes("@") ? u : u + ISU_DOMAIN;
}

/** The email or ISU username box (Sign in, Create account, Forgot password). */
export function checkEmail(typed: string): Checked {
  const email = toIsuEmail(typed);
  if (!email) return fail("", AUTH_MSG.emailRequired);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(email, AUTH_MSG.emailFormat);
  if (!isIsuEmail(email)) return fail(email, AUTH_MSG.notIsu);
  return ok(email);
}

/** Sign in only needs something typed: the length rule is for new passwords,
 *  and saying it here would hint at what the password is not. */
export function checkPassword(typed: string): string | null {
  return typed ? null : AUTH_MSG.passwordRequired;
}

/** A new password (Create account, reset). Spaces count; nothing is trimmed. */
export function checkNewPassword(typed: string): string | null {
  if (!typed) return AUTH_MSG.newPasswordRequired;
  // Code points, so an emoji counts as one character, as Firebase counts it.
  if ([...typed].length < PASSWORD_MIN) return AUTH_MSG.passwordShort;
  return null;
}

/** Checked before Firebase is called, so a typo never creates an account. */
export function checkConfirm(password: string, confirm: string): string | null {
  if (!confirm) return AUTH_MSG.confirmRequired;
  return password === confirm ? null : AUTH_MSG.mismatch;
}

/** Create account → Full name: required, the Register form's author-name rules. */
export function checkFullName(typed: string): Checked {
  const checked = checkAuthor(typed);
  if (!checked.value) return fail("", AUTH_MSG.nameRequired);
  if (checked.error === FORM_MSG.authorFull) return fail(checked.value, AUTH_MSG.nameFull);
  return checked;
}

/** "juan.delacruz@isu.edu.ph" → "j•••@isu.edu.ph", as Google shows it. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

/** Which screen asked: the same code can need different words. */
export type AuthContext = "sign-in" | "google" | "create" | "email" | "new-password";

/**
 * A Firebase Auth error code as a sentence the user can act on. null = not an
 * error worth showing (the user closed the Google window).
 */
export function authErrorMessage(code: string, context: AuthContext): string | null {
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return AUTH_MSG.popupBlocked;
    case "auth/unauthorized-domain":
      return AUTH_MSG.unauthorizedDomain;
    case "auth/network-request-failed":
      return AUTH_MSG.offline;
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // A reset link for a deleted account also lands here.
      return context === "new-password" ? AUTH_MSG.badLink : AUTH_MSG.wrongCredentials;
    case "auth/invalid-email":
      return AUTH_MSG.emailFormat;
    case "auth/too-many-requests":
      return context === "sign-in" || context === "google" ? AUTH_MSG.tooManySignIn : AUTH_MSG.tooManyEmails;
    case "auth/email-already-in-use":
      return AUTH_MSG.emailInUse;
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return AUTH_MSG.weakPassword;
    case "auth/operation-not-allowed":
      return AUTH_MSG.passwordOff;
    case "auth/user-disabled":
      return AUTH_MSG.disabled;
    case "auth/unauthorized-continue-uri":
    case "auth/invalid-continue-uri":
    case "auth/missing-continue-uri":
      return AUTH_MSG.linkDomain;
    case "auth/expired-action-code":
    case "auth/invalid-action-code":
      return AUTH_MSG.badLink;
    case "auth/credential-already-in-use":
      return AUTH_MSG.googleInUse;
  }
  return AUTH_MSG.failed;
}

/** The code of a Firebase Auth error ("auth/…"), or "" for anything else. */
export function authErrorCode(e: unknown): string {
  const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : "";
  return typeof code === "string" && code.startsWith("auth/") ? code : "";
}

/** Any thrown value as the words to show. data.ts's own errors (Error, no
 *  code) are already written for the user, so their message is kept. */
export function messageFor(e: unknown, context: AuthContext): string | null {
  const code = authErrorCode(e);
  if (code) return authErrorMessage(code, context);
  return e instanceof Error && e.message ? e.message : AUTH_MSG.failed;
}
