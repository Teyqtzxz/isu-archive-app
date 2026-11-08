import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { ExtractionState, NewThesis, Thesis } from "../types";
import { DEPARTMENTS, registeredAtISO } from "../types";
import { preloadPdfReader, readFromDrive, readFromFile, type ReadProgress, type StudyRead } from "../extractPdf";
import { progressText } from "../pdfText";
import { fillFromPdf, type DetailField, type StudyDetails } from "../pdfDetails";
import {
  ABSTRACT_COUNTER_FROM, ABSTRACT_MAX, ABSTRACT_MIN_WORDS, MAX_AUTHORS, MAX_KEYWORDS, MSG, TITLE_COUNTER_FROM, TITLE_MAX,
  addAuthor, checkAbstract, checkAdviser, checkAuthor, checkTitle, checkYear, cleanAbstract,
  cleanAuthorList, cleanKeywordList, cleanSpaces, countWords, pdfFileProblem, validateDriveLink, yearInput,
} from "../validation";
import { buildOriginalityIndex, originalityCheck, originalityReason, type SimilarityLevel } from "../similarity";
import { autoKeywords, findNearCopies, keywordKey, reinsertKeyword, trainKeywordModel } from "../keywordModel";
import { takeKeywordsLine } from "../pdfText";
import {
  MAX_REMOVED_KEYWORDS, clearDraft, readDraft, sameAsStart, writeDraft, type DraftFields, type RegisterDraft,
} from "../draft";
import { Icon, SharedTerms, withAccount } from "./shared";

/** Any past year up to this one can be typed. The box starts empty
 *  (errata #82): a year is never guessed, it comes from the PDF or staff. */
const THIS_YEAR = new Date().getFullYear();

/** Every input that can show a message under it, in screen order: on submit
 *  the cursor goes to the first one with an error. */
const FIELDS = ["pdf", "drive", "title", "author", "department", "year", "adviser", "abstract"] as const;
type Field = typeof FIELDS[number];
type FieldErrors = Partial<Record<Field, string>>;
const fieldId = (f: Field) => `register-${f}`;
/** Which PDF was read: the same file chosen again is not read twice. */
const pdfSource = (file: File) => `file:${file.name}:${file.size}:${file.lastModified}`;
const errorId = (f: Field) => `register-${f}-error`;

/** The originality check's three messages (similarity.ts THRESHOLDS: 80 / 50 / 30%,
 *  on the higher of the overall and the abstract-only score). */
const SIMILARITY_BOXES: { level: SimilarityLevel; className: string; heading: (count: number) => string }[] = [
  { level: "duplicate", className: "sim-box sim-box--duplicate", heading: () => "Possible duplicate — this study may already be registered" },
  { level: "very-similar", className: "sim-box sim-box--warn", heading: n => n === 1 ? "Very similar study found" : "Very similar studies found" },
  { level: "related", className: "sim-box sim-box--info", heading: () => "Related studies" },
];

/** Shown when an Edit draft is dropped because someone saved the study since. */
const STALE_DRAFT = "This study was changed since your unsaved edits, so they were discarded. Please edit it again.";

/** For this long after the save step opens, Save, the keyword × and Undo
 *  ignore clicks (errata #72, #77, #80). It starts again when keywords are
 *  added from a typed abstract, as the list grows and Save moves. */
const SAVE_GUARD_MS = 1000;
/** After a keyword is removed or put back, the × buttons ignore clicks for
 *  this long: the next chip slides under the mouse, and the second click of
 *  a double-click would remove it too (errata #80). */
const CHIP_GUARD_MS = 500;
/** How long "Removed … Undo" stays (paused while the mouse or the keyboard is on it). */
const UNDO_MS = 8000;
/** Near Save when a Save click was not taken because keywords were just
 *  added from the typed abstract. */
const KEYWORDS_ADDED_NOTE = "Keywords were added. Check them, then click Save.";

/** The study's updatedAt as an ISO string ("" if never edited), to tell
 *  whether someone saved it after an Edit draft began. */
const updatedISO = (study: Thesis) => registeredAtISO({ registeredAt: study.updatedAt ?? null });

interface RegisterFormProps {
  /** Edit mode: the saved study, pre-filled (cleaned as when typed). Reading a
   *  PDF is then optional; with none chosen the current abstract and keywords
   *  are kept. Key the form by study id so a different study starts fresh. */
  study?: Thesis;
  /** Every stored study, for the originality check on the save step. */
  theses: Thesis[];
  /** False until the live list has arrived: saving waits for it, because the
   *  originality check and the automatic keywords are computed from it. */
  studiesReady: boolean;
  /** Why the list could not be loaded (App's data error), or null. */
  studiesError: string | null;
  /** The signed-in account; "Open in Drive" on a match opens with it (authuser). */
  viewerEmail: string;
  /** The signed-in uid: the unsaved draft (draft.ts) belongs to it. */
  uid: string;
  onBack: () => void;
  /** Persists the thesis. Rejects on failure so the form can show the error. */
  onSave: (thesis: NewThesis) => Promise<void>;
  /** A toast for an Edit draft that had to be dropped (the study changed since). */
  onDraftDiscarded?: (message: string) => void;
}

/**
 * The Register / Edit form with an unsaved draft kept in sessionStorage
 * (draft.ts), so a reload reopens it. A draft from another account, or an
 * Edit draft for a study someone has saved since, is never shown. Discard
 * remounts the form fresh.
 */
export function RegisterForm(props: RegisterFormProps) {
  const { study, uid, onDraftDiscarded } = props;
  const studyId = study?.id ?? null;
  // Read once on mount, no side effects here (StrictMode runs this twice).
  const [start] = useState(() => {
    const d = readDraft(uid, studyId);
    const stale = !!d && !!study && d.baseUpdatedAt !== updatedISO(study);
    return { draft: stale ? null : d, stale };
  });
  const [draft, setDraft] = useState<RegisterDraft | null>(start.draft);
  /** Bumped by Discard: the form remounts with nothing filled in. */
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!start.stale) return;
    clearDraft(studyId);
    onDraftDiscarded?.(STALE_DRAFT);
    // Once, for the draft read on mount.
  }, []);

  function discard() {
    clearDraft(studyId);
    setDraft(null);
    setRun(r => r + 1);
  }

  return <RegisterFormBody key={run} {...props} draft={draft} onDiscard={discard} />;
}

