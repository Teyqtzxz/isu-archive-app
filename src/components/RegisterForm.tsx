import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtractionState, NewThesis, Thesis } from "../types";
import { DEPARTMENTS, registeredAtISO } from "../types";
import { MAX_PAGES, extractFromDrive, extractFromFile } from "../extractPdf";
import {
  ABSTRACT_COUNTER_FROM, ABSTRACT_MAX, MAX_AUTHORS, MAX_KEYWORDS, MSG, TITLE_COUNTER_FROM, TITLE_MAX,
  addAuthor, addKeywords, checkAbstract, checkAdviser, checkAuthor, checkTitle, checkYear, cleanAbstract,
  cleanAuthorList, cleanKeywordList, cleanSpaces, countWords, pdfFileProblem, validateDriveLink, yearInput,
} from "../validation";
import { buildOriginalityIndex, originalityCheck, originalityReason, type SimilarityLevel } from "../similarity";
import { suggestKeywords, suggestionSource, trainKeywordModel } from "../keywordModel";
import { clearDraft, readDraft, sameAsStart, writeDraft, type DraftFields, type RegisterDraft } from "../draft";
import { DeptBadge, Icon, SharedTerms, withAccount } from "./shared";

/** The Academic Year box starts at this year; any past year can be typed. */
const THIS_YEAR = new Date().getFullYear();

/** Every input that can show a message under it, in screen order: on submit
 *  the cursor goes to the first one with an error. */
