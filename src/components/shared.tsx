// Small presentational pieces used by more than one screen.
import { useEffect } from "react";
import type { ThesisStatus } from "../types";

export function ISUSeal({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #006439 60%, #004d2b 100%)",
      border: `${size > 36 ? 2 : 1.5}px solid rgba(247,208,0,0.55)`,
      boxShadow: "0 2px 8px rgba(0,100,57,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontWeight: 800, color: "#F7D000", fontSize: size * 0.38, letterSpacing: "-0.5px", lineHeight: 1 }}>ISU</span>
    </div>
  );
}

/** Human-readable text for each status. Shared with the search filter pills so
 *  the badge and the filter can never disagree. */
export const STATUS_LABELS: Record<ThesisStatus, string> = {
  ARCHIVED: "Archived",
  NEEDS_REVIEW: "Needs Review",
  DRAFT: "Draft",
};

export function StatusBadge({ status }: { status: ThesisStatus }) {
  // CSS class names are left lowercase in App.css; only the enum keys changed.
  const cls = {
    ARCHIVED: "status-archived",
    DRAFT: "status-pending",
    NEEDS_REVIEW: "status-needs-review",
  }[status];
  return (
    <span className={`status-badge ${cls}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function DeptBadge({ dept, small }: { dept: string; small?: boolean }) {
  return (
    <span className={`dept-badge${small ? " dept-badge--small" : ""}`}>
      {dept}
    </span>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="animate-toast isu-toast">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  );
}

