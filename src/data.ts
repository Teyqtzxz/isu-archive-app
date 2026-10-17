// Data layer — the only module that imports firebase/firestore. Components
// never talk to Firestore directly; they call these functions.
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import {
  GoogleAuthProvider, applyActionCode, confirmPasswordReset, createUserWithEmailAndPassword,
  linkWithCredential, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile, verifyPasswordResetCode, type OAuthCredential, type User,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { AUTH_MSG, authErrorCode, isIsuEmail } from "./auth";
import {
  DEPARTMENTS, registeredAtISO,
  type AccountRole, type NewThesis, type Thesis, type ThesisStatus,
} from "./types";

// ─── Auth & user profile (step 03) ──────────────────────────────────────────

// The ISU-only check lives in auth.ts (pure, with examples); re-exported so
// App.tsx keeps importing it from here.
export { isIsuEmail };

export interface UserProfile {
  role: AccountRole;
  /** One of DEPARTMENTS, or "" when unset. Used by step 04's staff filters. */
  department: string;
}

/**
 * Read users/{uid}, creating it as a STUDENT on first login. An account is never
 * created as staff — promotion happens in the Firebase console (docs/03 §8).
 * Anything that is not exactly "STAFF" is treated as STUDENT: least privilege.
 */
export async function getUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    // Trim: the value is typed by hand in the console, and " Computer Science"
    // with a stray space would otherwise silently match no thesis.
    const raw = String(data.department ?? "").trim();
    const dept = (DEPARTMENTS as readonly string[]).includes(raw) ? raw : "";
    return { role: data.role === "STAFF" ? "STAFF" : "STUDENT", department: dept };
  }
  await setDoc(ref, {
    role: "STUDENT",
    department: "",
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    createdAt: serverTimestamp(),
  });
  return { role: "STUDENT", department: "" };
}

/**
 * Google sign-in, ISU accounts only. Routing is NOT done here: App.tsx's
 * onAuthStateChanged listener is the single place that turns a signed-in user
 * into a role and a screen, both for a fresh sign-in and a restored session.
 * This function only has to reject the wrong account with a clear message.
 */
export async function signInWithGoogle(): Promise<GoogleResult> {
  const provider = new GoogleAuthProvider();
  // Without this, Google silently reuses the last account, so switching
  // between staff and student test accounts appears not to work.
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const { user } = await signInWithPopup(auth, provider);
    if (!isIsuEmail(user.email)) {
      await signOut(auth);
      throw new Error("Please sign in with your ISU Google account (@isu.edu.ph).");
    }
    pendingGoogle = null;
    return { signedIn: true };
  } catch (e) {
    // The email already has a password account, and Firebase did not join
    // them by itself (Google is not a "trusted" provider for @isu.edu.ph,
    // docs/17 §3). Keep Google's credential in memory only, and join it to
    // that same account after the next password sign-in — one person, one uid.
    if (authErrorCode(e) === "auth/account-exists-with-different-credential") {
      const fbErr = e as Parameters<typeof GoogleAuthProvider.credentialFromError>[0];
      const email = String(fbErr.customData?.email ?? "").toLowerCase();
      const credential = GoogleAuthProvider.credentialFromError(fbErr);
      if (credential && isIsuEmail(email)) {
        pendingGoogle = { email, credential };
        return { signedIn: false, linkEmail: email };
      }
    }
    throw e;
  }
}

/** Google sign-in either finished, or found a password account to join first. */
export type GoogleResult = { signedIn: true } | { signedIn: false; linkEmail: string };

/** A Google sign-in waiting to be joined to a password account. Memory only:
 *  a reload forgets it, and pressing Continue with Google again brings it back. */
let pendingGoogle: { email: string; credential: OAuthCredential } | null = null;

// ─── Email + password (docs/17) ──────────────────────────────────────────────
// The password is a SYSTEM password for this e-library, kept (hashed) by
// Firebase Auth's Email/Password provider. It is never the Gmail password,
// never written to Firestore or browser storage, and never logged. Like Google
// sign-in, routing is left to App.tsx's auth listener; an unverified account
// is routed to "Check your ISU inbox" there. The forms check emails with
// auth.ts's checkEmail() first; the isIsuEmail guards below are a second line.

// The Continue button on Firebase's own email-link page (used until the
// console's action URL points at the deployed app) returns here.
const continueHere = () => ({ url: window.location.origin + "/" });

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!isIsuEmail(email)) throw new Error(AUTH_MSG.notIsu);
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  const pending = pendingGoogle;
  if (pending && pending.email === user.email?.toLowerCase()) {
    pendingGoogle = null;
    // Signed in either way; a failed join only means Google asks again next time.
    await linkWithCredential(user, pending.credential).catch((err: unknown) => {
      console.warn("[auth] could not connect Google to this account", authErrorCode(err));
    });
  }
}

