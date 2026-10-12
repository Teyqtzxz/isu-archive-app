// Database maintenance helpers. Not imported by the app — nothing in src/
// references this file, and App.tsx must never do so, so it is not in the
// bundle and none of these are reachable as globals. To run one, on the dev
// server, signed in as an account already promoted to STAFF, in the browser
// devtools console:
//
//   const m = await import("/src/seed.ts"); await m.removeSampleStudies();
//
// This file used to hold 21 made-up sample studies for testing. They were
// removed on the professor's request (2026-10-12): the e-library holds real
// studies only, registered by Research Department staff.
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { AccountRole, ThesisStatus } from "./types";

/**
 * Every sample study had this placeholder in place of a real Google Drive
 * file id, and a real Drive link never contains it. Matching on it is what
 * makes removeSampleStudies() unable to touch a study staff registered.
 */
const SAMPLE_DRIVE_LINK = "drive.google.com/file/d/REPLACE/";

/**
 * Delete the made-up sample studies from the database, keeping every real
 * one. Returns how many were deleted. Staff only (rules). Safe to re-run: the
 * second run deletes 0. Run from devtools (see the top of this file).
 */
export async function removeSampleStudies(): Promise<number> {
  let deleted = 0;
  for (const d of (await getDocs(collection(db, "theses"))).docs) {
    if (!String(d.data().driveLink ?? "").includes(SAMPLE_DRIVE_LINK)) continue;
    await deleteDoc(d.ref);
    deleted++;
  }
  return deleted;
}

function normTitle(title: unknown): string {
  return String(title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Delete extra copies of any thesis whose title appears more than once,
 * keeping one. Returns how many were deleted. Staff only (rules). Run from
 * devtools:
 *
 *   const m = await import("/src/seed.ts"); await m.removeDuplicateTheses();
 */
export async function removeDuplicateTheses(): Promise<number> {
  const seen = new Set<string>();
  let deleted = 0;
  for (const d of (await getDocs(collection(db, "theses"))).docs) {
    const key = normTitle(d.data().title);
    if (seen.has(key)) {
      await deleteDoc(d.ref);
      deleted++;
    } else {
      seen.add(key);
    }
  }
  return deleted;
}

/**
 * Rewrite every thesis saved as ARCHIVED, NEEDS_REVIEW or DRAFT (before the
 * review step was removed) as POSTED. Returns how many were changed. The app
 * already shows them all as Posted (data.ts), so this only tidies what the
 * Firebase console shows. Staff only (rules). Safe to re-run. From devtools:
 *
 *   const m = await import("/src/seed.ts"); await m.markAllPosted();
 */
export async function markAllPosted(): Promise<number> {
  const status: ThesisStatus = "POSTED";
  let changed = 0;
  for (const d of (await getDocs(collection(db, "theses"))).docs) {
    if (d.data().status === status) continue;
    await updateDoc(d.ref, { status });
    changed++;
  }
  return changed;
}

/**
 * Set a user's role and department.
 *
 * NOT a way to promote real accounts. This runs in the browser, under
 * firestore.rules, and the rules forbid changing `role` — so once the rules are
 * published this call is denied, which is the protection working. Promote staff
 * in the Firebase console instead (docs/03 §8). Kept for the Rules Playground
 * and the emulator. `department` must be one of DEPARTMENTS, or "".
 */
export async function setMyRole(
  uid: string,
  role: AccountRole,
  department = "",
): Promise<void> {
  await setDoc(doc(db, "users", uid), { role, department }, { merge: true });
}
