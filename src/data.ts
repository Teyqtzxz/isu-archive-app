// Data layer — the only module that imports firebase/firestore. Components
// never talk to Firestore directly; they call these functions.
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, db } from "./firebase";
import {
  DEPARTMENTS, registeredAtISO,
  type AccountRole, type NewThesis, type Thesis, type ThesisStatus,
} from "./types";

// ─── Auth & user profile (step 03) ──────────────────────────────────────────

const ISU_DOMAIN = "@isu.edu.ph";

/** Client-side UX check only. firestore.rules enforces the domain for real. */
export function isIsuEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(ISU_DOMAIN);
}

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
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // Without this, Google silently reuses the last account, so switching
  // between staff and student test accounts appears not to work.
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, provider);
  if (!isIsuEmail(user.email)) {
    await signOut(auth);
    throw new Error("Please sign in with your ISU Google account (@isu.edu.ph).");
  }
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
