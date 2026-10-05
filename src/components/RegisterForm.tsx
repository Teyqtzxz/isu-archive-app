import { useRef, useState } from "react";
import type { ExtractionState, NewThesis, ThesisStatus } from "../types";
import { DEPARTMENTS } from "../types";
import { ADVISERS } from "../data";
import { MAX_PAGES, extractFromDrive, extractFromFile, validateDriveLink } from "../extractPdf";
import { DeptBadge, Icon } from "./shared";

/** Academic year options: this year back ten years, computed so the list never
 *  goes stale (it used to be hardcoded 2025–2020, which shut out 2026 theses). */
const THIS_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => THIS_YEAR - i);

export function RegisterForm({ onBack, onSave }: {
  onBack: () => void;
  /** Persists the thesis. Rejects on failure so the form can show the error. */
  onSave: (thesis: NewThesis, status: ThesisStatus) => Promise<void>;
}) {
  const [extractState, setExtractState] = useState<ExtractionState>("idle");
  const [form, setForm] = useState({ driveLink: "", title: "", department: "", year: String(THIS_YEAR), adviser: "" });
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  /** Backup source (docs/06 §7): a PDF picked from this computer, read without Drive. */
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The last PDF read and how it went, so "Edit details" → continue does not
   *  download the same file again or wipe the staff member's edits. */
  const lastRead = useRef<{ source: string; ok: boolean } | null>(null);

  const steps = [
    { label: "Fill Details", active: extractState === "idle" || extractState === "extracting", done: extractState !== "idle" },
    { label: "Processing", active: extractState === "extracting", done: extractState === "success" || extractState === "needs_review" },
    { label: "Review & Save", active: extractState === "success" || extractState === "needs_review", done: false },
  ];

  async function handleSubmit() {
    if (!form.driveLink || !form.title || !form.department || !form.adviser) {
      setError("Please fill in all required fields.");
      return;
    }
    // Validate before downloading anything (docs/06 §6).
    const invalid = validateDriveLink(form.driveLink);
    if (invalid) { setError(invalid); return; }

    const source = pdfFile
      ? `file:${pdfFile.name}:${pdfFile.size}:${pdfFile.lastModified}`
      : `drive:${form.driveLink.trim()}`;
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
      const { abstract, keywords } = await (pdfFile ? extractFromFile(pdfFile) : extractFromDrive(form.driveLink));
      setAbstract(abstract);
      setKeywords(keywords);
      setExtractState("success");
      lastRead.current = { source, ok: true };
    } catch (err) {
      // Not a crash: manual entry is the designed fallback (docs/06 §7).
      // Keep the reason so staff know why the fields are empty.
      setError(err instanceof Error ? err.message : "Could not read that PDF.");
      // Same PDF failed again (e.g. Drive still busy): keep what staff typed.
      if (!sameSource) {
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
    // The button decides the status (docs/02 §4): "Confirm & Save" after a
    // successful read → ARCHIVED; "Save Manually" after a failed one →
    // NEEDS_REVIEW, so it shows up under Pending Review.
    const status: ThesisStatus = extractState === "success" ? "ARCHIVED" : "NEEDS_REVIEW";
    setSaveError("");
    setSaving(true);
    try {
      await onSave({
        title: form.title, department: form.department,
        year: parseInt(form.year), adviser: form.adviser, abstract, keywords,
        driveLink: form.driveLink,
      }, status);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the thesis. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Back: leave the form, or return from review to fix the details */}
      {extractState !== "extracting" && !saving && (
        <button onClick={extractState === "idle" ? onBack : editDetails}
          className="btn btn-outline-green btn-sm" style={{ marginBottom: 14 }}>
          <Icon name="arrowLeft" size={14} />
          {extractState === "idle" ? "Back to dashboard" : "Edit details"}
        </button>
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
          <h2 className="form-title">Register a thesis</h2>
          <p className="form-sub">Paste the Drive link and fill in the details. The abstract and keywords are read from the PDF.</p>

          {/* Drive link */}
          <div className="field-mb">
            <label className="field-label">
              Google Drive Link <span className="field-req">*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input value={form.driveLink} onChange={e => setForm(p => ({ ...p, driveLink: e.target.value }))}
                  placeholder="https://drive.google.com/file/d/..."
                  disabled={extractState === "extracting"} className="input" />
              </div>
              <button onClick={() => { if (navigator.clipboard) navigator.clipboard.readText().then(t => setForm(p => ({ ...p, driveLink: t }))).catch(() => {}); }}
                disabled={extractState === "extracting"}
                className="paste-btn"
                title="Paste from clipboard">
                <Icon name="file" size={16} />
                Paste
              </button>
            </div>
            <p className="hint">Paste the "Anyone with the link" share URL from Google Drive</p>

            {/* Backup: read the PDF from this computer instead of downloading it */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden
                onChange={e => { setPdfFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              <button type="button" onClick={() => fileInput.current?.click()}
                disabled={extractState === "extracting"} className="paste-btn" style={{ padding: "8px 12px" }}>
                <Icon name="file" size={16} />
                {pdfFile ? "Choose a different PDF" : "Choose PDF from this computer"}
              </button>
              {pdfFile && (
                <span className="kw-chip">
                  {pdfFile.name}
                  <button onClick={() => setPdfFile(null)} disabled={extractState === "extracting"}
                    className="kw-chip-x" aria-label="Remove the chosen PDF">
                    <Icon name="x" size={12} strokeWidth={2.5} />
                  </button>
                </span>
              )}
            </div>
            <p className="hint">
              {pdfFile
                ? "The PDF will be read from this computer. The Drive link is still saved so students can open it."
                : "Optional backup: if Google Drive is not responding, read the PDF from this computer instead."}
            </p>
          </div>

          {/* Title */}
          <div className="field-mb">
            <label className="field-label">Title <span className="field-req">*</span></label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Enter full thesis title" disabled={extractState === "extracting"} className="input" />
          </div>

          {/* Dept + Year */}
          <div className="form-grid-2">
            <div>
              <label className="field-label">Department <span className="field-req">*</span></label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} disabled={extractState === "extracting"}
                className="input" style={{ color: form.department ? undefined : "var(--text-subtle)", appearance: "none" }}>
                <option value="">Select dept.</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Academic Year</label>
              <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} disabled={extractState === "extracting"}
                className="input" style={{ appearance: "none" }}>
                {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Adviser */}
          <div>
            <label className="field-label">Adviser <span className="field-req">*</span></label>
            <select value={form.adviser} onChange={e => setForm(p => ({ ...p, adviser: e.target.value }))} disabled={extractState === "extracting"}
              className="input" style={{ color: form.adviser ? undefined : "var(--text-subtle)", appearance: "none" }}>
              <option value="">Select adviser</option>
              {ADVISERS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {error && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}
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
                ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              }
            </div>
            <div>
              <div className={`status-title ${extractState === "success" ? "status-title-success" : "status-title-review"}`}>
                {extractState === "success" ? "Details filled in. Please review:" : "Could not read PDF completely. Please fill in:"}
              </div>
              <div className="status-sub">
                {extractState === "success" ? "Abstract and keywords extracted — edit if needed" : "Manual entry required for abstract and keywords"}
              </div>
            </div>
          </div>

          {extractState === "needs_review" && error && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          {/* Thesis summary */}
          <div className="review-card">
            <p className="review-title">{form.title}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <DeptBadge dept={form.department} small />
              <span className="result-meta">{form.year} · {form.adviser}</span>
            </div>
          </div>

          {/* Editable abstract */}
          <div className="review-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="field-label" style={{ marginBottom: 0 }}>Abstract</label>
              <span className="overlap-lbl">Editable</span>
            </div>
            <textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={5} className="textarea" />
            <div className="word-count">{abstract.split(" ").filter(Boolean).length} words</div>
          </div>

          {/* Keywords chips */}
          <div className="review-card">
            <label className="field-label" style={{ marginBottom: 10 }}>Keywords</label>
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
              <input value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }}
                placeholder="Add a keyword and press Enter" className="input" style={{ padding: "8px 12px", fontSize: 13 }} />
              <button onClick={() => { if (newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }} className="chip-add">
                + Add
              </button>
            </div>
          </div>

          {saveError && (
            <div className="error-box" role="alert">
              <Icon name="alert" size={16} />
              {saveError}
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-submit">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {saving ? "Saving..." : extractState === "success" ? "Confirm & Save" : "Save Manually"}
          </button>
        </div>
      )}

      {/* Submit button */}
      {extractState === "idle" && (
        <button onClick={handleSubmit} disabled={!form.driveLink.trim()} className="btn-submit">
          <Icon name="file" size={18} />
          Read PDF & continue
        </button>
      )}
    </div>
  );
}

