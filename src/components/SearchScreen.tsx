import { useState, useEffect, useRef, useMemo } from "react";
import type { Role, Thesis } from "../types";
import { STATUSES } from "../types";
import { tokenize, buildIndex, computeDocFreq, bm25Score } from "../search";
import { ISUSeal, StatusBadge, DeptBadge, STATUS_LABELS } from "./shared";

export function SearchScreen({
  theses, role, initialQuery, onCombinedSummary, onBack,
}: {
  theses: Thesis[]; role: Role; initialQuery?: string;
  onCombinedSummary: (results: Thesis[], query: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState(initialQuery || "");
  const [deptFilter, setDeptFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedRank, setExpandedRank] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Filters narrow the candidate set, then the index is built from what survives.
  // N, doc-frequency and avgDocLen therefore all describe the same corpus — they
  // used to disagree, because avgDocLen came from all theses while N came from
  // the filtered ones.
  const filtered = useMemo(() => {
    let f = theses;
    if (deptFilter) f = f.filter(t => t.department === deptFilter);
    if (yearFilter) f = f.filter(t => t.year === parseInt(yearFilter));
    if (statusFilter) f = f.filter(t => t.status === statusFilter);
    return f;
  }, [theses, deptFilter, yearFilter, statusFilter]);

  const index = useMemo(() => buildIndex(filtered), [filtered]);

  const results = useMemo(() => {
    const empty = [] as { term: string; score: number; field: string }[];

    // No query: everything, newest first.
    if (!query.trim()) {
      return filtered
        .map(t => ({ thesis: t, score: 0, termScores: empty }))
        .sort((a, b) => b.thesis.dateAdded.localeCompare(a.thesis.dateAdded));
    }

    const df = computeDocFreq(tokenize(query), index);
    return filtered
      .map((t, i) => ({ thesis: t, ...bm25Score(query, t, i, index, df) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [filtered, index, query]);

  const maxScore = Math.max(...results.map(r => r.score), 0.01);
  const allDepts = Array.from(new Set(theses.map(t => t.department)));
  const allYears = Array.from(new Set(theses.map(t => t.year))).sort((a, b) => b - a);
  const hasActiveFilters = deptFilter || yearFilter || statusFilter;

  return (
    <div className="app-root" style={{ background: "#F9FAFB" }}>
      {/* Sticky header + search */}
      <div className="site-header">
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {/* Top bar */}
          <div className="search-topbar">
            <button onClick={onBack} className="back-btn">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <ISUSeal size={26} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {role === "staff" ? "Search Archive" : "ISU Thesis Archive"}
              </span>
            </div>
            <span className="count-pill">{theses.length} theses</span>
          </div>
          {/* Search input */}
          <div className="search-bar-row">
            <div className="search-bar">
              <svg className="search-bar-icon" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="rgba(0,100,57,0.4)" strokeWidth="2" />
                <path d="M20 20l-3-3" stroke="rgba(0,100,57,0.4)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by title, author, keyword, year..."
                className="search-input" />
              {query && (
                <button onClick={() => setQuery("")} className="search-clear">×</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="filter-bar">
        <div style={{ maxWidth: 800, margin: "0 auto", overflowX: "auto" }}>
          <div className="filter-row-inner">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className={`select-pill${deptFilter ? " select-pill-active" : ""}`}>
              <option value="">{role === "staff" ? "My Department ▼" : "All Departments ▼"}</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className={`select-pill${yearFilter ? " select-pill-active" : ""}`}>
              <option value="">All Years ▼</option>
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {role === "staff" && STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                className={`btn-pill${statusFilter === s ? " btn-pill-active" : ""}`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); setStatusFilter(""); }}
                className="btn-clear">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="results-main">
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            {query ? (
              <>{results.length} result{results.length !== 1 ? "s" : ""} for <span style={{ color: "#006439" }}>"{query}"</span></>
            ) : (
              <>{results.length} theses</>
            )}
          </div>
          {selected.size > 0 && (
            <button onClick={() => onCombinedSummary(results.filter(r => selected.has(r.thesis.id)).map(r => r.thesis), query)}
              className="btn btn-primary" style={{ padding: "7px 12px", fontSize: 12 }}>
              View Summary ({selected.size})
            </button>
          )}
        </div>

        {results.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.4 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>No theses found</div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>Try different keywords, adjust filters, or check spelling.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {results.map(({ thesis: t, score, termScores }) => {
            const pct = query && score > 0 ? Math.round((score / maxScore) * 93) + 4 : 0;
            const isExpanded = expandedRank === t.id;
            const isSelected = selected.has(t.id);
            const showPreview = previewId === t.id;

            return (
              <div key={t.id} className={`result-card${isSelected ? " result-card-selected" : ""}`}>
                <div className="result-pad">
                  <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                      style={{ marginTop: 3, accentColor: "#006439", cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <button onClick={() => setPreviewId(showPreview ? null : t.id)} className="result-title-btn">
                        <h3 className="result-title">
                          {t.title}
                        </h3>
                      </button>
                    </div>
                    {pct > 0 && (
                      <div className="score-pill">
                        {pct}%
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8, paddingLeft: 24 }}>
                    <DeptBadge dept={t.department} small />
                    <StatusBadge status={t.status} />
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.year} · {t.adviser}</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 24, marginBottom: query && termScores.length > 0 ? 8 : 0 }}>
                    {t.keywords.slice(0, 4).map(kw => (
                      <span key={kw} className="kw-mini">{kw}</span>
                    ))}
                  </div>

                  {/* BM25 why this rank */}
                  {query && termScores.length > 0 && (
                    <div style={{ paddingLeft: 24 }}>
                      <button onClick={() => setExpandedRank(isExpanded ? null : t.id)} className="why-btn">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Why this rank?
                        <svg style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                      {isExpanded && (
                        <div className="animate-slide-up term-box">
                          <div className="term-overline">BM25 Term Scores</div>
                          {termScores.map(ts => (
                            <div key={ts.term} className="term-row">
                              <span className="term-name">{ts.term}</span>
                              <div className="term-track">
                                <div className="term-fill" style={{ width: `${Math.min(100, (ts.score / Math.max(...termScores.map(x => x.score))) * 100)}%` }} />
                              </div>
                              <span className="term-score">{ts.score.toFixed(2)}</span>
                              <span className={`term-field term-field-${ts.field}`}>
                                {ts.field}
                              </span>
                            </div>
                          ))}
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6 }}>
                            IDF × TF-normalized · BM25 k₁=1.5 b=0.75
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline abstract preview */}
                {showPreview && (
                  <div className="animate-slide-up preview-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span className="term-overline" style={{ marginBottom: 0 }}>Abstract</span>
                      <a href={t.driveLink} target="_blank" rel="noreferrer" className="drive-btn">
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Open in Drive
                      </a>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{t.abstract}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
