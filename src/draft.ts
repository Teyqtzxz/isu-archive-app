// Unsaved Register / Edit study drafts and the last staff tab, kept in
// sessionStorage so a page reload (F5, Chrome Memory Saver, a phone reloading
// a background tab) does not lose a half-filled form. Per browser tab and gone
// when the tab closes — right for shared lab PCs. Never localStorage, never
// Firestore. Pure parsing on top (examples in draft.check.ts:
// node src/draft.check.ts), the try/catch storage wrappers below it.
import { DEPARTMENTS, type StaffTab } from "./types.ts";
import { MAX_AUTHORS, MAX_KEYWORDS } from "./validation.ts";

export const DRAFT_VERSION = 1;
const DRAFT_PREFIX = "isu-draft:";
export const STAFF_VIEW_KEY = "isu-staff-view";
/** A stored string longer than this is not something the form produced. */
const MAX_TEXT = 20000;

/** Everything staff typed, exactly as held in the form's state. */
export interface DraftFields {
  form: { driveLink: string; title: string; department: string; year: string; adviser: string };
  authors: string[];
  newAuthor: string;
  abstract: string;
  keywords: string[];
  newKw: string;
}

export interface RegisterDraft extends DraftFields {
  v: typeof DRAFT_VERSION;
  /** The account that typed it; a draft from another uid is never shown. */
  uid: string;
  /** null = Register (a new study); otherwise the study being edited. */
  studyId: string | null;
  /** "save" = the abstract/keywords step; mid-reading is stored as "details". */
  step: "details" | "save";
  /** How the save step was reached (null on "details"). */
  readState: "success" | "needs_review" | null;
  keptCurrent: boolean;
  /** Why the PDF could not be read (needs_review only). */
  readError: string;
  /** The last PDF read and how it went (RegisterForm's lastRead). */
  lastRead: { source: string; ok: boolean } | null;
  /** A PDF chosen but not read yet: a file cannot be kept, so staff choose it again. */
  pdfName: string;
  /** Edit: the study's updatedAt (ISO, "" if never edited) when the draft began. */
  baseUpdatedAt: string;
}

/** The staff screen to return to after a reload. */
export type StaffView = StaffTab | `edit:${string}`;
const STAFF_TABS: readonly StaffTab[] = ["dashboard", "register", "search", "statistics", "settings"];

export function draftKey(studyId: string | null): string {
  return `${DRAFT_PREFIX}${studyId === null ? "new" : `edit:${studyId}`}`;
}

const isText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;
const isList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every(isText);

/**
 * A stored draft, or null when it must be ignored: nothing stored, bad JSON,
 * the wrong shape, another version, another account or another study.
 * A department that is not one of DEPARTMENTS comes back as "".
 */
export function parseDraft(raw: string | null, want: { uid: string; studyId: string | null }): RegisterDraft | null {
  if (!raw || !want.uid) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof d !== "object" || d === null) return null;
  const o = d as Record<string, unknown>;
  const f = o.form as Record<string, unknown> | null | undefined;
  const lr = o.lastRead as Record<string, unknown> | null | undefined;
  if (o.v !== DRAFT_VERSION || o.uid !== want.uid || o.studyId !== want.studyId) return null;
  if (typeof f !== "object" || f === null) return null;
  if (![f.driveLink, f.title, f.department, f.year, f.adviser].every(isText)) return null;
  if (!isList(o.authors, MAX_AUTHORS) || !isList(o.keywords, MAX_KEYWORDS)) return null;
  if (![o.newAuthor, o.abstract, o.newKw, o.readError, o.pdfName, o.baseUpdatedAt].every(isText)) return null;
  if (o.step !== "details" && o.step !== "save") return null;
  if (o.step === "save" ? o.readState !== "success" && o.readState !== "needs_review" : o.readState !== null) return null;
  if (typeof o.keptCurrent !== "boolean") return null;
  if (lr !== null && (typeof lr !== "object" || !isText(lr.source) || typeof lr.ok !== "boolean")) return null;
  const department = f.department as string;
  return {
    v: DRAFT_VERSION, uid: want.uid, studyId: want.studyId,
    form: {
      driveLink: f.driveLink as string, title: f.title as string, year: f.year as string, adviser: f.adviser as string,
      department: (DEPARTMENTS as readonly string[]).includes(department) ? department : "",
    },
    authors: o.authors, newAuthor: o.newAuthor as string,
    abstract: o.abstract as string, keywords: o.keywords, newKw: o.newKw as string,
    step: o.step, readState: o.readState as RegisterDraft["readState"], keptCurrent: o.keptCurrent,
    readError: o.readError as string,
    lastRead: lr ? { source: lr.source as string, ok: lr.ok as boolean } : null,
    pdfName: o.pdfName as string, baseUpdatedAt: o.baseUpdatedAt as string,
  };
}

