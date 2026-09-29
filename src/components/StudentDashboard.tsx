import { useState, useEffect, useRef } from "react";
import type { Thesis } from "../types";
import { registeredAtISO } from "../types";
import { ISUSeal, DeptBadge } from "./shared";

export function StudentDashboard({ theses, onSearch, onSignOut }: { theses: Thesis[]; onSearch: (q: string) => void; onSignOut: () => void }) {
  const [heroQuery, setHeroQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const quickFilters = ["Recent", "Agriculture", "Computer Science", "Forestry", "Biology", "Education"];

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
          <ISUSeal size={34} />
          <div className="header-brand">
            <div className="header-title">ISU Thesis Archive</div>
            <div className="header-sub">Echague Campus</div>
          </div>
          <div className="avatar-wrap">
            <div
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              role="button"
              tabIndex={0}
              title="Account"
              className="avatar avatar-student">JD</div>
            {menuOpen && (
              <div className="dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-name">Juan Dela Cruz</div>
                  <div className="dropdown-sub">Student</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onSignOut(); }} className="dropdown-item dropdown-item-danger">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-shell" style={{ padding: 0 }}>
        {/* Hero search section */}
        <div className="hero-section">
          <h1 className="hero-h1">
            Discover ISU Research
          </h1>
          <p className="hero-sub">
            Browse all archived theses from all departments and years
          </p>

          {/* Big search input */}
          <div className="search-box">
            <svg className="search-icon" width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="rgba(0,100,57,0.5)" strokeWidth="2.5" />
              <path d="M20 20l-3-3" stroke="rgba(0,100,57,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={heroQuery}
              onChange={e => setHeroQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search for thesis topics, authors, keywords, departments..."
              className="search-input-lg"
            />
          </div>
          <button onClick={handleSearch} className="btn btn-yellow search-btn-lg">
            Search Theses
          </button>
        </div>

        <div style={{ padding: "20px 16px 32px" }}>
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

          {/* Recent theses carousel */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Recent Theses</h2>
              <button onClick={() => onSearch("")} className="why-btn">View all →</button>
            </div>
            <div style={{ overflowX: "auto", marginRight: -16, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 12, width: "max-content" }}>
                {recent.map(t => (
                  <div key={t.id} className="carousel-card">
                    <p className="clamp-3" style={{ fontSize: 12, fontWeight: 600, color: "#23305B", lineHeight: 1.45, margin: "0 0 10px" }}>{t.title}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <DeptBadge dept={t.department} small />
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.year}</span>
                    </div>
                    <button onClick={() => onSearch(t.title.split(" ").slice(0, 4).join(" "))}
                      className="btn btn-outline-green"
                      style={{ marginTop: 12, width: "100%", padding: "7px", borderRadius: 6, fontSize: 12 }}>
                      Open →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 36, textAlign: "center", padding: "0 16px" }}>
            <p style={{ fontSize: 12, color: "#9CA3AF" }}>Need help? Contact the Research Department at <span style={{ color: "#006439", fontWeight: 500 }}>research@isu.edu.ph</span></p>
          </div>
        </div>
      </main>
    </div>
  );
}
