// Canonical types. Single source of truth for shape and enums.

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
  dateAdded: string;
  driveLink: string;
}

/** A thesis still waiting on staff. DRAFT and NEEDS_REVIEW both count. */
export function isPending(t: Pick<Thesis, "status">): boolean {
  return t.status === "NEEDS_REVIEW" || t.status === "DRAFT";
}
