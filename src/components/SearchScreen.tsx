import { useState, useEffect, useRef, useMemo } from "react";
import type { Role, Thesis } from "../types";
import { STATUSES, registeredAtISO } from "../types";
import { tokenize, buildIndex, computeDocFreq, bm25Score } from "../search";
import { ISUSeal, StatusBadge, DeptBadge, STATUS_LABELS, Icon } from "./shared";

export function SearchScreen({
  theses, role, initialQuery, onCombinedSummary, onBack, onSignOut,
}: {
  theses: Thesis[]; role: Role; initialQuery?: string;
  onCombinedSummary: (results: Thesis[], query: string) => void;
  onBack: () => void;
  onSignOut: () => void;
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
        .sort((a, b) => registeredAtISO(b.thesis).localeCompare(registeredAtISO(a.thesis)));
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
    <div className="app-root">
      {/* Sticky header + search */}
      <header className="site-header">
        <div className="container">
          {/* Top bar */}
          <div className="search-topbar">
            <button onClick={onBack} className="back-btn" aria-label="Back to dashboard">
              <Icon name="arrowLeft" size={20} />
            </button>
            <ISUSeal size={28} />
            <div className="search-topbar-title">
              {role === "staff" ? "Search Archive" : "ISU Thesis Archive"}
            </div>
            <span className="count-pill">{theses.length} theses</span>
            <button onClick={onSignOut} className="header-signout">
              <Icon name="logout" size={16} />
              Sign Out
            </button>
          </div>
          {/* Search input */}
          <div className="search-bar-row">
            <div className="search-bar">
              <span className="search-bar-icon"><Icon name="search" size={18} /></span>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by title, keyword or abstract…"
                aria-label="Search theses"
                className="search-input" />
              {query && (
                <button onClick={() => setQuery("")} className="search-clear" aria-label="Clear search">
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filter chips */}
      <div className="filter-bar">
        <div className="container filter-scroll">
          <div className="filter-row-inner">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              aria-label="Filter by department"
              className={`select-pill${deptFilter ? " select-pill-active" : ""}`}>
              <option value="">{role === "staff" ? "My Department" : "All Departments"}</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              aria-label="Filter by year"
              className={`select-pill${yearFilter ? " select-pill-active" : ""}`}>
              <option value="">All Years</option>
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {role === "staff" && <span className="filter-divider" aria-hidden="true" />}
            {role === "staff" && STATUSES.map(s => (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                aria-pressed={statusFilter === s}
                className={`btn-pill${statusFilter === s ? " btn-pill-active" : ""}`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); setStatusFilter(""); }}
                className="btn-clear">
                <Icon name="x" size={14} />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="results-main">
        {/* Header row */}
        <div className="results-head">
          <div className="results-count" aria-live="polite">
            {query ? (
              <>{results.length} result{results.length !== 1 ? "s" : ""} for <em>“{query}”</em></>
            ) : (
              <>{results.length} theses</>
            )}
          </div>
          {selected.size > 0 && (
            <button onClick={() => onCombinedSummary(results.filter(r => selected.has(r.thesis.id)).map(r => r.thesis), query)}
              className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
              <Icon name="layers" size={16} />
              View Summary ({selected.size})
            </button>
          )}
        </div>

        {results.length === 0 && (
          <div className="card empty-state" style={{ padding: "56px 20px" }}>
            <div className="empty-state-icon"><Icon name="search" size={22} /></div>
            <div className="empty-state-title">No theses found</div>
            <div className="empty-state-text">Try different keywords, adjust filters, or check spelling.</div>
          </div>
        )}

        <div className="results-list">
          {results.map(({ thesis: t, score, termScores }) => {
            const pct = query && score > 0 ? Math.round((score / maxScore) * 93) + 4 : 0;
            const isExpanded = expandedRank === t.id;
            const isSelected = selected.has(t.id);
            const showPreview = previewId === t.id;

            return (
              <div key={t.id} className={`result-card${isSelected ? " result-card-selected" : ""}`}>
                <div className="result-pad">
                  <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                      aria-label={`Select “${t.title}” for the combined summary`}
                      className="result-check" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button onClick={() => setPreviewId(showPreview ? null : t.id)} className="result-title-btn" aria-expanded={showPreview}>
                        <h3 className="result-title">
                          {t.title}
                        </h3>
                      </button>
                    </div>
                    {pct > 0 && (
                      <div className="score-pill" title="Relevance, relative to the top result">
                        {pct}%
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, paddingLeft: 28 }}>
                    <DeptBadge dept={t.department} small />
                    <StatusBadge status={t.status} />
                    <span className="result-meta">{t.year} · {t.adviser}</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 28, marginBottom: query && termScores.length > 0 ? 10 : 0 }}>
                    {t.keywords.slice(0, 4).map(kw => (
                      <span key={kw} className="kw-mini">{kw}</span>
                    ))}
                  </div>

                  {/* BM25 why this rank */}
                  {query && termScores.length > 0 && (
                    <div style={{ paddingLeft: 28 }}>
                      <button onClick={() => setExpandedRank(isExpanded ? null : t.id)} className="why-btn" aria-expanded={isExpanded}>
                        <Icon name="info" size={14} />
                        Why this rank?
                        <span style={{ display: "inline-flex", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                          <Icon name="chevronDown" size={14} />
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="animate-slide-up term-box">
                          <div className="term-overline">BM25 term scores</div>
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
                          <div className="term-foot">
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span className="term-overline" style={{ marginBottom: 0 }}>Abstract</span>
                      <a href={t.driveLink} target="_blank" rel="noreferrer" className="drive-btn">
                        <Icon name="external" size={13} />
                        Open in Drive
                      </a>
                    </div>
                    <p className="preview-text">{t.abstract}</p>
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
