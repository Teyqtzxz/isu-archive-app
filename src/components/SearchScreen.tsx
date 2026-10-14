import { useState, useEffect, useRef, useMemo } from "react";
import type { Role, Thesis } from "../types";
import { DEPARTMENTS, registeredAtISO } from "../types";
import { tokenize, buildIndex, computeDocFreq, bm25Score, relevancePercent, isNameTitle } from "../search";
import { SEARCH_MAX, cleanQuery } from "../validation";
import { splitSentences, type RankedThesis } from "../summary";
import { apaReference } from "../citation";
import { abstractSnippet } from "../snippet";
import { ISUSeal, DeptBadge, Icon, formatPosted, authorsPreviewParts, highlightKw } from "./shared";

/** The Drive link opened as the e-library account. With several Google accounts in one
 *  browser, Drive otherwise uses the first one (often a personal Gmail) and shows
 *  "You need access". Empty email or an unparsable link → the link unchanged. */
function withAccount(link: string, email: string): string {
  if (!email) return link;
  try {
    const url = new URL(link);
    url.searchParams.set("authuser", email);
    return url.toString();
  } catch {
    return link;
  }
}

export function SearchScreen({
  theses, role, viewerEmail, initialQuery, defaultDepartment = "", initialDepartment, jumpTo, onCombinedSummary, onBack, onSignOut,
}: {
  theses: Thesis[]; role: Role;
  /** The signed-in e-library account; Drive links open with it (authuser). */
  viewerEmail: string;
  initialQuery?: string;
  /** Staff start filtered to their own department (docs/05 §4). Students start on "All". */
  defaultDepartment?: string;
  /** Open already filtered to this department (a department chip was tapped). Overrides the default. */
  initialDepartment?: string;
  /** Set when a summary citation chip or a dashboard "View details" was tapped; `nonce` makes a
   *  repeat tap on the same study fire again. `open` also expands that study's Study Details. */
  jumpTo?: { thesisId: string; nonce: number; open?: boolean } | null;
  onCombinedSummary: (results: RankedThesis[], query: string) => void;
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
  // So does junk with no letter or digit ("!!!"): cleanQuery returns "".
  const cleaned = cleanQuery(debouncedQuery);
  const searchQuery = cleaned.length >= 2 ? cleaned : "";

  const [deptFilter, setDeptFilter] = useState(initialDepartment ?? (role === "staff" ? defaultDepartment : ""));
  const [yearFilter, setYearFilter] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Not when arriving from "View details": on a phone the keyboard would cover the study.
  useEffect(() => { if (!jumpTo?.open) inputRef.current?.focus(); }, []);

  // Filters narrow the candidate set, then the index is built from what survives.
  // N, doc-frequency and avgDocLen therefore all describe the same corpus — they
  // used to disagree, because avgDocLen came from all theses while N came from
  // the filtered ones.
  const filtered = useMemo(() => {
    let f = theses;
    if (deptFilter) f = f.filter(t => t.department === deptFilter);
    if (yearFilter) f = f.filter(t => t.year === parseInt(yearFilter));
    return f;
  }, [theses, deptFilter, yearFilter]);

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

  // One short abstract snippet per result, only while searching (snippet.ts).
  // No query (newest-first list) → no snippets.
  const snippets = useMemo(() => {
    const m = new Map<string, string>();
    if (!searchQuery) return m;
    for (const { thesis: t } of results) m.set(t.id, abstractSnippet(splitSentences(t.abstract), searchQuery));
    return m;
  }, [results, searchQuery]);

  // Citation chip → scroll to that result and flash it (docs/07 §4). The panel
  // is already closed by then, so the card is not hidden behind the overlay.
  // Dashboard "View details" (open: true) also expands its Study Details first.
  const [flashId, setFlashId] = useState<string | null>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; open: boolean } | null>(null);
  useEffect(() => {
    if (!jumpTo) return;
    if (jumpTo.open) setPreviewId(jumpTo.thesisId);
    setScrollTarget({ id: jumpTo.thesisId, open: !!jumpTo.open });
    setFlashId(jumpTo.thesisId);
    const t = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(t);
  }, [jumpTo]);
  // Scrolls in the render after the jump, so an expanded Study Details is already
  // laid out. An opened card is aligned to its top: it can be taller than the screen.
  // The top sits just below the sticky header (search box and filters), measured, not hardcoded.
  useEffect(() => {
    if (!scrollTarget) return;
    const card = document.getElementById(`result-${scrollTarget.id}`);
    if (card && scrollTarget.open) {
      const headerH = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - headerH - 12, behavior: "smooth" });
    } else {
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setScrollTarget(null);
  }, [scrollTarget]);

  // The summary uses ticked results that are still visible, each with the rank
  // it is shown at, so the button count and the cited studies match the list.
  const ticked: RankedThesis[] = results
    .map((r, i) => ({ thesis: r.thesis, rank: i + 1 }))
    .filter(r => selected.has(r.thesis.id));

  const maxScore = Math.max(...results.map(r => r.score), 0.01);
  const allYears = Array.from(new Set(theses.map(t => t.year))).sort((a, b) => b - a);
  const hasActiveFilters = deptFilter || yearFilter;
  const activeChips: { label: string; clear: () => void }[] = [
    ...(deptFilter ? [{ label: deptFilter, clear: () => setDeptFilter("") }] : []),
    ...(yearFilter ? [{ label: yearFilter, clear: () => setYearFilter("") }] : []),
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
              {role === "staff" ? "Search E-Library" : "ISU Research Study E-Library"}
            </div>
            <span className="count-pill">{theses.length} studies</span>
            <button onClick={onSignOut} className="header-signout">
              <Icon name="logout" size={16} />
              Sign Out
            </button>
          </div>
          {/* Search input */}
          <div className="search-bar-row">
            <div className="search-bar">
              <span className="search-bar-icon"><Icon name="search" size={18} /></span>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} maxLength={SEARCH_MAX}
                placeholder="Search by title, keyword or abstract…"
                aria-label="Search studies"
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
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); }}
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
              <>{results.length} {results.length === 1 ? "study" : "studies"}{hasActiveFilters ? " match the filters" : ", newest first"}</>
            )}
          </div>
          {ticked.length > 0 && (
            <button onClick={() => onCombinedSummary(ticked, searchQuery)}
              className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
              <Icon name="layers" size={16} />
              View Summary ({ticked.length})
            </button>
          )}
        </div>

        {/* Two different empty states (docs/05 §5): no data at all vs no match. */}
        {theses.length === 0 ? (
          <div className="card empty-state" style={{ padding: "56px 20px" }}>
            <div className="empty-state-icon"><Icon name="book" size={22} /></div>
            <div className="empty-state-title">The e-library is empty</div>
            <div className="empty-state-text">No studies have been registered yet.</div>
          </div>
        ) : results.length === 0 && !typing && (
          <div className="card empty-state" style={{ padding: "56px 20px" }}>
            <div className="empty-state-icon"><Icon name="search" size={22} /></div>
            <div className="empty-state-title">No studies found</div>
            <div className="empty-state-text">Try different keywords, adjust filters, or check spelling.</div>
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); }}
                className="btn btn-outline-green btn-sm" style={{ marginTop: 14 }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* While the debounce is pending the list still holds the previous query's
            results; fade it so it is not mistaken for the answer to what is typed. */}
        <div className={`results-list${typing ? " results-list--stale" : ""}`} aria-busy={typing}>
          {results.map(({ thesis: t, score }, i) => {
            const pct = searchQuery && score > 0 ? relevancePercent(score, maxScore) : 0;
            const isSelected = selected.has(t.id);
            const showPreview = previewId === t.id;
            // APA 7 reference (citation.ts); null when no authors are recorded.
            const citation = showPreview ? apaReference(t) : null;
            const authors = authorsPreviewParts(t.authors);
            const snippet = snippets.get(t.id);

            return (
              <div key={t.id} id={`result-${t.id}`}
                className={`result-card${isSelected ? " result-card-selected" : ""}${flashId === t.id ? " result-card-flash" : ""}`}>
                <div className="result-pad">
                  <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                      aria-label={`Select “${t.title}” for the combined summary`}
                      className="result-check" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button onClick={() => setPreviewId(showPreview ? null : t.id)} className="result-title-btn" aria-expanded={showPreview}>
                        <h3 className="result-title">
                          <span className="result-rank">{i + 1}.</span>
                          {t.title}
                        </h3>
                      </button>
                      {/* No authors recorded (older records) → no line. While searching,
                          the names are highlighted like the snippet, so a study found
                          by an author's name shows why (search indexes authors).
                          Titles and degrees are not searched, so never marked. */}
                      {authors && (
                        <p className="result-authors">
                          {authors.label}: {highlightKw(authors.names, searchQuery, isNameTitle)}{authors.more}
                        </p>
                      )}
                    </div>
                    {pct > 0 && (
                      <div className="score-pill" title="Relevance, relative to the top result">
                        {pct}%
                      </div>
                    )}
                  </div>

                  {/* No status badge: every study is POSTED. */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10, paddingLeft: 28 }}>
                    <DeptBadge dept={t.department} small />
                    <span className="result-meta">{t.year}{t.adviser && <> · Adviser: {highlightKw(t.adviser, searchQuery, isNameTitle)}</>}</span>
                  </div>

                  {snippet && (
                    <p className="result-snippet">{highlightKw(snippet, searchQuery)}</p>
                  )}

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
                      <span className="overline-label" style={{ marginBottom: 0 }}>Study Details</span>
                      {/* Students read the study in Google's view-only viewer: the file is
                          shared ISU → Viewer with download limited to Editors (docs/08 §7b). */}
                      {role === "staff" ? (
                        <a href={withAccount(t.driveLink, viewerEmail)} target="_blank" rel="noreferrer" className="drive-btn">
                          <Icon name="external" size={13} />
                          Open in Drive
                        </a>
                      ) : (
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, textAlign: "right" }}>
                          <a href={withAccount(t.driveLink, viewerEmail)} target="_blank" rel="noreferrer" className="drive-btn">
                            <Icon name="external" size={13} />
                            Read full study
                          </a>
                          <span className="card-meta">View only: download and printing are turned off.</span>
                        </span>
                      )}
                    </div>
                    <dl className="study-details">
                      {/* Citation first, in APA 7 format. No authors recorded →
                          "Not recorded": a reference without authors would be wrong. */}
                      <dt>Citation</dt>
                      <dd>{citation
                        ? <span className="apa-ref">{citation.lead}<em>{citation.title}</em>{citation.tail}</span>
                        : <span className="study-details-empty">Not recorded</span>}</dd>
                      {/* Full names: the citation shows only initials. */}
                      <dt>Author{t.authors.length === 1 ? "" : "s"}</dt>
                      <dd>{t.authors.length > 0
                        ? t.authors.join("; ")
                        : <span className="study-details-empty">Not recorded</span>}</dd>
                      <dt>Adviser</dt>
                      <dd>{t.adviser}</dd>
                      <dt>Department</dt>
                      <dd>{t.department}</dd>
                      {/* The citation already shows the year; without one, show it here. */}
                      {!citation && <>
                        <dt>Academic Year</dt>
                        <dd>{t.year}</dd>
                      </>}
                      <dt>Date Posted</dt>
                      <dd>{formatPosted(t)}</dd>
                      {t.keywords.length > 0 && <>
                        <dt>Keywords</dt>
                        <dd>{t.keywords.join(", ")}</dd>
                      </>}
                    </dl>
                    <span className="overline-label">Abstract</span>
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
