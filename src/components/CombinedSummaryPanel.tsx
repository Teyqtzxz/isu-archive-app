import { useEffect, useMemo } from "react";
import { summarise, type RankedThesis } from "../summary";
import { apaInTextLabels, apaReference, apaReferenceText, inTextString } from "../citation";
import { Icon, highlightKw } from "./shared";

export function CombinedSummaryPanel({ theses, query, onClose, onCiteJump }: {
  theses: RankedThesis[]; query: string; onClose: () => void;
  /** A citation chip was tapped: close the panel and let SearchScreen scroll to that result. */
  onCiteJump: (thesisId: string) => void;
}) {
  const sources = useMemo(() => [...theses].sort((a, b) => a.rank - b.rank), [theses]);
  const sentences = useMemo(() => summarise(sources, query), [sources, query]);
  const idByRank = new Map(sources.map(s => [s.rank, s.thesis.id]));
  // APA 7 in-text citations, e.g. (Acosta & Mindanao, 2026). Built over all the
  // ticked studies at once so two that would read the same get 2026a / 2026b.
  const inText = useMemo(() => apaInTextLabels(sources.map(s => s.thesis)), [sources]);
  // APA 7 reference list: alphabetical by first author. Studies with no authors
  // recorded have no reference (citation.ts) and sort by title after them.
  const references = useMemo(() => [...sources].sort((a, b) => {
    const ka = apaReferenceText(a.thesis);
    const kb = apaReferenceText(b.thesis);
    if (!ka !== !kb) return ka ? -1 : 1;
    return (ka || a.thesis.title).localeCompare(kb || b.thesis.title);
  }), [sources]);

  const keywords = Array.from(new Set(sources.flatMap(s => s.thesis.keywords))).slice(0, 8);

  // Escape closes the panel, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              {sentences.map((s, i) => {
                const id = idByRank.get(s.sourceIndex)!;
                const cite = inText.get(id)!;
                // APA puts the citation inside the sentence, before its final
                // punctuation: "…was effective (Acosta, 2026)."
                const m = s.text.match(/^([\s\S]*?)([.?!]+["”’)]?)?$/)!;
                return (
                  <span key={i}>
                    {highlightKw(m[1], query)}{" "}
                    <button className="cite-chip" onClick={() => onCiteJump(id)}
                      aria-label={`Go to the study cited as ${inTextString(cite)}`}>
                      ({cite.italic ? <em>{cite.who}</em> : cite.who}, {cite.year})
                    </button>{m[2] ?? ""}{" "}
                  </span>
                );
              })}
            </p>
          )}
          {/* One result is not a summary of several studies; say so (docs/07 §5). */}
          {sources.length === 1 && sentences.length > 0 && (
            <p className="summary-note">Only one result is selected, so the summary is its most relevant sentence.</p>
          )}

          {/* Reference list, in APA 7 format, for the in-text citations above */}
          <div className="sources-box">
            <div className="overline-label">References</div>
            {references.map(({ thesis: t }) => {
              const ref = apaReference(t);
              return (
                <p key={t.id} className="source-text apa-ref">
                  {ref
                    ? <>{ref.lead}<em>{ref.title}</em>{ref.tail}</>
                    : <><em>{t.title}</em> ({t.year}). <span className="study-details-empty">Authors not recorded.</span></>}
                </p>
              );
            })}
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
