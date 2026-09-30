import { useState, useEffect, useRef } from "react";
import type { Thesis } from "../types";
import { registeredAtISO } from "../types";
import { ISUSeal, DeptBadge, Icon, initialsOf } from "./shared";

export function StudentDashboard({ theses, account, onSearch, onSignOut }: {
  theses: Thesis[];
  account: { displayName: string; email: string };
  onSearch: (q: string) => void;
  onSignOut: () => void;
}) {
  const [heroQuery, setHeroQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const quickFilters = ["Recent", "Agriculture", "Computer Science", "Forestry", "Biology", "Education"];
  const name = account.displayName || account.email;

  const recent = [...theses]
    .sort((a, b) => registeredAtISO(b).localeCompare(registeredAtISO(a)))
    .slice(0, 6);

  function handleSearch() {
    if (heroQuery.trim()) onSearch(heroQuery);
  }

  return (
    <div className="app-root">
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <ISUSeal size={36} />
          <div className="header-brand">
            <div className="header-title">ISU Thesis Archive</div>
            <div className="header-sub">Isabela State University · Echague Campus</div>
          </div>
          <button onClick={onSignOut} className="header-signout">
            <Icon name="logout" size={16} />
            Sign Out
          </button>
          <div className="avatar-wrap">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              className="avatar avatar-student">{initialsOf(account.displayName, account.email)}</button>
            {menuOpen && (
              <div className="dropdown" role="menu">
                <div className="dropdown-header">
                  <div className="dropdown-name">{name}</div>
                  <div className="dropdown-sub">{account.email}</div>
                  <div className="dropdown-sub">Student · read-only access</div>
                </div>
                <button role="menuitem" onClick={e => { e.stopPropagation(); setMenuOpen(false); onSignOut(); }} className="dropdown-item dropdown-item-danger">
                  <Icon name="logout" size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero search section */}
        <section className="hero-section">
          <h1 className="hero-h1">Discover ISU Research</h1>
          <p className="hero-sub">
            Search archived theses from every department and year, ranked by relevance.
          </p>

          <div className="hero-search">
            <div className="search-box">
              <span className="search-icon"><Icon name="search" size={20} /></span>
              <input
                ref={inputRef}
                value={heroQuery}
                onChange={e => setHeroQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search by topic, keyword or title…"
                aria-label="Search theses"
                className="search-input-lg"
              />
            </div>
            <button onClick={handleSearch} className="btn btn-yellow search-btn-lg">
              Search
            </button>
          </div>
        </section>

        <div className="container" style={{ paddingTop: 24, paddingBottom: 40 }}>
          {/* Quick filter chips */}
          <div className="chip-row">
            <div className="chip-row-inner">
              {quickFilters.map(f => (
                <button key={f} onClick={() => { setActiveFilter(f === activeFilter ? "" : f); if (f !== "Recent") onSearch(f); }}
                  className={`chip${activeFilter === f ? " chip-active" : ""}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Recent theses */}
          <section>
            <div className="section-head">
              <h2 className="section-title">Recently added</h2>
              <button onClick={() => onSearch("")} className="link-btn">
                View all
                <Icon name="arrowRight" size={14} />
              </button>
            </div>
            {recent.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon"><Icon name="book" size={22} /></div>
                <div className="empty-state-title">No theses yet</div>
                <div className="empty-state-text">Archived theses will appear here.</div>
              </div>
            ) : (
              <div className="recent-grid">
                {recent.map(t => (
                  <article key={t.id} className="carousel-card">
                    <p className="carousel-title clamp-3">{t.title}</p>
                    <div className="carousel-meta">
                      <DeptBadge dept={t.department} small />
                      <span>{t.year}</span>
                    </div>
                    <button onClick={() => onSearch(t.title.split(" ").slice(0, 4).join(" "))}
                      className="btn btn-outline-green btn-sm" style={{ width: "100%", padding: "8px" }}>
                      View details
                      <Icon name="arrowRight" size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Footer */}
          <p className="page-foot">
            Need help? Contact the Research Department at <strong>research@isu.edu.ph</strong>
          </p>
        </div>
      </main>
    </div>
  );
}
