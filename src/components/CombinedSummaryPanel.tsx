import { useEffect, useState } from "react";
import type { Thesis } from "../types";
import { tokenize } from "../search";
import { Icon } from "./shared";

export function CombinedSummaryPanel({ theses, query, onClose }: { theses: Thesis[]; query: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const extractive = `Several theses archived at ISU Echague Campus address research related to ${query || "key thematic areas"} in Isabela Province [1][2]. These studies collectively highlight interdisciplinary approaches combining field surveys, computational modeling, and community-based methodologies [3]. Findings consistently emphasize sustainable resource management and data-driven policy frameworks [1][4]. Taken together, they contribute substantially to the regional knowledge base and provide practical recommendations for local government units and research institutions [2][3].`;

  const keywords = Array.from(new Set(theses.flatMap(t => t.keywords))).slice(0, 8);

  // Escape closes the panel, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function highlightKw(text: string) {
    if (!query) return text;
    const terms = tokenize(query);
    let result = text;
    terms.forEach(term => {
      result = result.replace(new RegExp(`\\b${term}\\b`, "gi"), `<mark class="keyword-highlight">${term}</mark>`);
    });
    return result;
  }

  function handleCopy() {
    navigator.clipboard.writeText(extractive);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay">
      <div onClick={onClose} className="modal-backdrop" />
      <div className="animate-slide-up-modal modal-sheet" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        {/* Handle */}
        <div className="sheet-handle-row">
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        <div className="sheet-header">
          <div className="sheet-title-row">
            <div>
              <h2 className="sheet-h2" id="summary-title">
                Summary of {theses.length} Results
              </h2>
              {query && <p className="sheet-query">for <strong>“{query}”</strong></p>}
            </div>
            <button onClick={onClose} className="sheet-close" aria-label="Close summary"><Icon name="x" size={16} /></button>
          </div>
          <div className="mode-pill-row">
            <span className="mode-pill">
              <Icon name="file" size={13} />
              Extractive summary · selected results
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="sheet-body">
          <p className="summary-text"
            dangerouslySetInnerHTML={{ __html: highlightKw(extractive) }} />

          {/* Citations */}
          <div className="sources-box">
            <div className="overline-label">Sources</div>
            {theses.slice(0, 4).map((t, i) => (
              <div key={t.id} className="source-row">
                <span className="source-num">{i + 1}</span>
                <span className="source-text">{t.title} ({t.year}) · {t.adviser}</span>
              </div>
            ))}
          </div>

          {/* Keyword highlights */}
          <div>
            <div className="overline-label">Key Terms</div>
            <div className="keywords-row">
              {keywords.map(kw => (
                <span key={kw} className="key-term">{kw}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="sheet-action">
          <button onClick={handleCopy}
            className={`btn-copy${copied ? " btn-copy-done" : ""}`}>
            <Icon name={copied ? "check" : "file"} size={15} />
            {copied ? "Copied" : "Copy summary"}
          </button>
          <button className="btn-export">
            <Icon name="external" size={15} />
            Export PDF
          </button>
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
