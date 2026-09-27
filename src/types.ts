// Canonical types. Single source of truth for shape and enums.

export type Screen = "login" | "staff-dashboard" | "register" | "search" | "summary" | "student-dashboard";
export type Role = "staff" | "student";
export type ExtractionState = "idle" | "extracting" | "success" | "needs_review";
export type StaffTab = "dashboard" | "register" | "search" | "settings";

export interface Thesis {
  id: string;
  title: string;
  department: string;
  year: number;
  adviser: string;
  abstract: string;
  keywords: string[];
  status: "archived" | "pending" | "needs_review";
  dateAdded: string;
  driveLink: string;
}