const FIELDS = ["pdf", "drive", "title", "author", "department", "year", "adviser", "abstract", "keyword"] as const;
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
   *  originality check and the keyword suggestions are computed from it. */
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
      abstract: cleanAbstract(study.abstract), keywords: cleanKeywordList(study.keywords), newKw: "",
    }
    : {
      form: { driveLink: "", title: "", department: "", year: String(THIS_YEAR), adviser: "" },
      authors: [], newAuthor: "", abstract: "", keywords: [], newKw: "",
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
  /** Edit mode, no PDF chosen: the save step shows the abstract and keywords
   *  already in the form instead of ones just read from a PDF. */
  const [keptCurrent, setKeptCurrent] = useState(draft?.keptCurrent ?? false);
  const [newKw, setNewKw] = useState(init.newKw);
  /** Why the PDF could not be read (shown on the save step). */
  const [error, setError] = useState(draft?.readState === "needs_review" ? draft.readError : "");
  /** One message per input, shown under it. The rules are in validation.ts. */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  /** Grey notes, not errors: a repeat that was skipped, a PDF too large to read. */
  const [notes, setNotes] = useState<{ pdf?: string; author?: string; keyword?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
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
  const fieldsNow: DraftFields = { form, authors, newAuthor, abstract, keywords, newKw };
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
      v: 1, uid, studyId, form, authors, newAuthor, abstract, keywords, newKw,
      step: readState ? "save" : "details", readState,
      keptCurrent, readError: readState === "needs_review" ? error : "",
      lastRead: lastRead.current, pdfName: unreadPdf, baseUpdatedAt,
    });
  }, [changed, uid, studyId, form, authors, newAuthor, abstract, keywords, newKw, readState,
    keptCurrent, error, unreadPdf, baseUpdatedAt]);

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
  const originalityIndex = useMemo(() => buildOriginalityIndex(theses), [theses]);
  const byId = useMemo(() => new Map(theses.map(t => [t.id, t])), [theses]);
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

  // Keyword model (keywordModel.ts, docs/15): trained once per data change on
  // every stored study except this one (Edit study must not learn its own
  // keywords); suggestions only on the save step, never added automatically.
  const keywordModel = useMemo(() => trainKeywordModel(theses, { excludeId: study?.id }), [theses, study?.id]);
  const suggestions = useMemo(() => onSaveStep
    ? suggestKeywords(keywordModel, { title: draftTitle, abstract, keywords })
    : [], [onSaveStep, keywordModel, draftTitle, abstract, keywords]);

  const steps = [
    { label: editing ? "Edit study" : "Fill Details", active: extractState === "idle" || extractState === "extracting", done: extractState !== "idle" },
    { label: "Processing", active: extractState === "extracting", done: extractState === "success" || extractState === "needs_review" },
    { label: "Save", active: extractState === "success" || extractState === "needs_review", done: false },
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
      case "keyword": return blank ? null : addKeywords(keywords, value).error ?? null;
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
    setAuthors(r.list);
    setNotes(p => ({ ...p, author: r.note }));
    setNewAuthor("");
  }

  /** + Add / Enter in the Keywords box. "rice, soil" adds two. */
  function addTypedKeywords() {
    const r = addKeywords(keywords, newKw);
    setFieldError("keyword", r.error ?? null);
    if (r.error) return;
    setKeywords(r.list);
    setNotes(p => ({ ...p, keyword: r.note }));
    setNewKw("");
  }

  /** A suggested keyword chip: added exactly as if typed and + Add pressed. */
  function addSuggestedKeyword(keyword: string) {
    const r = addKeywords(keywords, keyword);
    setFieldError("keyword", r.error ?? null);
    if (r.error) return;
    setKeywords(r.list);
    setNotes(p => ({ ...p, keyword: r.note }));
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

  async function handleSubmit() {
    // A name typed but not yet added with Enter still counts, after the same checks.
    const typed = newAuthor.trim() ? addAuthor(authors, newAuthor) : { list: authors, error: undefined, note: undefined };
    const valid = showErrors({
      drive: problem("drive", form.driveLink, true) ?? undefined,
      title: problem("title", form.title, true) ?? undefined,
      // cleanAuthorList: a name saved before the checks existed (Edit study)
      // must be fixed too. Names added in this form always pass it.
      author: typed.error ?? (typed.list.length === 0 ? MSG.authorsRequired : cleanAuthorList(typed.list).error),
      department: problem("department", form.department, true) ?? undefined,
      year: problem("year", form.year, true) ?? undefined,
      adviser: problem("adviser", form.adviser, true) ?? undefined,
    });
    if (!valid) return;
    if (newAuthor.trim()) {
      setAuthors(typed.list);
      setNotes(p => ({ ...p, author: typed.note }));
      setNewAuthor("");
    }

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
    setExtractState("extracting");
    try {
      const { abstract, keywords } = await (pdfFile ? extractFromFile(pdfFile) : extractFromDrive(driveLink));
      setAbstract(abstract);
      // Keywords read from the PDF get the same cleaning as typed ones.
      setKeywords(cleanKeywordList(keywords));
      setExtractState("success");
      lastRead.current = { source, ok: true };
    } catch (err) {
      // Not a crash: manual entry is the designed fallback (docs/06 §7).
      // Keep the reason so staff know why the fields are empty.
      setError(err instanceof Error ? err.message : "Could not read that PDF.");
      // Same PDF failed again (e.g. Drive still busy): keep what staff typed.
      // Editing: keep the study's current abstract and keywords, never blank them.
      // A restored draft: keep the abstract it brought back (staff's work).
      if (!sameSource && !editing && !restoredWork) {
        setAbstract("");
        setKeywords([]);
      }
      setExtractState("needs_review");
      lastRead.current = { source, ok: false };
    }
  }

  /** Review → back to the details form, keeping everything entered so far. */
  function editDetails() {
    setError("");
    setSaveError("");
    setExtractState("idle");
  }

  async function handleSave() {
    // The button is disabled too; this keeps a double tap from slipping through.
    // Not before the studies have loaded: the duplicate check needs them.
    if (mustConfirm || !studiesReady) return;
    // "Confirm & Save" and "Save Manually" both post the study: staff have
    // already checked the details here, so there is no later review step.
    // That makes this the last check: search ranks studies on the abstract,
    // so a study posted without one would almost never be found.
    const checkedAbstract = checkAbstract(abstract);
    // A keyword typed but not yet added still counts, after the same checks.
    const typed = newKw.trim() ? addKeywords(keywords, newKw) : { list: keywords, error: undefined, note: undefined };
    const valid = showErrors({ abstract: checkedAbstract.error ?? undefined, keyword: typed.error });
    if (!valid) return;
    if (newKw.trim()) {
      setKeywords(typed.list);
      setNotes(p => ({ ...p, keyword: typed.note }));
      setNewKw("");
    }
    setSaveError("");
    setSaving(true);
    try {
      await onSave({
        title: checkTitle(form.title).value, authors, department: form.department,
        year: Number(checkYear(form.year).value), adviser: checkAdviser(form.adviser).value,
        abstract: checkedAbstract.value, keywords: typed.list,
        driveLink: form.driveLink.trim(),
      });
      // Saved: the draft is no longer needed (and must not come back).
      left.current = true;
      clearDraft(studyId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the study. Try again.");
      setSaving(false);
    }
  }

  const titleLength = cleanSpaces(form.title).length;
  const abstractLength = cleanAbstract(abstract).length;

  return (
    <div className="animate-fade-in">
      {/* Back: leave the form (Edit study: Cancel, nothing saved), or return
          from review to fix the details */}
      {extractState !== "extracting" && !saving && (
        <button onClick={extractState === "idle" ? leave : editDetails}
          className="btn btn-outline-green btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={14} />
          {extractState !== "idle" ? "Edit details" : editing ? "Cancel" : "Back to dashboard"}
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
              ? "Change the details and continue. Choosing the PDF is optional: only do it to read the abstract and keywords again."
              : "Choose the study's PDF, paste its Drive link and fill in the details. The abstract and keywords are read from the PDF."}
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
                ? "The abstract and keywords will be read from this PDF."
                : editing
                  ? "No PDF chosen: the current abstract and keywords are kept (you can still edit them on the next step)."
                  : "Choose the study's PDF from this computer to fill in the abstract and keywords."}
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

          {/* Title */}
          <div className="field-mb">
            <label className="field-label" htmlFor={fieldId("title")}>Title <span className="field-req">*</span></label>
            <input value={form.title} {...a11y("title")}
              onChange={e => { setForm(p => ({ ...p, title: e.target.value })); recheck("title", e.target.value); }}
              onBlur={e => setFieldError("title", problem("title", e.target.value, false))}
              placeholder="Enter full study title" disabled={extractState === "extracting"} className="input" />
            {fieldError("title")}
            {titleLength >= TITLE_COUNTER_FROM && <p className="hint">{titleLength} / {TITLE_MAX}</p>}
          </div>

          {/* Authors */}
          <div className="field-mb">
            <label className="field-label" htmlFor={fieldId("author")}>Authors <span className="field-req">*</span></label>
            {authors.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {authors.map(a => (
                  <span key={a} className="kw-chip">
                    {a}
                    <button onClick={() => { setAuthors(p => p.filter(x => x !== a)); setFieldError("author", null); }} disabled={extractState === "extracting"}
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
                placeholder="e.g. Juan Dela Cruz" disabled={extractState === "extracting"} className="input" />
              <button onClick={addTypedAuthor} disabled={extractState === "extracting" || authors.length >= MAX_AUTHORS} className="chip-add">
                + Add
              </button>
            </div>
            {fieldError("author")}
            {notes.author && <p className="field-note">{notes.author}</p>}
            <p className="hint">
              {authors.length >= MAX_AUTHORS ? MSG.authorsMax : "Add one author at a time, in the order listed on the study."}
            </p>
          </div>

          {/* Dept + Year */}
          <div className="form-grid-2">
            <div>
              <label className="field-label" htmlFor={fieldId("department")}>Department <span className="field-req">*</span></label>
              <select value={form.department} {...a11y("department")}
                onChange={e => { setForm(p => ({ ...p, department: e.target.value })); setFieldError("department", null); }}
                disabled={extractState === "extracting"}
                className="input" style={{ color: form.department ? undefined : "var(--text-subtle)", appearance: "none" }}>
                <option value="">Select dept.</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {fieldError("department")}
            </div>
            <div>
              <label className="field-label" htmlFor={fieldId("year")}>Academic Year</label>
              {/* Only the year is stored, so a text box, not a date picker.
                  Letters, spaces and symbols typed or pasted are dropped. */}
              <input value={form.year} {...a11y("year")} type="text" inputMode="numeric" autoComplete="off"
                onChange={e => { const year = yearInput(e.target.value); setForm(p => ({ ...p, year })); recheck("year", year); }}
                onBlur={e => setFieldError("year", problem("year", e.target.value, false))}
                placeholder={String(THIS_YEAR)} disabled={extractState === "extracting"} className="input" />
              {fieldError("year")}
            </div>
          </div>

          {/* Adviser */}
          <div>
            <label className="field-label" htmlFor={fieldId("adviser")}>Adviser <span className="field-req">*</span></label>
            <input value={form.adviser} {...a11y("adviser")}
              onChange={e => { setForm(p => ({ ...p, adviser: e.target.value })); recheck("adviser", e.target.value); }}
              onBlur={e => setFieldError("adviser", problem("adviser", e.target.value, false))}
              placeholder="e.g. Dr. Maria Santos" disabled={extractState === "extracting"} className="input" />
            {fieldError("adviser")}
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
          <div className="extract-sub">pdf.js · {pdfFile ? "From this computer" : "From Google Drive"} · Scanning pages 1–{MAX_PAGES}</div>
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
                  ? (keptCurrent ? "Current abstract and keywords kept — edit if needed" : "Abstract and keywords extracted — edit if needed")
                  : editing ? "The current abstract and keywords are kept — edit if needed" : "Manual entry required for abstract and keywords"}
              </div>
            </div>
          </div>

          {extractState === "needs_review" && error && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          {/* Thesis summary: shown as it will be saved */}
          <div className="review-card">
            <p className="review-title">{checkTitle(form.title).value}</p>
            <p className="result-meta" style={{ marginBottom: 8 }}>{authors.join("; ")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <DeptBadge dept={form.department} small />
              <span className="result-meta">{form.year} · {checkAdviser(form.adviser).value}</span>
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
              onBlur={e => setFieldError("abstract", problem("abstract", e.target.value, false))}
              rows={5} className="textarea" />
            {fieldError("abstract")}
            <div className="word-count">
              {countWords(abstract)} words
              {abstractLength >= ABSTRACT_COUNTER_FROM && ` · ${abstractLength.toLocaleString("en-US")} / ${ABSTRACT_MAX.toLocaleString("en-US")} characters`}
            </div>
          </div>

          {/* Suggested keywords (keyword model): click to add, never automatic. */}
          {suggestions.length > 0 && (
            <div className="review-card">
              <span className="field-label" id="register-suggested-label" style={{ marginBottom: 4 }}>Suggested keywords</span>
              <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Click one to add it. Learned from the keywords of earlier studies, or taken from this abstract.
              </p>
              <div className="suggest-list" role="group" aria-labelledby="register-suggested-label">
                {suggestions.map(s => (
                  <button key={s.key} type="button" onClick={() => addSuggestedKeyword(s.keyword)}
                    disabled={keywords.length >= MAX_KEYWORDS} className="suggest-chip"
                    aria-label={`Add keyword ${s.keyword}, ${suggestionSource(s)}`}>
                    <span className="suggest-chip-text">+ {s.keyword}</span>
                    <span className={`suggest-chip-source${s.source === "learned" ? " suggest-chip-source--learned" : ""}`}>{suggestionSource(s)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keywords chips */}
          <div className="review-card">
            <label className="field-label" htmlFor={fieldId("keyword")} style={{ marginBottom: 10 }}>Keywords</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {keywords.map(kw => (
                <span key={kw} className="kw-chip">
                  {kw}
                  <button onClick={() => setKeywords(p => p.filter(k => k !== kw))} className="kw-chip-x" aria-label={`Remove keyword ${kw}`}>
                    <Icon name="x" size={12} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newKw} {...a11y("keyword")}
                onChange={e => { setNewKw(e.target.value); setNotes(p => ({ ...p, keyword: undefined })); recheck("keyword", e.target.value); }}
                onKeyDown={e => { if (e.key === "Enter") addTypedKeywords(); }}
                placeholder="Add a keyword and press Enter" className="input" style={{ padding: "8px 12px", fontSize: 13 }} />
              <button onClick={addTypedKeywords} disabled={keywords.length >= MAX_KEYWORDS} className="chip-add">
                + Add
              </button>
            </div>
            {fieldError("keyword")}
            {notes.keyword && <p className="field-note">{notes.keyword}</p>}
            {keywords.length >= MAX_KEYWORDS && <p className="hint">{MSG.keywordsMax}</p>}
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

          <button onClick={handleSave} disabled={saving || mustConfirm || !studiesReady} className="btn-submit"
            aria-describedby={!studiesReady ? "register-loading-hint" : mustConfirm ? "register-confirm-hint" : undefined}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {saving ? "Saving..." : editing ? "Save changes" : extractState === "success" ? "Confirm & Save" : "Save Manually"}
          </button>
          {/* The originality check and suggestions need the stored studies:
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
        <button onClick={handleSubmit} className="btn-submit">
          <Icon name="file" size={18} />
          {editing && !pdfFile ? "Continue" : "Read PDF & continue"}
        </button>
      )}
    </div>
  );
}
