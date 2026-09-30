import { useState, useEffect, useRef, useMemo } from "react";
import type { Role, Thesis } from "../types";
import { DEPARTMENTS, STATUSES, registeredAtISO } from "../types";
import { tokenize, buildIndex, computeDocFreq, bm25Score } from "../search";
import { ISUSeal, StatusBadge, DeptBadge, STATUS_LABELS, Icon } from "./shared";

export function SearchScreen({
  theses, role, initialQuery, defaultDepartment = "", onCombinedSummary, onBack, onSignOut,
}: {
  theses: Thesis[]; role: Role; initialQuery?: string;
  /** Staff start filtered to their own department (docs/05 §4). Students start on "All". */
  defaultDepartment?: string;
  onCombinedSummary: (results: Thesis[], query: string) => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const [query, setQuery] = useState(initialQuery || "");
  // The input shows `query` instantly; BM25 runs on `debouncedQuery`, 300ms
  // after typing stops. The clearTimeout is what makes it a debounce rather
  // than a delay — without it every keystroke would still run a search.
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || "");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);
  // A single character matches too much to be useful (findMatchScore ignores
  // terms under 2 chars anyway), so it counts as "no query": show everything.
  const searchQuery = debouncedQuery.trim().length >= 2 ? debouncedQuery.trim() : "";

  const [deptFilter, setDeptFilter] = useState(role === "staff" ? defaultDepartment : "");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
    // No query: everything, newest first.
    if (!searchQuery) {
      return filtered
        .map(t => ({ thesis: t, score: 0 }))
        .sort((a, b) => registeredAtISO(b.thesis).localeCompare(registeredAtISO(a.thesis)));
    }

    const df = computeDocFreq(tokenize(searchQuery), index);
    return filtered
      .map((t, i) => ({ thesis: t, score: bm25Score(searchQuery, t, i, index, df).score }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [filtered, index, searchQuery]);

  const maxScore = Math.max(...results.map(r => r.score), 0.01);
  const allYears = Array.from(new Set(theses.map(t => t.year))).sort((a, b) => b - a);
  const hasActiveFilters = deptFilter || yearFilter || statusFilter;
  const activeChips: { label: string; clear: () => void }[] = [
    ...(deptFilter ? [{ label: deptFilter, clear: () => setDeptFilter("") }] : []),
    ...(yearFilter ? [{ label: yearFilter, clear: () => setYearFilter("") }] : []),
    ...(statusFilter ? [{ label: STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS], clear: () => setStatusFilter("") }] : []),
  ];
  const typing = query.trim() !== debouncedQuery.trim();

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
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}{role === "staff" && d === defaultDepartment ? " (mine)" : ""}</option>)}
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
        {activeChips.length > 0 && (
          <div className="container">
            <div className="active-chips" aria-label="Active filters">
              {activeChips.map(c => (
                <span key={c.label} className="active-chip">
                  {c.label}
                  <button onClick={c.clear} aria-label={`Remove filter ${c.label}`}><Icon name="x" size={12} strokeWidth={2.5} /></button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <main className="results-main">
        {/* Header row */}
        <div className="results-head">
          <div className="results-count" aria-live="polite">
            {typing ? (
              <span className="results-typing">Searching…</span>
            ) : searchQuery ? (
              <>{results.length} result{results.length !== 1 ? "s" : ""} for <em>“{searchQuery}”</em></>
            ) : (
              <>{results.length} {results.length === 1 ? "thesis" : "theses"}{hasActiveFilters ? " match the filters" : ", newest first"}</>
            )}
          </div>
          {selected.size > 0 && (
            <button onClick={() => onCombinedSummary(results.filter(r => selected.has(r.thesis.id)).map(r => r.thesis), searchQuery)}
              className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
              <Icon name="layers" size={16} />
              View Summary ({selected.size})
            </button>
          )}
        </div>

        {/* Two different empty states (docs/05 §5): no data at all vs no match. */}
        {theses.length === 0 ? (
          <div className="card empty-state" style={{ padding: "56px 20px" }}>
            <div className="empty-state-icon"><Icon name="book" size={22} /></div>
            <div className="empty-state-title">The archive is empty</div>
            <div className="empty-state-text">No theses have been registered yet.</div>
          </div>
        ) : results.length === 0 && !typing && (
          <div className="card empty-state" style={{ padding: "56px 20px" }}>
            <div className="empty-state-icon"><Icon name="search" size={22} /></div>
            <div className="empty-state-title">No theses found</div>
            <div className="empty-state-text">Try different keywords, adjust filters, or check spelling.</div>
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); setStatusFilter(""); }}
                className="btn btn-outline-green btn-sm" style={{ marginTop: 14 }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* While the debounce is pending the list still holds the previous query's
            results; fade it so it is not mistaken for the answer to what is typed. */}
        <div className={`results-list${typing ? " results-list--stale" : ""}`} aria-busy={typing}>
          {results.map(({ thesis: t, score }) => {
            const pct = searchQuery && score > 0 ? Math.round((score / maxScore) * 93) + 4 : 0;
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

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 28 }}>
                    {t.keywords.slice(0, 4).map(kw => (
                      <span key={kw} className="kw-mini">{kw}</span>
                    ))}
                  </div>

                </div>

                {/* Inline abstract preview */}
                {showPreview && (
                  <div className="animate-slide-up preview-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span className="overline-label" style={{ marginBottom: 0 }}>Abstract</span>
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
