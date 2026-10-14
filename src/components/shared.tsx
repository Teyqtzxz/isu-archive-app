// Small presentational pieces used by more than one screen.
import { useEffect, type ReactNode } from "react";
import type { Thesis } from "../types";
import { registeredAtISO } from "../types";
import { highlightParts } from "../snippet";

// ─── Icons ──────────────────────────────────────────────────────────────────
// One small stroke-icon set, so the UI does not mix emoji with vector icons.
// 24×24 grid, currentColor, 2px stroke.
const ICON_PATHS = {
  book: "M4 19.5V5a2 2 0 012-2h13v16H6.5A2.5 2.5 0 004 21.5v-2zM4 19.5A2.5 2.5 0 016.5 17H19",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  calendar: "M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  chart: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  building: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1",
  user: "M20 21a8 8 0 10-16 0M12 13a5 5 0 100-10 5 5 0 000 10z",
  mail: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3 7l9 6 9-6",
  bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  file: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M9 13h6M9 17h6",
  info: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
  chevronDown: "M6 9l6 6 6-6",
  arrowLeft: "M19 12H5M12 5l-7 7 7 7",
  arrowRight: "M5 12h14M12 5l7 7-7 7",
  check: "M5 13l4 4L19 7",
  x: "M18 6L6 18M6 6l12 12",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  monitor: "M4 4h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zM8 20h8M12 16v4",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 18, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** Two-letter initials for the avatar, from a display name or an email. */
export function initialsOf(name: string, email: string): string {
  const parts = (name || email.split("@")[0]).split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// The seal is the logo: the same brand colours in both themes.
export function ISUSeal({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, var(--isu-green) 60%, var(--isu-green-mid) 100%)",
      border: `${size > 36 ? 2 : 1.5}px solid rgba(var(--isu-yellow-rgb), 0.55)`,
      boxShadow: "0 2px 8px rgba(var(--isu-green-rgb), 0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontWeight: 800, color: "var(--isu-yellow)", fontSize: size * 0.38, letterSpacing: "-0.5px", lineHeight: 1 }}>ISU</span>
    </div>
  );
}

/** registeredAt as e.g. "October 12, 2026" ("Oct 12, 2026" with month "short"), or
 *  "Not recorded" for old records without one. Study Details and both dashboards use it. */
export function formatPosted(t: Pick<Thesis, "registeredAt">, month: "long" | "short" = "long"): string {
  const iso = registeredAtISO(t);
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", { year: "numeric", month, day: "numeric" })
    : "Not recorded";
}

/** The labelled author line on result cards and both dashboards: full names, at most
 *  `max`, then "+N more" — "Author: Luigi Mindanao", "Authors: Jan Rhyanne Acosta, Luigi
 *  Mindanao +1 more" (like "Adviser: …" and Study Details' Author/Authors row).
 *  No authors (older records read as []) → "", so the caller can leave the line out. */
export function authorsPreview(authors: string[], max = 2): string {
  const p = authorsPreviewParts(authors, max);
  return p ? `${p.label}: ${p.names}${p.more}` : "";
}

/** authorsPreview() in pieces, so the search result card can highlight the
 *  names alone (not "Authors" or "+1 more"): label "Author" / "Authors",
 *  names "Jan Rhyanne Acosta, Luigi Mindanao", more " +1 more" or "".
 *  No authors → null. */
export function authorsPreviewParts(authors: string[], max = 2): { label: string; names: string; more: string } | null {
  if (authors.length === 0) return null;
  const more = authors.length - max;
  return {
    label: authors.length === 1 ? "Author" : "Authors",
    names: authors.slice(0, max).join(", "),
    more: more > 0 ? ` +${more} more` : "",
  };
}

/** Wraps each word in `text` that starts with a query word in <mark> ("learn"
 *  marks all of "learning"; words under 2 letters are ignored, as in search):
 *  the combined summary, the search result snippet, and the author and adviser
 *  lines on result cards. The rule is in snippet.ts (highlightParts). For
 *  names, pass `skip` = isNameTitle (search.ts) so titles and degrees, which
 *  search ignores, are never marked. Builds React nodes rather than an HTML
 *  string, so abstract text is never parsed as HTML, and the original casing
 *  is kept. */
export function highlightKw(text: string, query: string, skip?: (word: string) => boolean): ReactNode {
  return highlightParts(text, query, skip).map((p, i) =>
    p.hit ? <mark key={i} className="keyword-highlight">{p.text}</mark> : p.text);
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
    <div className="animate-toast isu-toast" role="status" aria-live="polite">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" />
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  );
}