/**
 * Create account. Firebase signs the new user in at once, so App.tsx moves to
 * "Check your ISU inbox" by itself; the users/{uid} profile (STUDENT) is only
 * created after the email is verified, because the rules deny an unverified
 * token. The name is set first so that profile has it.
 */
export async function createPasswordAccount(email: string, password: string, fullName: string): Promise<void> {
  if (!isIsuEmail(email)) throw new Error(AUTH_MSG.notIsu);
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  // The account exists from here on: a failure below must not look like a
  // failed sign-up. "Resend email" on the next screen covers a lost email.
  await updateProfile(user, { displayName: fullName }).catch((err: unknown) => {
    console.warn("[auth] could not save the name", authErrorCode(err));
  });
  await sendEmailVerification(user, continueHere()).catch((err: unknown) => {
    console.warn("[auth] could not send the verification email", authErrorCode(err));
  });
}

/** Email a reset link. Also how a Google-only account adds its first password,
 *  and how the real owner takes back an account someone else created with
 *  their email. Firebase sends nothing (and says nothing) for an unknown email. */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!isIsuEmail(email)) throw new Error(AUTH_MSG.notIsu);
  await sendPasswordResetEmail(auth, email, continueHere());
}

/** Checks a reset link before the form is shown; resolves to the account's email. */
export function checkResetLink(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

/** Sets the new password; the link stops working after this. */
export function setNewPassword(oobCode: string, newPassword: string): Promise<void> {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

/** Marks the email verified from the link in the verification email. */
export function applyVerifyLink(oobCode: string): Promise<void> {
  return applyActionCode(auth, oobCode);
}

export async function resendVerification(): Promise<void> {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser, continueHere());
}

/**
 * "I've verified": ask Firebase whether the link has been clicked. The forced
 * token refresh matters: without it the rules keep seeing the old
 * email_verified = false until the token expires (up to an hour), and every
 * read is denied.
 */
export async function checkEmailVerified(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// ─── Theses (step 04) ────────────────────────────────────────────────────────

/**
 * Realtime. Every open dashboard updates the moment staff save a thesis.
 * Returns the unsubscribe function — return it from a useEffect as cleanup.
 */
export function subscribeToTheses(
  onData: (theses: Thesis[]) => void,
  onError: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "theses"),
    (snap) => {
      onData(
        snap.docs
          // "estimate": a just-saved doc's serverTimestamp() is still pending
          // locally; without this it reads as null and sorts to the bottom.
          // Every record reads as POSTED, including ones saved as ARCHIVED,
          // NEEDS_REVIEW or DRAFT before the review step was removed.
          // Records saved before the authors field existed have none: read as [].
          .map((d) => {
            const data = d.data({ serverTimestamps: "estimate" });
            return {
              id: d.id, ...data, status: "POSTED",
              authors: Array.isArray(data.authors) ? data.authors : [],
            } as Thesis;
          })
          // Never compare registeredAt directly — it is a three-way union, and
          // Timestamp.valueOf() is a string. registeredAtISO handles all shapes.
          .sort((a, b) => registeredAtISO(b).localeCompare(registeredAtISO(a))),
      );
    },
    onError,
  );
}

/** Staff are the only ones who register, so a saved study is posted at once. */
export async function saveThesis(t: NewThesis): Promise<string> {
  const status: ThesisStatus = "POSTED";
  const ref = await addDoc(collection(db, "theses"), {
    ...t,
    status,
    registeredBy: auth.currentUser?.uid ?? "",
    registeredAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * A failed edit or delete as a sentence staff can act on. The Firestore codes
 * are the ones a staff member can actually hit; anything else gets the
 * generic "try again" rather than Firebase's English-for-developers.
 */
function writeError(err: unknown, action: "save the changes" | "delete the study"): Error {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (code === "permission-denied") {
    return new Error(`You do not have permission to ${action}. Only Research Department staff can edit or delete studies.`);
  }
  if (code === "not-found") {
    return new Error("This study is no longer in the e-library. Someone may have deleted it.");
  }
  if (code === "unavailable") {
    return new Error(`Could not ${action}: no connection. Check your connection and try again.`);
  }
  return new Error(`Could not ${action}. Try again.`);
}

/**
 * Staff edit. Overwrites the fields given and records who changed it and when;
 * registeredAt, registeredBy and status are not touched. Rejects with a clear
 * message (writeError) so the form can show it and stay open.
 */
export async function updateThesis(id: string, fields: Partial<NewThesis>): Promise<void> {
  try {
    await updateDoc(doc(db, "theses", id), {
      ...fields,
      updatedBy: auth.currentUser?.uid ?? "",
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[data] could not update the study", err);
    throw writeError(err, "save the changes");
  }
}

/** Staff delete. Removes the record only: the PDF stays in Google Drive. Every
 *  open list, dashboard and statistic drops it through subscribeToTheses(). */
export async function deleteThesis(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "theses", id));
  } catch (err) {
    console.error("[data] could not delete the study", err);
    throw writeError(err, "delete the study");
  }
}
