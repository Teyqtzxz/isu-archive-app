import { useEffect, useMemo, type ReactNode } from "react";
import { tokenize } from "../search";
import { summarise, type RankedThesis } from "../summary";
import { Icon } from "./shared";

export function CombinedSummaryPanel({ theses, query, onClose, onCiteJump }: {
  theses: RankedThesis[]; query: string; onClose: () => void;
  /** A citation chip was tapped: close the panel and let SearchScreen scroll to that result. */
  onCiteJump: (thesisId: string) => void;
}) {
  const sources = useMemo(() => [...theses].sort((a, b) => a.rank - b.rank), [theses]);
  const sentences = useMemo(() => summarise(sources, query), [sources, query]);
  const idByRank = new Map(sources.map(s => [s.rank, s.thesis.id]));

  const keywords = Array.from(new Set(sources.flatMap(s => s.thesis.keywords))).slice(0, 8);

  // Escape closes the panel, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Wraps query words in <mark>. Builds React nodes rather than an HTML string,
  // so abstract text is never parsed as HTML, and the original casing is kept.
  function highlightKw(text: string): ReactNode {
    const terms = tokenize(query);
    if (terms.length === 0) return text;
    const re = new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
    return text.split(re).map((part, i) =>
      i % 2 === 1 ? <mark key={i} className="keyword-highlight">{part}</mark> : part);
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
                Summary of {sources.length} {sources.length === 1 ? "Result" : "Results"}
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
          {sentences.length === 0 ? (
            <p className="summary-note">These abstracts are too short to summarise.</p>
          ) : (
            <p className="summary-text">
              {sentences.map((s, i) => (
                <span key={i}>
                  {highlightKw(s.text)}{" "}
                  <button className="cite-chip" onClick={() => onCiteJump(idByRank.get(s.sourceIndex)!)}
                    aria-label={`Go to result ${s.sourceIndex}`}>
                    [{s.sourceIndex}]
                  </button>{" "}
                </span>
              ))}
            </p>
          )}
          {/* One result is not a summary of several studies; say so (docs/07 §5). */}
          {sources.length === 1 && sentences.length > 0 && (
            <p className="summary-note">Only one result is selected, so every sentence above comes from its abstract.</p>
          )}

          {/* Citations: numbered by the rank shown on the search screen */}
          <div className="sources-box">
            <div className="overline-label">Sources</div>
            {sources.map(({ thesis: t, rank }) => (
              <div key={t.id} className="source-row">
                <span className="source-num">{rank}</span>
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

        {/* Action bar: Close only (docs/07 §4) */}
        <div className="sheet-action">
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
