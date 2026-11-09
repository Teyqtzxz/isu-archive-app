// Canonical types. Single source of truth for shape and enums.
import type { Timestamp } from "firebase/firestore";

export type Screen = "login" | "verify-email" | "staff-dashboard" | "register" | "search" | "summary" | "student-dashboard";
export type Role = "staff" | "student";
// ExtractionState is UI-only workflow state and deliberately stays lowercase.
// It is NOT ThesisStatus — do not uppercase it to "make it consistent".
export type ExtractionState = "idle" | "extracting" | "success" | "needs_review";
export type StaffTab = "dashboard" | "register" | "search" | "statistics" | "settings";

/**
 * The role a user document may hold. Deliberately uppercase and separate from
 * the lowercase `Role` above: this is stored data, while that is the
 * in-app routing value. Map between them at the boundary, never by casting.
 */
export type AccountRole = "STAFF" | "STUDENT";

/**
 * The one legal thesis status. Only Research Department staff register
 * studies, so everything registered is Posted: the old draft / needs-review
 * step was removed on the professor's request. Records saved before that hold
 * "ARCHIVED", "NEEDS_REVIEW" or "DRAFT"; data.ts reads all of them as POSTED.
 */
export type ThesisStatus = "POSTED";

export interface Thesis {
  id: string;
  title: string;
  /** Author names in citation order. Records saved before this field existed
   *  read as [] (data.ts), so display code must handle an empty list. */
  authors: string[];
  /** The college's full name (errata #87; the field kept its old name). Read
   *  through collegeOf (data.ts), so an old department name arrives as its
   *  college; any other value arrives as it is. */
  department: string;
  year: number;
  adviser: string;
  abstract: string;
  keywords: string[];
  status: ThesisStatus;
  driveLink: string;
  /** uid of the staff member who registered it. */
  registeredBy: string;
  /**
   * Firestore Timestamp once this comes from the database, ISO string from the
   * seed file, null when a record predates the field. Deliberately a union —
   * sorting and display must never assume one shape.
   */
  registeredAt: Timestamp | string | null;
  /** uid of the staff member who last edited it (updateThesis). Absent on a
   *  study never edited; registeredBy is kept unchanged by an edit. */
  updatedBy?: string;
  /** When it was last edited (serverTimestamp). Absent on a study never edited. */
  updatedAt?: Timestamp | string | null;
}

/** What the register form hands to saveThesis() (and, in edit mode, to
 *  updateThesis()). saveThesis fills in the status (always POSTED) and the
 *  server the id, registeredBy and registeredAt; updateThesis adds updatedBy
 *  and updatedAt. */
export type NewThesis = Omit<Thesis, "id" | "status" | "registeredBy" | "registeredAt" | "updatedBy" | "updatedAt">;

/**
 * registeredAt as a sortable ISO string, whatever shape it arrived in.
 * Sorting ("newest first") and the "This Month" stat both need to compare dates
 * they did not create, so they go through here rather than each guessing at the
 * union. Null sorts as "" and therefore last, which is the intent: a record with
 * no registration date is not the newest thing in the archive.
 *
 * Added beyond the 02 spec, which gave registeredAt a three-way union but no
 * reader for it. Step 04 replaces the callers once Firestore is the source.
 */
export function registeredAtISO(t: Pick<Thesis, "registeredAt">): string {
  const v = t.registeredAt;
  if (v === null) return "";
  if (typeof v === "string") return v;
  return v.toDate().toISOString();
}

// The ten departments that were here became the 12 colleges of colleges.ts
// (errata #87): COLLEGES, COLLEGE_NAMES, collegeOf, shortCollege.
