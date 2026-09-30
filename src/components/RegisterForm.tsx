import { useState } from "react";
import type { ExtractionState, NewThesis, ThesisStatus } from "../types";
import { DEPARTMENTS } from "../types";
import { ADVISERS } from "../data";
import { DeptBadge } from "./shared";

export function RegisterForm({ onBack, onSave }: {
  onBack: () => void;
  /** Persists the thesis. Rejects on failure so the form can show the error. */
  onSave: (thesis: NewThesis, status: ThesisStatus) => Promise<void>;
}) {
  const [extractState, setExtractState] = useState<ExtractionState>("idle");
  const [form, setForm] = useState({ driveLink: "", title: "", department: "", year: "2024", adviser: "" });
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const MOCK_ABSTRACT = "This study investigates the application of machine learning algorithms for predictive modeling of crop yield in Isabela Province, Philippines. Using historical weather data, soil profiles, and satellite imagery from 2010 to 2023, a gradient boosting model achieved 87.3% prediction accuracy for palay yield. Feature importance analysis revealed that soil nitrogen content and rainfall distribution during the tillering stage are primary determinants of yield variability. The model offers practical value for agricultural planning at the municipal level, enabling early intervention and resource allocation optimization.";
  const MOCK_KEYWORDS = ["machine learning", "crop yield prediction", "palay", "Isabela Province", "gradient boosting", "precision agriculture"];

  const steps = [
    { label: "Fill Details", active: extractState === "idle" || extractState === "extracting", done: extractState !== "idle" },
    { label: "Processing", active: extractState === "extracting", done: extractState === "success" || extractState === "needs_review" },
    { label: "Review & Save", active: extractState === "success" || extractState === "needs_review", done: false },
  ];

  function handleSubmit() {
    if (!form.driveLink || !form.title || !form.department || !form.adviser) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!form.driveLink.includes("drive.google.com")) {
      setError("Please enter a valid Google Drive link (drive.google.com).");
      return;
    }
    setError("");
    setExtractState("extracting");
    setTimeout(() => {
      setAbstract(MOCK_ABSTRACT);
      setKeywords(MOCK_KEYWORDS);
      setExtractState(Math.random() > 0.3 ? "success" : "needs_review");
    }, 2800);
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Thesis Details</h2>

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
                title="Paste from clipboard">📋</button>
            </div>
            <p className="hint">Paste the "Anyone with the link" share URL from Google Drive</p>
          </div>

          {/* Title */}
          <div className="field-mb">
            <label className="field-label">Title <span className="field-req">*</span></label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Enter full thesis title" disabled={extractState === "extracting"} className="input" />
          </div>

          {/* Dept + Year */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label className="field-label">Department <span className="field-req">*</span></label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} disabled={extractState === "extracting"}
                className="input" style={{ color: form.department ? "#111827" : "#9CA3AF", appearance: "none" }}>
                <option value="">Select dept.</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Academic Year</label>
              <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} disabled={extractState === "extracting"}
                className="input" style={{ appearance: "none" }}>
                {[2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Adviser */}
          <div>
            <label className="field-label">Adviser <span className="field-req">*</span></label>
            <select value={form.adviser} onChange={e => setForm(p => ({ ...p, adviser: e.target.value }))} disabled={extractState === "extracting"}
              className="input" style={{ color: form.adviser ? "#111827" : "#9CA3AF", appearance: "none" }}>
              <option value="">Select adviser</option>
              {ADVISERS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {error && (
            <div className="error-box">
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* Extracting state */}
      {extractState === "extracting" && (
        <div className="animate-fade-in extract-panel">
          <div className="spin-ring">
            <div className="animate-spin spin-ring-inner" />
            <div className="spin-core">📄</div>
          </div>
          <div className="extract-title">Reading PDF and filling in details...</div>
          <div className="extract-sub">pdf.js · Scanning pages 1–4 · Regex: Abstract/Keywords</div>
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
                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="#7a6500" strokeWidth="2" strokeLinecap="round" /></svg>
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

          {/* Thesis summary */}
          <div className="review-card">
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.45, margin: "0 0 8px" }}>{form.title}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <DeptBadge dept={form.department} small />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{form.year} · {form.adviser}</span>
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
            <label className="field-label" style={{ marginBottom: 10 }}>Keywords (Chips Input)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {keywords.map(kw => (
                <span key={kw} className="kw-chip">
                  {kw}
                  <button onClick={() => setKeywords(p => p.filter(k => k !== kw))} className="kw-chip-x">×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }}
                placeholder="Add keyword, press Enter..." className="input" style={{ padding: "8px 12px", fontSize: 12 }} />
              <button onClick={() => { if (newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }} className="chip-add">
                + Add
              </button>
            </div>
          </div>

          {saveError && (
            <div className="error-box" role="alert">
              ⚠️ {saveError}
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
        <button onClick={handleSubmit} className="btn-submit">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Submit
        </button>
      )}
    </div>
  );
}

