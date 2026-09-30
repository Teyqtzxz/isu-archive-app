// Canonical types. Single source of truth for shape and enums.
import type { Timestamp } from "firebase/firestore";

export type Screen = "login" | "staff-dashboard" | "register" | "search" | "summary" | "student-dashboard";
export type Role = "staff" | "student";
// ExtractionState is UI-only workflow state and deliberately stays lowercase.
// It is NOT ThesisStatus — do not uppercase it to "make it consistent".
export type ExtractionState = "idle" | "extracting" | "success" | "needs_review";
export type StaffTab = "dashboard" | "register" | "search" | "settings";

/** The only three legal thesis status values. Uppercase, always. */
export const STATUSES = ["ARCHIVED", "NEEDS_REVIEW", "DRAFT"] as const;
export type ThesisStatus = (typeof STATUSES)[number];

export interface Thesis {
  id: string;
  title: string;
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
}

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

/** A thesis still waiting on staff. DRAFT and NEEDS_REVIEW both count. */
export function isPending(t: Pick<Thesis, "status">): boolean {
  return t.status === "NEEDS_REVIEW" || t.status === "DRAFT";
}

/**
 * The ten departments, as exact strings. They are used as filter values and as
 * badge labels, so the two can never drift: read them from here, never retype
 * them. Lives in types.ts (not data.ts) because data.ts turns into the
 * Firestore layer in step 04 and its sample data is removed; the filter values
 * must not go with it. users.department must also be one of these.
 */
export const DEPARTMENTS = [
  "Biology", "Agriculture", "Computer Science", "Forestry",
  "Chemical Engineering", "Environmental Science", "Education",
  "Business Administration", "Civil Engineering", "Nursing",
] as const;