/** True when nothing was typed or changed: no draft to keep, no "Leave site?".
 *  Only the typed fields count; going to the save step alone is not a change. */
export function sameAsStart(now: DraftFields, start: DraftFields): boolean {
  const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return now.form.driveLink === start.form.driveLink && now.form.title === start.form.title
    && now.form.department === start.form.department && now.form.year === start.form.year
    && now.form.adviser === start.form.adviser
    && sameList(now.authors, start.authors) && now.newAuthor === start.newAuthor
    && now.abstract === start.abstract && sameList(now.keywords, start.keywords) && now.newKw === start.newKw;
}

/** The remembered staff screen, or null (nothing stored, junk, another account). */
export function parseStaffView(raw: string | null, uid: string): StaffView | null {
  if (!raw || !uid) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || o.v !== DRAFT_VERSION || o.uid !== uid || typeof o.view !== "string") return null;
    const view = o.view;
    if ((STAFF_TABS as readonly string[]).includes(view)) return view as StaffTab;
    return editViewId(view as StaffView) ? view as StaffView : null;
  } catch {
    return null;
  }
}

/** "edit:abc" → "abc"; a tab → null. */
export function editViewId(view: StaffView): string | null {
  return view.startsWith("edit:") && view.length > 5 ? view.slice(5) : null;
}

// ─── Browser side ──────────────────────────────────────────────────────────
// Storage can be blocked (private mode, site data off, no sessionStorage at
// all): every access is in try/catch, and the form then works exactly as it
// did before drafts existed — nothing is remembered. `store` is for the checks.

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const session = (): Store => sessionStorage;

export function readDraft(uid: string, studyId: string | null, store: () => Store = session): RegisterDraft | null {
  try {
    return parseDraft(store().getItem(draftKey(studyId)), { uid, studyId });
  } catch {
    return null;
  }
}

export function writeDraft(draft: RegisterDraft, store: () => Store = session): void {
  if (!draft.uid) return;
  try {
    store().setItem(draftKey(draft.studyId), JSON.stringify(draft));
  } catch {
    /* blocked or full: not remembered */
  }
}

export function clearDraft(studyId: string | null, store: () => Store = session): void {
  try {
    store().removeItem(draftKey(studyId));
  } catch {
    /* nothing to clear */
  }
}

/** Sign-out: every draft and the remembered staff tab. */
export function clearAllDrafts(store: () => Store = session): void {
  try {
    const s = store();
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && (k.startsWith(DRAFT_PREFIX) || k === STAFF_VIEW_KEY)) keys.push(k);
    }
    keys.forEach(k => s.removeItem(k));
  } catch {
    /* nothing to clear */
  }
}

export function readStaffView(uid: string, store: () => Store = session): StaffView | null {
  try {
    return parseStaffView(store().getItem(STAFF_VIEW_KEY), uid);
  } catch {
    return null;
  }
}

export function saveStaffView(uid: string, view: StaffView, store: () => Store = session): void {
  if (!uid) return;
  try {
    store().setItem(STAFF_VIEW_KEY, JSON.stringify({ v: DRAFT_VERSION, uid, view }));
  } catch {
    /* not remembered */
  }
}
