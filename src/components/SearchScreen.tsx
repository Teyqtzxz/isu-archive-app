import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Role, Thesis } from "../types";
import { DEPARTMENTS, registeredAtISO } from "../types";
import { tokenize, buildIndex, computeDocFreq, bm25Score, relevancePercent, isNameTitle } from "../search";
import { SEARCH_MAX, cleanQuery } from "../validation";
import { splitSentences, type RankedThesis } from "../summary";
import { apaReference } from "../citation";
import { abstractSnippet } from "../snippet";
import { THRESHOLDS, buildSimilarityIndex, similarStudies } from "../similarity";
import { ISUSeal, DeptBadge, Icon, SharedTerms, formatPosted, authorsPreviewParts, highlightKw, withAccount } from "./shared";
import { ThemeToggle } from "./ThemeToggle";
import { SmartSearchInput } from "./SmartSearchInput";
import { searchPlan, type Correction, type SmartSearchIndex } from "../smartSearch";

export function SearchScreen({
  theses, smartIndex, role, viewerEmail, initialQuery, defaultDepartment = "", initialDepartment, jumpTo, onCombinedSummary, onEdit, onDelete, onBack, onSignOut,
}: {
  theses: Thesis[]; role: Role;
  /** Autocomplete and "Did you mean" words (built once in App.tsx, docs/16). */
  smartIndex: SmartSearchIndex;
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
  /** Staff only: open this study in the Edit form / ask to delete it. The
   *  buttons show only for staff, and firestore.rules deny anyone else anyway. */
  onEdit?: (thesis: Thesis) => void;
  onDelete?: (thesis: Thesis) => void;
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

  // The BM25 search (search.ts, unchanged) of the filtered studies for one
  // query: the studies it finds, best first.
  const rank = useCallback((q: string) => {
    const df = computeDocFreq(tokenize(q), index);
    return filtered
      .map((t, i) => ({ thesis: t, score: bm25Score(q, t, i, index, df).score }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [filtered, index]);

  // "Search instead for …" was clicked for this typed query: search it exactly
  // as typed. Typing anything resets it (changeQuery).
  const [exactQuery, setExactQuery] = useState<string | null>(null);

  // Which query to actually search (smartSearch.ts searchPlan, docs/16 §7):
  //   as-typed       → the typed query, nothing extra shown;
  //   auto-corrected → the correction, with "Showing results for …";
  //   suggest        → the typed query, with the "Did you mean" button.
  // The box keeps what was typed; only the search uses `searched`.
  const plan = useMemo(
    () => searchPlan(smartIndex, searchQuery, q => rank(q).length, { exact: exactQuery === searchQuery }),
    [smartIndex, searchQuery, rank, exactQuery],
  );
  const searched = plan.query;

  const results = useMemo(() => {
    // No query: everything, newest first.
    if (!searched) {
      return filtered
        .map(t => ({ thesis: t, score: 0 }))
        .sort((a, b) => registeredAtISO(b.thesis).localeCompare(registeredAtISO(a.thesis)));
    }
    return rank(searched);
  }, [filtered, rank, searched]);

  // One short abstract snippet per result, only while searching (snippet.ts).
  // No query (newest-first list) → no snippets.
  const snippets = useMemo(() => {
    const m = new Map<string, string>();
    if (!searched) return m;
    for (const { thesis: t } of results) m.set(t.id, abstractSnippet(splitSentences(t.abstract), searched));
    return m;
  }, [results, searched]);

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
  }, [jumpTo]);
  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(t);
  }, [flashId]);
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

  // Similar studies (similarity.ts) in the open Study Details: TF-IDF vectors
  // of every study, built once per data change (not per keystroke, and not
  // from the filtered list: a similar study in another department still counts).
  const similarityIndex = useMemo(() => buildSimilarityIndex(theses), [theses]);
  const byId = useMemo(() => new Map(theses.map(t => [t.id, t])), [theses]);
  const similar = useMemo(() => {
    const open = previewId ? byId.get(previewId) : undefined;
    return open ? similarStudies(similarityIndex, open, { excludeId: open.id, min: THRESHOLDS.similarStudies }) : [];
  }, [similarityIndex, byId, previewId]);

  // A similar study tapped: the same jump as "View details" (open it, scroll to
  // it, flash it). If the search words or a filter hide it, they are cleared first.
  function openSimilar(thesisId: string) {
    if (!results.some(r => r.thesis.id === thesisId)) {
      changeQuery("");
      setDebouncedQuery("");
      setDeptFilter("");
      setYearFilter("");
    }
    setPreviewId(thesisId);
    setScrollTarget({ id: thesisId, open: true });
    setFlashId(thesisId);
  }

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

  // Every change to the box goes through here, so a "Search instead for …"
  // only holds for the query it was clicked on.
  function changeQuery(next: string) {
    setQuery(next);
    setExactQuery(null);
  }

  // The "Did you mean" button: put the correction in the box and search it.
  function applyCorrection(corrected: string) {
    // Both at once, so the corrected search runs now, not after the debounce.
    changeQuery(corrected);
    setDebouncedQuery(corrected);
    inputRef.current?.focus();
  }

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
            <ThemeToggle />
            <button onClick={onSignOut} className="header-signout">
              <Icon name="logout" size={16} />
              Sign Out
            </button>
          </div>
          {/* Search input */}
          <div className="search-bar-row">
            <div className="search-bar">
              <span className="search-bar-icon"><Icon name="search" size={18} /></span>
              <SmartSearchInput index={smartIndex} inputRef={inputRef} value={query} onChange={changeQuery} maxLength={SEARCH_MAX}
                placeholder="Search by title, keyword or abstract…"
                ariaLabel="Search studies"
                className="search-input" />
              {query && (
                <button onClick={() => changeQuery("")} className="search-clear" aria-label="Clear search">
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
            ) : searched ? (
              <>{results.length} result{results.length !== 1 ? "s" : ""} for <em>“{searched}”</em></>
            ) : (
              <>{results.length} {results.length === 1 ? "study" : "studies"}{hasActiveFilters ? " match the filters" : ", newest first"}</>
            )}
          </div>
          {ticked.length > 0 && (
            <button onClick={() => onCombinedSummary(ticked, searched)}
              className="btn btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>
              <Icon name="layers" size={16} />
              View Summary ({ticked.length})
            </button>
          )}
        </div>

        {/* The search corrected itself (all three rules of searchPlan held):
            say so, and offer the typed words exactly as typed. */}
        {plan.mode === "auto-corrected" && plan.correction && !typing && (
          <div className="search-corrected">
            <p className="search-corrected-line">
              Showing results for <BoldFixes correction={plan.correction} />
            </p>
            <p className="search-corrected-instead">
              Search instead for{" "}
              <button type="button" className="search-instead-link" onClick={() => setExactQuery(searchQuery)}>
                “{searchQuery}”
              </button>
            </p>
          </div>
        )}

        {/* A correction that is not safe enough to search by itself: only a button. */}
        {plan.mode === "suggest" && plan.correction && !typing && (
          <button type="button" className="did-you-mean" onClick={() => { if (plan.correction) applyCorrection(plan.correction.query); }}>
            Did you mean: <BoldFixes correction={plan.correction} />?
          </button>
        )}

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
            const pct = searched && score > 0 ? relevancePercent(score, maxScore) : 0;
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
                          {authors.label}: {highlightKw(authors.names, searched, isNameTitle)}{authors.more}
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
                    <span className="result-meta">{t.year}{t.adviser && <> · Adviser: {highlightKw(t.adviser, searched, isNameTitle)}</>}</span>
                  </div>

                  {snippet && (
                    <p className="result-snippet">{highlightKw(snippet, searched)}</p>
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
                        <span className="details-actions">
                          <a href={withAccount(t.driveLink, viewerEmail)} target="_blank" rel="noreferrer" className="drive-btn">
                            <Icon name="external" size={13} />
                            Open in Drive
                          </a>
                          {onEdit && (
                            <button type="button" onClick={() => onEdit(t)} className="drive-btn" aria-label={`Edit “${t.title}”`}>
                              <Icon name="edit" size={13} />
                              Edit
                            </button>
                          )}
                          {onDelete && (
                            <button type="button" onClick={() => onDelete(t)} className="drive-btn drive-btn-danger" aria-label={`Delete “${t.title}”`}>
                              <Icon name="trash" size={13} />
                              Delete
                            </button>
                          )}
                        </span>
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
                    {/* Top 3 other studies at 15% or more (TF-IDF + cosine). None → no section. */}
                    {similar.length > 0 && (
                      <div className="sim-section">
                        <span className="overline-label">Similar studies</span>
                        <ul className="sim-list">
                          {similar.map(m => {
                            const s = byId.get(m.id);
                            if (!s) return null;
                            return (
                              <li key={m.id} className="sim-item">
                                <button type="button" onClick={() => openSimilar(m.id)} className="sim-link">{s.title}</button>
                                <span className="result-meta">{s.year} · {m.percent}% similar</span>
                                <SharedTerms terms={m.sharedTerms} />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
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

/** A corrected query with the fixed words in bold ("Did you mean: …?" and
 *  "Showing results for …"). */
function BoldFixes({ correction }: { correction: Correction }) {
  return (
    <>
      {correction.parts.map((p, i) => p.changed ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>)}
    </>
  );
}
