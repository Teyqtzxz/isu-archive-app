// Data layer — the only module that imports firebase/firestore. Components
// never talk to Firestore directly; they call these functions.
import {
  addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc,
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
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as Thesis)
          // Never compare registeredAt directly — it is a three-way union, and
          // Timestamp.valueOf() is a string. registeredAtISO handles all shapes.
          .sort((a, b) => registeredAtISO(b).localeCompare(registeredAtISO(a))),
      );
    },
    onError,
  );
}

/** Status is passed in by the caller — decided by which button staff pressed. */
export async function saveThesis(t: NewThesis, status: ThesisStatus): Promise<string> {
  const ref = await addDoc(collection(db, "theses"), {
    ...t,
    status,
    registeredBy: auth.currentUser?.uid ?? "",
    registeredAt: serverTimestamp(),
  });
  return ref.id;
}

/** The "Mark as Archived" action on a pending row. Rules allow staff only. */
export async function updateThesisStatus(id: string, status: ThesisStatus): Promise<void> {
  await updateDoc(doc(db, "theses", id), { status });
}

/** Adviser options for the register form. A fixed list for now — not thesis data. */
export const ADVISERS = ["Dr. Maria Santos", "Engr. Jose Reyes", "Dr. Anna Cruz", "Dr. Roberto Dela Cruz", "Engr. Liza Pagulayan", "Dr. Carmen Villanueva", "Dr. Paulo Mendoza", "Prof. Elena Bulan"];