function RegisterFormBody({ study, theses, studiesReady, studiesError, viewerEmail, uid, onBack, onSave, draft, onDiscard }: RegisterFormProps & {
  /** The restored draft, or null for a fresh form. */
  draft: RegisterDraft | null;
  onDiscard: () => void;
}) {
  const editing = !!study;
  /** The form as it opens with nothing typed: blank, or the saved study
   *  (Edit). A draft is kept, and "Leave site?" asked, only when it differs. */
  const [startFields] = useState<DraftFields>(() => study
    ? {
      form: {
        driveLink: study.driveLink.trim(), title: checkTitle(study.title).value,
        // Not one of DEPARTMENTS (typed by hand long ago) → blank, so saving asks for one.
        department: (DEPARTMENTS as readonly string[]).includes(study.department) ? study.department : "",
        year: yearInput(String(study.year ?? "")), adviser: checkAdviser(study.adviser).value,
      },
      authors: cleanAuthorList(study.authors).list, newAuthor: "",
      abstract: cleanAbstract(study.abstract), keywords: cleanKeywordList(study.keywords),
    }
    : {
      form: { driveLink: "", title: "", department: "", year: "", adviser: "" },
      authors: [], newAuthor: "", abstract: "", keywords: [],
    });
  // A restored draft (draft.ts) fills everything it saved; the PDF file
  // itself cannot be kept, so pdfFile always starts empty.
  const init = draft ?? startFields;
  const [extractState, setExtractState] = useState<ExtractionState>(draft?.readState ?? "idle");
  const [form, setForm] = useState(init.form);
  /** One entry per author. A list, not a comma string, because names like
   *  "Santos, Maria" contain commas themselves. */
  const [authors, setAuthors] = useState<string[]>(init.authors);
  const [newAuthor, setNewAuthor] = useState(init.newAuthor);
  const [abstract, setAbstract] = useState(init.abstract);
  const [keywords, setKeywords] = useState<string[]>(init.keywords);
  /** Automatic keywords (keywordModel.ts autoKeywords, docs/15 §6), as
   *  keyword keys: the ones added by themselves and still listed (tagged
   *  "auto" until saved), the ones staff removed (never added by themselves
   *  again), and what they were already added for (a PDF read, or
   *  "typed:" + the failed read for a typed abstract). Staff never add a
   *  keyword by hand (errata #80): they only remove. */
  const [autoAdded, setAutoAdded] = useState<string[]>(draft?.autoAdded ?? []);
  const [removedKeys, setRemovedKeys] = useState<string[]>(draft?.removedKeys ?? []);
  const [autoFor, setAutoFor] = useState<string | null>(draft?.autoFor ?? null);
  /** Edit mode, no PDF chosen: the save step shows the abstract and keywords
   *  already in the form instead of ones just read from a PDF. */
  const [keptCurrent, setKeptCurrent] = useState(draft?.keptCurrent ?? false);
  /** Why the PDF could not be read (shown on the save step). */
  const [error, setError] = useState(draft?.readState === "needs_review" ? draft.readError : "");
  /** One message per input, shown under it. The rules are in validation.ts. */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  /** Grey notes, not errors: a repeat that was skipped, a PDF too large to read. */
  const [notes, setNotes] = useState<{ pdf?: string; author?: string }>({});
  /** The last keyword removed, for "Removed … Undo": where it was and whether
   *  it carried the auto tag. `id` restarts the timer for each removal. */
  const [undo, setUndo] = useState<{ keyword: string; index: number; auto: boolean; id: number } | null>(null);
  /** The mouse or the keyboard is on the Undo line: its timer waits. */
  const [undoHeld, setUndoHeld] = useState(false);
  /** Shown near Save: see KEYWORDS_ADDED_NOTE. */
  const [saveNote, setSaveNote] = useState("");
  /** Read by screen readers only: the keywords just added from a typed abstract. */
  const [addedAnnouncement, setAddedAnnouncement] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  /** The details still holding what the PDF read put there: tagged "from
   *  PDF" so staff check them; changing one removes its tag (errata #82). */
  const [fromPdf, setFromPdf] = useState<DetailField[]>(draft?.fromPdf ?? []);
  /** Grey notes under the details after a read (pdfDetails.ts NOTE). */
  const [pdfNotes, setPdfNotes] = useState<Partial<Record<DetailField, string>>>(draft?.pdfNotes ?? {});
  /** "Downloading 3.1 of 11.6 MB…" / "Reading page 5 (up to 40)…" while reading. */
  const [progress, setProgress] = useState("");
  const untag = (f: DetailField) => setFromPdf(p => p.includes(f) ? p.filter(x => x !== f) : p);
  /** The "from PDF" tag in a field's label: text, so screen readers read it
   *  with the label ("Title, required, from PDF"), not a colour alone. */
  const tag = (f: DetailField) => fromPdf.includes(f) && <>{" "}<span className="pdf-tag">from PDF</span></>;

  // pdf.js is not in the main bundle (errata #82): start loading it, and its
  // worker, while staff choose the file, so the first read does not wait.
  useEffect(() => { preloadPdfReader(); }, []);
  /** Backup source (docs/06 §7): a PDF picked from this computer, read without Drive. */
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The last PDF read and how it went, so "Edit details" → continue does not
   *  download the same file again or wipe the staff member's edits. */
  const lastRead = useRef<{ source: string; ok: boolean } | null>(draft?.lastRead ?? null);
  /** Restored after a PDF was read fine: the abstract and keywords are here,
   *  so Continue with no PDF chosen keeps them (as Edit does) instead of
   *  reading the Drive link and possibly wiping them. */
  const restoredRead = !editing && draft?.lastRead?.ok === true;
  /** Restored with an abstract already there (read or typed): a failed read
   *  of another PDF keeps it rather than blanking staff's work. */
  const restoredWork = !!draft && (draft.step === "save" || draft.abstract.trim() !== "");
  /** The chosen PDF's name, for the draft, when it has not been read yet:
   *  after a reload staff must choose it again. */
  const unreadPdf = pdfFile && lastRead.current?.source !== pdfSource(pdfFile) ? pdfFile.name : "";
  /** Set once saved or left (Cancel / Back): no more draft writes, no "Leave site?". */
  const left = useRef(false);

  // The unsaved draft: written on every change while the form differs from
  // how it opened, removed when it does not (draft.ts; storage errors ignored).
  const fieldsNow: DraftFields = { form, authors, newAuthor, abstract, keywords };
  const changed = !sameAsStart(fieldsNow, startFields);
  const studyId = study?.id ?? null;
  const baseUpdatedAt = study ? updatedISO(study) : "";
  const readState = extractState === "success" || extractState === "needs_review" ? extractState : null;
  useEffect(() => {
    if (left.current) return;
    if (!changed) {
      clearDraft(studyId);
      return;
    }
    writeDraft({
      v: 1, uid, studyId, form, authors, newAuthor, abstract, keywords,
      step: readState ? "save" : "details", readState,
      keptCurrent, readError: readState === "needs_review" ? error : "",
      lastRead: lastRead.current, pdfName: unreadPdf, baseUpdatedAt, autoAdded, removedKeys, autoFor,
      fromPdf, pdfNotes,
    });
  }, [changed, uid, studyId, form, authors, newAuthor, abstract, keywords, readState,
    keptCurrent, error, unreadPdf, baseUpdatedAt, autoAdded, removedKeys, autoFor, fromPdf, pdfNotes]);

  // "Leave site?" (the browser's own prompt) on close / refresh while there
  // is unsaved input. Not while nothing was typed, and not after saving.
  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (left.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  /** Cancel / Back to dashboard: nothing saved, the draft goes too. */
  function leave() {
    left.current = true;
    clearDraft(studyId);
    onBack();
  }

  // Originality check (similarity.ts) on the save step: the study as it will
  // be saved, compared with every stored study except itself (Edit study).
  // Scored overall and by abstract alone (a copied abstract under a new
  // title is still a duplicate). The stored studies' vectors are built once
  // per data change.
  const onSaveStep = extractState === "success" || extractState === "needs_review";
  /** The library as it was when Save was clicked, kept until the form leaves
   *  or the save fails. Firestore's local snapshot adds the new study to
   *  `theses` before the save resolves; without this the originality check
   *  ran again and called the study a "Possible duplicate" of itself. */
  const [savedFrom, setSavedFrom] = useState<Thesis[] | null>(null);
  const library = savedFrom ?? theses;
  const originalityIndex = useMemo(() => buildOriginalityIndex(library), [library]);
  const byId = useMemo(() => new Map(library.map(t => [t.id, t])), [library]);
  const draftTitle = checkTitle(form.title).value;
  const matches = useMemo(() => onSaveStep
    ? originalityCheck(originalityIndex, { title: draftTitle, abstract, keywords }, { excludeId: study?.id })
    : [], [onSaveStep, originalityIndex, draftTitle, abstract, keywords, study?.id]);
  /** The possible duplicates, as one key: ticking the box confirms these ones.
   *  If the list changes (abstract edited, another study saved), it asks again. */
  const duplicateKey = matches.filter(m => m.level === "duplicate").map(m => m.id).join(" ");
  const [checkedDuplicates, setCheckedDuplicates] = useState("");
  const mustConfirm = duplicateKey !== "" && checkedDuplicates !== duplicateKey;
  /** The match whose details are shown inside the warning (no leaving the form). */
  const [detailsId, setDetailsId] = useState<string | null>(null);

  // A click aimed at something else must not post the study (errata #72). Each
  // way into the save step (a read, a failed read, Edit study, back with the
  // same PDF, a restored draft) goes to the top before the browser paints, so
  // Save does not appear under the mouse. "instant": html scrolls smoothly
  // (index.css), which would leave Save under the mouse for a moment.
  /** When the click guard (SAVE_GUARD_MS) last started, and why: the save
   *  step opening, or keywords added from a typed abstract ("typed"). */
  const guardFrom = useRef(0);
  const guardReason = useRef<"open" | "typed">("open");
  /** After "typed": a Save click was turned down with the note, so the next one is taken. */
  const saveFreed = useRef(false);
  /** When the latest mouse / touch press on Save began (its pointerdown). */
  const savePressAt = useRef(0);
  /** After "typed": the abstract box was left by pressing Save, so the note
   *  showed at once (before any Save click came). */
  const noteAtLeave = useRef(false);
  /** When a keyword was last removed or put back (CHIP_GUARD_MS). */
  const lastChipChange = useRef(0);
  useLayoutEffect(() => {
    if (!onSaveStep) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    guardFrom.current = performance.now();
    guardReason.current = "open";
    saveFreed.current = false;
  }, [onSaveStep]);

  // Keyword model (keywordModel.ts, docs/15): trained once per data change on
  // every stored study except this one (Edit study must not learn its own
  // keywords), near-copies counted once (found with the originality index above).
  const nearCopies = useMemo(() => findNearCopies(library, originalityIndex), [library, originalityIndex]);
  const keywordModel = useMemo(() => trainKeywordModel(library, { excludeId: study?.id, nearCopies }), [library, study?.id, nearCopies]);
  /** The e-library has loaded, or failed to (then the abstract phrases alone). */
  const studiesLoaded = studiesReady || !!studiesError;

  // Automatic keywords (docs/15 §6): a NEW study, once per PDF read, when the
  // save step opens after a successful read and the e-library has loaded. A
  // read whose abstract does not pass the abstract check (none found, or too
  // short) waits for staff to type it: see abstractLeft. Never in Edit study,
  // never one staff removed. The PDF's own keywords stay first; the added
  // ones come after them, tagged "auto".
  const readSource = extractState === "success" && lastRead.current?.ok ? lastRead.current.source : null;
  const autoReady = !editing && readSource !== null && readSource !== autoFor && studiesLoaded;
  useEffect(() => {
    if (!autoReady || checkAbstract(abstract).error) return;
    const picked = autoKeywords(keywordModel, { title: draftTitle, abstract, keywords }, removedKeys);
    setAutoFor(readSource);
    if (picked.length === 0) return;
    setKeywords(k => [...k, ...picked.map(p => p.keyword)]);
    setAutoAdded(a => [...a, ...picked.map(p => p.key)]);
    // Runs only when it becomes ready, on purpose: editing the abstract or the
    // keywords afterwards adds nothing (it reads them as they are at that moment).
  }, [autoReady]);

  /** What automatic keywords are added for right now: the PDF read, or a
   *  typed abstract after a failed read (one time each, kept in the draft). */
  const autoKeyNow = () => readSource ?? `typed:${lastRead.current?.source ?? ""}`;

  /**
   * Leaving the abstract box on a NEW study's save step (errata #80):
   * 1. A pasted "Keywords: …" line (pdfText.ts takeKeywordsLine) leaves the
   *    abstract and its keywords join the list as printed keywords: before
   *    the automatic ones, never one staff removed.
   * 2. Once per read (autoKeyNow), when the abstract passes the abstract
   *    check and the model has not added keywords for it yet: the same
   *    automatic keywords as for a PDF. Changing the abstract afterwards adds
   *    and removes nothing.
   * When either adds a keyword, the click guard starts again, because the
   * list grows and pushes Save down. A Save click inside it is not taken, but
   * not silently: the note near Save says why, and the next Save click is
   * taken (handleSave). Leaving the box by pressing Save shows the note at once.
   */
  function abstractLeft(value: string, goingTo: EventTarget | null) {
    let abs = value;
    let list = keywords;
    let tagged = autoAdded;
    const removed = new Set(removedKeys);
    const pasted = editing ? null : takeKeywordsLine(value);
    if (pasted) {
      abs = pasted.abstract;
      const autoSet = new Set(autoAdded);
      const printed = cleanKeywordList(pasted.keywords).filter(k => !removed.has(keywordKey(k)));
      const printedKeys = new Set(printed.map(keywordKey));
      // A printed keyword that equals a listed one replaces it (and is not "auto").
      const own = list.filter(k => !autoSet.has(keywordKey(k)) && !printedKeys.has(keywordKey(k)));
      const autos = list.filter(k => autoSet.has(keywordKey(k)) && !printedKeys.has(keywordKey(k)));
      list = cleanKeywordList([...own, ...printed, ...autos]);
      const kept = new Set(list.map(keywordKey));
      tagged = autoAdded.filter(k => kept.has(k) && !printedKeys.has(k));
    }
    const key = autoKeyNow();
    if (!editing && onSaveStep && key !== autoFor && studiesLoaded && !checkAbstract(abs).error) {
      const auto = autoKeywords(keywordModel, { title: draftTitle, abstract: abs, keywords: list }, removedKeys);
      setAutoFor(key);
      list = [...list, ...auto.map(p => p.keyword)];
      tagged = [...tagged, ...auto.map(p => p.key)];
    }
    if (abs !== value) setAbstract(abs);
    if (list !== keywords) setKeywords(list);
    if (tagged !== autoAdded) setAutoAdded(tagged);
    setFieldError("abstract", problem("abstract", abs, false));
    // New in the list (printed from a pasted line, or automatic).
    const before = new Set(keywords.map(keywordKey));
    const added = list.filter(k => !before.has(keywordKey(k)));
    if (added.length > 0) {
      guardFrom.current = performance.now();
      guardReason.current = "typed";
      saveFreed.current = false;
      noteAtLeave.current = false;
      setAddedAnnouncement(`${added.length === 1 ? "1 keyword was" : `${added.length} keywords were`} added from the abstract: ${added.join(", ")}.`);
      // Leaving the box by pressing Save: say at once why that press is not
      // taken (the list just grew and Save moved, so it may miss Save anyway).
      if (goingTo instanceof HTMLElement && goingTo.classList.contains("btn-submit--save")) {
        setSaveNote(KEYWORDS_ADDED_NOTE);
        noteAtLeave.current = true;
      }
    }
  }

  /** A click on Save, × or Undo this soon after the save step opened (or after
   *  keywords were added from a typed abstract) was aimed at something else
   *  (errata #72, #77, #80). */
  const tooSoon = () => performance.now() - guardFrom.current < SAVE_GUARD_MS;
  /** Some listed keyword carries the "auto" tag. */
  const autoShown = keywords.some(kw => autoAdded.includes(keywordKey(kw)));

  const steps = [
    { label: editing ? "Edit study" : "Choose PDF", active: extractState === "idle" || extractState === "extracting", done: extractState !== "idle" },
    { label: "Reading", active: extractState === "extracting", done: extractState === "success" || extractState === "needs_review" },
    { label: "Check & save", active: extractState === "success" || extractState === "needs_review", done: false },
  ];

  /**
   * The message for one input, or null. On leaving a field (`submit` false) an
   * empty field is not flagged; on submit, required fields are.
   */
  function problem(f: Field, value: string, submit: boolean): string | null {
    const blank = !value.trim();
    switch (f) {
      case "drive":
        if (blank) return submit ? (pdfFile ? MSG.driveRequiredWithPdf : MSG.driveRequired) : null;
        return validateDriveLink(value);
      case "title": return blank && !submit ? null : checkTitle(value).error;
      case "adviser": return blank && !submit ? null : checkAdviser(value).error;
      case "abstract": return blank && !submit ? null : checkAbstract(value).error;
      case "author": return checkAuthor(value).error;
      case "department": return submit && !(DEPARTMENTS as readonly string[]).includes(value) ? MSG.departmentRequired : null;
      case "year": return blank && !submit ? null : checkYear(value).error;
      default: return null;
    }
  }

  function setFieldError(f: Field, message: string | null) {
    setFieldErrors(p => ({ ...p, [f]: message ?? undefined }));
  }

  /** On submit: show every message at once and put the cursor on the first. */
  function showErrors(errors: FieldErrors): boolean {
    setFieldErrors(p => ({ ...p, ...errors }));
    const first = FIELDS.find(f => errors[f]);
    if (first) document.getElementById(fieldId(first))?.focus();
    return !first;
  }

  /** A field already showing an error re-checks as it is typed in, so the
   *  message clears as soon as it is fixed. */
  function recheck(f: Field, value: string) {
    if (fieldErrors[f]) setFieldError(f, problem(f, value, false));
  }

  /** aria-invalid + aria-describedby for an input, pointing at its message. */
  function a11y(f: Field) {
    const invalid = !!fieldErrors[f];
    return { id: fieldId(f), "aria-invalid": invalid || undefined, "aria-describedby": invalid ? errorId(f) : undefined };
  }

  const fieldError = (f: Field) =>
    fieldErrors[f] ? <p id={errorId(f)} className="field-error">{fieldErrors[f]}</p> : null;

  /** + Add / Enter in the Authors box. Cleaned, checked, repeats skipped. */
  function addTypedAuthor() {
    const r = addAuthor(authors, newAuthor);
    setFieldError("author", r.error ?? null);
    if (r.error) return;
    if (r.list !== authors) untag("authors");
    setAuthors(r.list);
    setNotes(p => ({ ...p, author: r.note }));
    setNewAuthor("");
  }

  /** Where keyboard focus goes after a × or Undo: the × at this place in the
   *  list (or the one before it), the Undo button when the list is empty. */
  const focusAfter = useRef<number | null>(null);
  const keywordList = useRef<HTMLDivElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const undoCount = useRef(0);
  useLayoutEffect(() => {
    const at = focusAfter.current;
    if (at === null) return;
    focusAfter.current = null;
    // Only when focus was lost with the removed button (mouse or keyboard),
    // never taken from somewhere staff moved to themselves.
    if (document.activeElement && document.activeElement !== document.body) return;
    const xs = keywordList.current?.querySelectorAll<HTMLButtonElement>(".kw-chip-x") ?? [];
    const target = xs.length > 0 ? xs[Math.min(at, xs.length - 1)] : undoButton.current;
    target?.focus();
  }, [keywords, undo]);

  // "Removed … Undo" goes after UNDO_MS, but never while the mouse or the
  // keyboard is on it (WCAG 2.2.1); leaving it starts the full time again.
  useEffect(() => {
    if (!undo || undoHeld) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo, undoHeld]);

  /** The × on a keyword chip, the only way to change the list (errata #80).
   *  A removed keyword is remembered, so it is never added by itself again;
   *  "Removed … Undo" can put it back. */
  function removeKeyword(kw: string) {
    if (tooSoon() || performance.now() - lastChipChange.current < CHIP_GUARD_MS) return;
    const index = keywords.indexOf(kw);
    if (index < 0) return;
    const key = keywordKey(kw);
    lastChipChange.current = performance.now();
    focusAfter.current = index;
    setKeywords(keywords.filter(k => k !== kw));
    setAutoAdded(a => a.filter(k => k !== key));
    if (key) setRemovedKeys(r => [...r.filter(k => k !== key), key].slice(-MAX_REMOVED_KEYWORDS));
    setUndo({ keyword: kw, index, auto: autoAdded.includes(key), id: ++undoCount.current });
    setUndoHeld(false);
  }

  /** Undo: the last removed keyword back in its place, with its auto tag;
   *  it may be added by itself again. Not if it is listed again already, or
   *  the list is full. */
  function undoRemove() {
    if (!undo || tooSoon()) return;
    const back = reinsertKeyword(keywords, undo.keyword, undo.index, MAX_KEYWORDS);
    setUndo(null);
    setUndoHeld(false);
    if (!back) return;
    const key = keywordKey(undo.keyword);
    lastChipChange.current = performance.now();
    setKeywords(back);
    if (undo.auto) setAutoAdded(a => [...a.filter(k => k !== key), key]);
    setRemovedKeys(r => r.filter(k => k !== key));
    // Focus moves to the keyword put back (the Undo button is gone).
    focusAfter.current = Math.min(undo.index, back.length - 1);
  }

  /** A chosen PDF is checked at once: not a PDF or empty → not taken; too
   *  large → kept with a warning, and read as before (manual entry). */
  function choosePdf(file: File | null) {
    if (!file) return;
    const p = pdfFileProblem(file);
    if (p && !p.keep) {
      setFieldError("pdf", p.message);
      return;
    }
    setFieldError("pdf", null);
    setNotes(n => ({ ...n, pdf: p?.message }));
    setPdfFile(file);
  }

  /** Every detail and the abstract, as on Save (the details are on the save
   *  step since errata #82). A name typed but not yet added with Enter still
   *  counts, after the same checks. */
  function detailErrors(typed: { list: string[]; error?: string }): FieldErrors {
    return {
      title: problem("title", form.title, true) ?? undefined,
      // cleanAuthorList: a name saved before the checks existed (Edit study)
      // must be fixed too. Names added in this form always pass it.
      author: typed.error ?? (typed.list.length === 0 ? MSG.authorsRequired : cleanAuthorList(typed.list).error),
      department: problem("department", form.department, true) ?? undefined,
      year: problem("year", form.year, true) ?? undefined,
      adviser: problem("adviser", form.adviser, true) ?? undefined,
    };
  }

  /** What a PDF read found goes into the details (pdfDetails.ts
   *  fillFromPdf): only empty fields and ones still holding an earlier PDF's
   *  value; never what staff typed, never a saved study's (Edit). A filled
   *  value that does not pass validation.ts shows its normal message at once. */
  function applyDetails(found: StudyDetails) {
    const r = fillFromPdf(
      { title: form.title, authors, department: form.department, year: form.year, adviser: form.adviser },
      fromPdf, found,
    );
    setForm(p => ({ ...p, title: r.details.title, department: r.details.department, year: r.details.year, adviser: r.details.adviser }));
    setAuthors(r.details.authors);
    setFromPdf(r.fromPdf);
    setPdfNotes(r.notes);
    const filled = new Set(r.fromPdf);
    setFieldErrors(p => ({
      ...p,
      title: filled.has("title") ? problem("title", r.details.title, false) ?? undefined : p.title,
      author: filled.has("authors") ? cleanAuthorList(r.details.authors).error : p.author,
      year: filled.has("year") ? problem("year", r.details.year, false) ?? undefined : p.year,
      adviser: filled.has("adviser") ? problem("adviser", r.details.adviser, false) ?? undefined : p.adviser,
    }));
  }

  /** Step 1 → read the PDF (or, Edit with no PDF, go straight on). Only the
   *  PDF and the Drive link are on step 1 (errata #82). */
  async function handleSubmit() {
    if (!showErrors({ drive: problem("drive", form.driveLink, true) ?? undefined })) return;

    const driveLink = form.driveLink.trim();
    // Edit study with no PDF chosen: no Drive download (protected files cannot
    // be read anyway); go straight to saving, with the abstract and keywords
    // already in the form — the saved ones, or a PDF's read earlier. The same
    // for a restored draft whose PDF was already read (restoredRead).
    if ((editing || restoredRead) && !pdfFile) {
      setError("");
      setKeptCurrent(true);
      setExtractState("success");
      return;
    }
    setKeptCurrent(false);

    const source = pdfFile ? pdfSource(pdfFile) : `drive:${driveLink}`;
    const sameSource = lastRead.current?.source === source;
    // Back from "Edit details" with the same PDF, and it was read fine last
    // time: keep that result and the edits made to it.
    if (sameSource && lastRead.current?.ok) {
      setError("");
      setExtractState("success");
      return;
    }

    setError("");
    setProgress("");
    setExtractState("extracting");
    const onProgress = (p: ReadProgress) => setProgress(progressText(p));
    let read: StudyRead;
    try {
      read = await (pdfFile ? readFromFile(pdfFile, onProgress) : readFromDrive(driveLink, onProgress));
    } catch (err) {
      // Nothing was read from this PDF: details an earlier PDF put there (still
      // tagged) go, as its abstract does; what staff typed stays.
      if (!sameSource && !editing && !restoredWork) {
        applyDetails({ title: "", authors: [], department: "", year: "", adviser: "", source: {}, notes: {} });
      }
      readFailed(err instanceof Error ? err.message : "Could not read that PDF.", source, sameSource);
      return;
    }
    // The details are filled whatever happened to the abstract: a title page
    // can be read when the abstract cannot (scanned PDFs give nothing).
    applyDetails(read.details);
    if (read.problem) {
      readFailed(read.problem, source, sameSource);
      return;
    }
    {
      const { abstract, keywords } = read;
      setAbstract(abstract);
      // Keywords read from the PDF get the same cleaning as saved ones. They
      // replace the list, so no keyword is tagged "auto" any more; this read
      // gets its own automatic keywords (autoFor differs). Edit study: only
      // when this PDF prints keywords; with none, the saved ones stay, and
      // nothing is ever added by itself there (errata #80).
      const printed = cleanKeywordList(keywords);
      if (!editing || printed.length > 0) {
        setKeywords(printed);
        setAutoAdded([]);
        setUndo(null);
      }
      setExtractState("success");
      lastRead.current = { source, ok: true };
    }
  }

  /** Not a crash: manual entry is the designed fallback (docs/06 §7). Keep
   *  the reason so staff know why the fields are empty. */
  function readFailed(message: string, source: string, sameSource: boolean) {
    setError(message);
    // Same PDF failed again (e.g. Drive still busy): keep what staff typed.
    // Editing: keep the study's current abstract and keywords, never blank them.
    // A restored draft: keep the abstract it brought back (staff's work).
    if (!sameSource && !editing && !restoredWork) {
      setAbstract("");
      setKeywords([]);
      setAutoAdded([]);
      setUndo(null);
    }
    setExtractState("needs_review");
    lastRead.current = { source, ok: false };
  }

  /** Check & save → back to step 1 ("Change PDF"), keeping everything entered so far. */
  function editDetails() {
    setError("");
    setSaveError("");
    setSaveNote("");
    setUndo(null);
    setExtractState("idle");
  }

  async function handleSave(e: MouseEvent) {
    if (tooSoon()) {
      // The step has only just opened, so this click was not aimed at Save. For a
      // page that fits the window, where going to the top moves nothing (errata #72).
      if (guardReason.current !== "typed") return;
      // Keywords were just added from the typed abstract (errata #80). The
      // first Save click in this second is not taken, but not silently: the
      // note near Save says why, and the next Save click is taken. When the
      // box was left by pressing Save, the note is already up: then only that
      // press (begun before the keywords appeared; or Enter / Space) is not
      // taken, and a new press is, even if the first one missed Save as it moved.
      const newPress = e.detail > 0 && savePressAt.current > guardFrom.current;
      if (!saveFreed.current && !(noteAtLeave.current && newPress)) {
        setSaveNote(KEYWORDS_ADDED_NOTE);
        saveFreed.current = true;
        return;
      }
    }
    setSaveNote("");
    // The button is disabled too; this keeps a double tap from slipping through.
    // Not before the studies have loaded: the duplicate check needs them.
    if (mustConfirm || !studiesReady) return;
    // "Confirm & Save" and "Save Manually" both post the study: staff have
    // already checked the details here, so there is no later review step.
    // That makes this the last check: search ranks studies on the abstract,
    // so a study posted without one would almost never be found.
    // Every detail is checked here too: they are on this step (errata #82).
    const typed = newAuthor.trim() ? addAuthor(authors, newAuthor) : { list: authors, error: undefined, note: undefined };
    const checkedAbstract = checkAbstract(abstract);
    const valid = showErrors({ ...detailErrors(typed), abstract: checkedAbstract.error ?? undefined });
    if (!valid) return;
    if (newAuthor.trim()) {
      if (typed.list !== authors) untag("authors");
      setAuthors(typed.list);
      setNotes(p => ({ ...p, author: typed.note }));
      setNewAuthor("");
    }
    setSaveError("");
    setSaving(true);
    setSavedFrom(theses);                             // the library at this click (see savedFrom)
    try {
      await onSave({
        title: checkTitle(form.title).value, authors: typed.list, department: form.department,
        year: Number(checkYear(form.year).value), adviser: checkAdviser(form.adviser).value,
        abstract: checkedAbstract.value, keywords,
        driveLink: form.driveLink.trim(),
      });
      // Saved: the draft is no longer needed (and must not come back).
      left.current = true;
      clearDraft(studyId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the study. Try again.");
      setSaving(false);
      setSavedFrom(null);                             // not saved: the live library again
    }
  }

  /** The line under "Keywords": what the list is and what staff can do with it. */
  const keywordsHint = editing
    ? keywords.length > 0
      ? "Remove any keyword that does not fit. Nothing is added here; a PDF chosen again that prints keywords replaces them."
      : "No keywords saved for this study (they are optional). A PDF chosen again that prints keywords fills them in."
    : autoShown
      ? <>Keywords marked <span className="kw-chip-auto">auto</span> were chosen automatically. Remove any that do not fit.</>
      : keywords.length > 0
        ? "Remove any keyword that does not fit."
        : autoKeyNow() === autoFor
          ? "No keywords were found for this study. Keywords are optional."
          : readSource !== null && !checkAbstract(abstract).error
            ? "Keywords are added automatically once the e-library has loaded."
            : `No keywords yet. They are added automatically from the abstract when you leave the abstract box (${ABSTRACT_MIN_WORDS} words or more).`
  ;
  const titleLength = cleanSpaces(form.title).length;
  const abstractLength = cleanAbstract(abstract).length;

  return (
    <div className="animate-fade-in">
      {/* Back: leave the form (Edit study: Cancel, nothing saved), or return
          from Check & save to step 1 to choose another PDF (all kept) */}
      {extractState !== "extracting" && !saving && (
        <button onClick={extractState === "idle" ? leave : editDetails}
          className="btn btn-outline-green btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={14} />
          {extractState !== "idle" ? "Change PDF" : editing ? "Cancel" : "Back to dashboard"}
        </button>
      )}

      {/* A draft restored after a reload (draft.ts). The PDF file itself
          cannot be kept by a browser; say so instead of pretending. */}
      {draft && (
        <div className="info-pill" role="status">
          <Icon name="info" size={16} />
          <div>
            <p>
              We restored your unsaved study.{" "}
              <button type="button" onClick={onDiscard} className="link-btn">Discard draft</button>
            </p>
            {draft.pdfName && !pdfFile && extractState === "idle" && (
              <p>Choose the PDF again ({draft.pdfName}): a browser cannot keep a chosen file after a reload.</p>
            )}
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="steps-row">
        {steps.map((s, i) => (
          <div key={s.label} className="step-col">
            <div className="step-node-wrap" style={{ opacity: s.active || s.done ? 1 : 0.38 }}>
              <div className={`step-node ${s.done ? "step-node-done" : s.active ? "step-node-active" : "step-node-todo"}`}>
                {s.done ? "✓" : i + 1}
              </div>
              <span className={`step-label ${s.active ? "step-label-active" : "step-label-todo"}`}>{s.label}</span>
            </div>
            {i < 2 && <div className={`step-line ${s.done ? "step-line-done" : "step-line-todo"}`} />}
          </div>
        ))}
      </div>

      {/* Form card */}
      {(extractState === "idle" || extractState === "extracting") && (
        <div className="card card-pad-xl card-accent card-mb">
          <h2 className="form-title">{editing ? "Edit study" : "Register a study"}</h2>
          <p className="form-sub">
            {editing
              ? "Continue to change the details. Choosing the PDF is optional: only do it to read the abstract and keywords again (details you have are never replaced)."
              : "Choose the study's PDF and paste its Drive link. The title, authors, year, adviser, abstract and keywords are read from the PDF; you check them on the next step."}
          </p>

          {/* Main source: the PDF from this computer. Protected (view-only) Drive
              files cannot be downloaded through the Drive API (docs/06 §7). */}
          <div className="field-mb">
            <label className="field-label" htmlFor={fieldId("pdf")}>Study PDF{editing && <span className="field-optional"> (optional)</span>}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden
                onChange={e => { choosePdf(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              <button type="button" onClick={() => fileInput.current?.click()} {...a11y("pdf")}
                disabled={extractState === "extracting"} className="paste-btn" style={{ padding: "8px 12px" }}>
                <Icon name="file" size={16} />
                {pdfFile ? "Choose a different PDF" : "Choose PDF from this computer"}
              </button>
              {pdfFile && (
                <span className="kw-chip">
                  {pdfFile.name}
                  <button onClick={() => { setPdfFile(null); setNotes(n => ({ ...n, pdf: undefined })); }} disabled={extractState === "extracting"}
                    className="kw-chip-x" aria-label="Remove the chosen PDF">
                    <Icon name="x" size={12} strokeWidth={2.5} />
                  </button>
                </span>
              )}
            </div>
            {fieldError("pdf")}
            {notes.pdf && <p className="field-note">{notes.pdf}</p>}
            <p className="hint">
              {pdfFile
                ? editing
                  ? "The abstract and keywords will be read from this PDF. Details the study already has are kept."
                  : "The details, abstract and keywords will be read from this PDF."
                : editing
                  ? "No PDF chosen: the current details, abstract and keywords are kept (you can still edit them on the next step)."
                  : "Choose the study's PDF from this computer to fill in the details, abstract and keywords."}
            </p>
          </div>

          {/* Drive link — saved for staff; read only when no PDF is chosen */}
          <div className="field-mb">
            <label className="field-label" htmlFor={fieldId("drive")}>
              Google Drive Link <span className="field-req">*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input value={form.driveLink} {...a11y("drive")}
                  onChange={e => { setForm(p => ({ ...p, driveLink: e.target.value })); recheck("drive", e.target.value); }}
                  onBlur={e => setFieldError("drive", problem("drive", e.target.value, false))}
                  placeholder="https://drive.google.com/file/d/..."
                  disabled={extractState === "extracting"} className="input" />
              </div>
              <button onClick={() => {
                if (navigator.clipboard) navigator.clipboard.readText().then(t => {
                  setForm(p => ({ ...p, driveLink: t }));
                  setFieldError("drive", problem("drive", t, false));
                }).catch(() => {});
              }}
                disabled={extractState === "extracting"}
                className="paste-btn"
                title="Paste from clipboard">
                <Icon name="file" size={16} />
                Paste
              </button>
            </div>
            {fieldError("drive")}
            <p className="hint">
              {pdfFile || editing
                ? "Share it as Isabela State University → Viewer, with download limited to Editors (docs/08 §7b). Students read it in Google's viewer; they cannot download it."
                : "Share it as Isabela State University → Viewer, with download limited to Editors (docs/08 §7b). Students read it in Google's viewer; they cannot download it. With no PDF chosen, the app tries to read the file from Drive (not possible for protected files)."}
            </p>
          </div>
        </div>
      )}

      {/* Extracting state */}
      {extractState === "extracting" && (
        <div className="animate-fade-in extract-panel">
          <div className="spin-ring">
            <div className="animate-spin spin-ring-inner" />
            <div className="spin-core"><Icon name="file" size={18} /></div>
          </div>
          <div className="extract-title">Reading PDF and filling in details...</div>
          <div className="extract-sub">{pdfFile ? "From this computer" : "From Google Drive"}</div>
          {/* How far it has got (errata #82). Not a live region: it changes
              many times a second while downloading. */}
          <div className="extract-progress">{progress || "Starting the PDF reader…"}</div>
          <div className="progress-track">
            <div className="progress-fill" />
          </div>
        </div>
      )}

      {/* Result states */}
      {(extractState === "success" || extractState === "needs_review") && (
        <div className="animate-slide-up">
          {/* Status bar */}
          <div className={`status-bar ${extractState === "success" ? "status-bar-success" : "status-bar-review"}`}>
            <div className={`status-icon ${extractState === "success" ? "status-icon-success" : "status-icon-review"}`}>
              {extractState === "success"
                ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              }
            </div>
            <div>
              <div className={`status-title ${extractState === "success" ? "status-title-success" : "status-title-review"}`}>
                {extractState === "success"
                  ? (keptCurrent ? "Ready to save:" : "Details filled in:")
                  : editing ? "Could not read the PDF." : "Could not read PDF completely. Please fill in:"}
              </div>
              <div className="status-sub">
                {extractState === "success"
                  ? (keptCurrent ? "Current details, abstract and keywords kept — edit if needed" : "Details, abstract and keywords read from the PDF — check them and fill in what is empty")
                  : editing ? "The current details, abstract and keywords are kept — edit if needed" : "Fill in what is empty and type or paste the abstract. Keywords are added from it automatically."}
              </div>
            </div>
          </div>

          {extractState === "needs_review" && error && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          {/* The study details (errata #82): read from the PDF where it gives
              them, tagged "from PDF" (text, so screen readers say it too);
              empty where it does not, for staff to type. Checked on Save. */}
          <div className="review-card">
            <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
              {fromPdf.length > 0
                ? <>Details marked <span className="pdf-tag">from PDF</span> were read from the PDF. Check them against the study's title page. Type anything left empty.</>
                : "Fill in the study's details as printed on its title page."}
            </p>

            {/* Title */}
            <div className="field-mb">
              <label className="field-label" htmlFor={fieldId("title")}>Title <span className="field-req">*</span>{tag("title")}</label>
              <input value={form.title} {...a11y("title")}
                onChange={e => { setForm(p => ({ ...p, title: e.target.value })); untag("title"); recheck("title", e.target.value); }}
                onBlur={e => setFieldError("title", problem("title", e.target.value, false))}
                placeholder="Enter full study title" className="input" />
              {fieldError("title")}
              {pdfNotes.title && <p className="field-note">{pdfNotes.title}</p>}
              {titleLength >= TITLE_COUNTER_FROM && <p className="hint">{titleLength} / {TITLE_MAX}</p>}
            </div>

            {/* Authors */}
            <div className="field-mb">
              <label className="field-label" htmlFor={fieldId("author")}>Authors <span className="field-req">*</span>{tag("authors")}</label>
              {authors.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {authors.map(a => (
                    <span key={a} className="kw-chip">
                      {a}
                      <button onClick={() => { setAuthors(p => p.filter(x => x !== a)); untag("authors"); setFieldError("author", null); }}
                        className="kw-chip-x" aria-label={`Remove author ${a}`}>
                        <Icon name="x" size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newAuthor} {...a11y("author")}
                  onChange={e => { setNewAuthor(e.target.value); setNotes(p => ({ ...p, author: undefined })); recheck("author", e.target.value); }}
                  onKeyDown={e => { if (e.key === "Enter") addTypedAuthor(); }}
                  placeholder="e.g. Juan Dela Cruz" className="input" />
                <button onClick={addTypedAuthor} disabled={authors.length >= MAX_AUTHORS} className="chip-add">
                  + Add
                </button>
              </div>
              {fieldError("author")}
              {notes.author && <p className="field-note">{notes.author}</p>}
              {pdfNotes.authors && <p className="field-note">{pdfNotes.authors}</p>}
              <p className="hint">
                {authors.length >= MAX_AUTHORS ? MSG.authorsMax : "Add one author at a time, in the order listed on the study."}
              </p>
            </div>

            {/* Dept + Year */}
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor={fieldId("department")}>Department <span className="field-req">*</span>{tag("department")}</label>
                <select value={form.department} {...a11y("department")}
                  onChange={e => { setForm(p => ({ ...p, department: e.target.value })); untag("department"); setFieldError("department", null); }}
                  className="input" style={{ color: form.department ? undefined : "var(--text-subtle)", appearance: "none" }}>
                  <option value="">Select dept.</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {fieldError("department")}
                {pdfNotes.department && <p className="field-note">{pdfNotes.department}</p>}
              </div>
              <div>
                <label className="field-label" htmlFor={fieldId("year")}>Year completed <span className="field-req">*</span>{tag("year")}</label>
                {/* Only the year is stored, so a text box, not a date picker.
                    Letters, spaces and symbols typed or pasted are dropped. */}
                <input value={form.year} {...a11y("year")} type="text" inputMode="numeric" autoComplete="off"
                  onChange={e => { const year = yearInput(e.target.value); setForm(p => ({ ...p, year })); untag("year"); recheck("year", year); }}
                  onBlur={e => setFieldError("year", problem("year", e.target.value, false))}
                  placeholder={`e.g. ${THIS_YEAR - 1}`} className="input" />
                {fieldError("year")}
                {pdfNotes.year && <p className="field-note">{pdfNotes.year}</p>}
              </div>
            </div>

            {/* Adviser */}
            <div>
              <label className="field-label" htmlFor={fieldId("adviser")}>Adviser <span className="field-req">*</span>{tag("adviser")}</label>
              <input value={form.adviser} {...a11y("adviser")}
                onChange={e => { setForm(p => ({ ...p, adviser: e.target.value })); untag("adviser"); recheck("adviser", e.target.value); }}
                onBlur={e => setFieldError("adviser", problem("adviser", e.target.value, false))}
                placeholder="e.g. Dr. Maria Santos" className="input" />
              {fieldError("adviser")}
              {pdfNotes.adviser && <p className="field-note">{pdfNotes.adviser}</p>}
            </div>
          </div>

          {/* Editable abstract */}
          <div className="review-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="field-label" htmlFor={fieldId("abstract")} style={{ marginBottom: 0 }}>Abstract</label>
              <span className="overlap-lbl">Editable</span>
            </div>
            <textarea value={abstract} {...a11y("abstract")}
              onChange={e => { setAbstract(e.target.value); recheck("abstract", e.target.value); }}
              onBlur={e => abstractLeft(e.target.value, e.relatedTarget)}
              rows={5} className="textarea" />
            {fieldError("abstract")}
            <div className="word-count">
              {countWords(abstract)} words
              {abstractLength >= ABSTRACT_COUNTER_FROM && ` · ${abstractLength.toLocaleString("en-US")} / ${ABSTRACT_MAX.toLocaleString("en-US")} characters`}
            </div>
          </div>

          {/* Keywords: only removed here, never added by hand (errata #80). The
              automatic ones come from the PDF read or the typed abstract. */}
          <div className="review-card">
            <span className="field-label" id="register-keywords-label" style={{ marginBottom: 4 }}>Keywords</span>
            <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
              {keywordsHint}
            </p>
            {keywords.length > 0 && (
              <div ref={keywordList} role="group" aria-labelledby="register-keywords-label"
                style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {keywords.map(kw => {
                  const auto = autoAdded.includes(keywordKey(kw));
                  return (
                    <span key={kw} className={`kw-chip${auto ? " kw-chip--auto" : ""}`}>
                      {kw}
                      {auto && <span className="kw-chip-auto" aria-hidden="true">auto</span>}
                      {auto && <span className="sr-only">, added automatically</span>}
                      <button type="button" onClick={() => removeKeyword(kw)} className="kw-chip-x"
                        aria-label={`Remove keyword ${kw}${auto ? ", added automatically" : ""}`}>
                        <Icon name="x" size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Always in the page, so screen readers announce what appears in it. */}
            <div role="status" aria-live="polite" className="kw-undo-region"
              onMouseEnter={() => setUndoHeld(true)} onMouseLeave={() => setUndoHeld(false)}
              onFocus={() => setUndoHeld(true)} onBlur={() => setUndoHeld(false)}>
              {undo && (
                <p key={undo.id} className="kw-undo">
                  Removed <strong>{undo.keyword}</strong>.{" "}
                  <button ref={undoButton} type="button" onClick={undoRemove} className="link-btn">Undo</button>
                </p>
              )}
            </div>
            <p className="sr-only" role="status" aria-live="polite">{addedAnnouncement}</p>
          </div>

          {/* Originality check: at most 3 matches, grouped by level. */}
          {SIMILARITY_BOXES.map(box => {
            const group = matches.filter(m => m.level === box.level);
            if (group.length === 0) return null;
            return (
              <div key={box.level} className={box.className} role={box.level === "duplicate" ? "alert" : undefined}>
                <div className="sim-box-heading">
                  <Icon name={box.level === "related" ? "info" : "alert"} size={16} />
                  {box.heading(group.length)}
                </div>
                {group.map(m => {
                  const s = byId.get(m.id);
                  if (!s) return null;
                  const open = detailsId === m.id;
                  return (
                    <div key={m.id} className="sim-match">
                      <div className="sim-match-title">{s.title}</div>
                      <span className="result-meta">{s.year} · {originalityReason(m)}</span>
                      <SharedTerms terms={m.sharedTerms} />
                      <div className="sim-match-actions">
                        <button type="button" onClick={() => setDetailsId(open ? null : m.id)} className="drive-btn" aria-expanded={open}>
                          {open ? "Hide details" : "Show details"}
                        </button>
                        <a href={withAccount(s.driveLink, viewerEmail)} target="_blank" rel="noreferrer" className="drive-btn">
                          <Icon name="external" size={13} />
                          Open in Drive
                        </a>
                      </div>
                      {open && (
                        <div className="sim-details">
                          <dl className="study-details">
                            <dt>Author{s.authors.length === 1 ? "" : "s"}</dt>
                            <dd>{s.authors.length > 0 ? s.authors.join("; ") : <span className="study-details-empty">Not recorded</span>}</dd>
                            <dt>Adviser</dt>
                            <dd>{s.adviser}</dd>
                            <dt>Department</dt>
                            <dd>{s.department}</dd>
                            {s.keywords.length > 0 && <>
                              <dt>Keywords</dt>
                              <dd>{s.keywords.join(", ")}</dd>
                            </>}
                          </dl>
                          <span className="overline-label">Abstract</span>
                          <p className="preview-text">{s.abstract}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                {box.level === "duplicate" && (
                  <label className="sim-confirm">
                    <input type="checkbox" checked={!mustConfirm}
                      onChange={e => setCheckedDuplicates(e.target.checked ? duplicateKey : "")} />
                    I checked — register anyway
                  </label>
                )}
              </div>
            );
          })}

          {saveError && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={16} />
              {saveError}
            </div>
          )}

          <button onClick={handleSave} onPointerDown={() => { savePressAt.current = performance.now(); }}
            disabled={saving || mustConfirm || !studiesReady} className="btn-submit btn-submit--save"
            aria-describedby={!studiesReady ? "register-loading-hint" : mustConfirm ? "register-confirm-hint" : undefined}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {saving ? "Saving..." : editing ? "Save changes" : extractState === "success" ? "Confirm & Save" : "Save Manually"}
          </button>
          {/* A Save click not taken because keywords were just added (errata #80). */}
          <p className={saveNote ? "hint sim-confirm-hint" : "sr-only"} role="status" aria-live="polite">{saveNote}</p>
          {/* The originality check and automatic keywords need the stored studies:
              after a reload the save step can open before they arrive. */}
          {!studiesReady && (
            <p id="register-loading-hint" className="hint sim-confirm-hint" role="status">
              {studiesError ?? "Loading the e-library to check for duplicates…"}
            </p>
          )}
          {studiesReady && mustConfirm && (
            <p id="register-confirm-hint" className="hint sim-confirm-hint">Tick “I checked — register anyway” above to save.</p>
          )}
        </div>
      )}

      {/* Submit button */}
      {extractState === "idle" && (
        <button onClick={handleSubmit} className="btn-submit btn-submit--read">
          <Icon name="file" size={18} />
          {editing && !pdfFile ? "Continue" : "Read PDF & continue"}
        </button>
      )}
    </div>
  );
}
