import { useState, useEffect } from "react";
import type { Role, StaffTab, Thesis } from "../types";
import { isPending, registeredAtISO } from "../types";
import { ISUSeal, StatusBadge, DeptBadge } from "./shared";
import { RegisterForm } from "./RegisterForm";

export function StaffDashboard({
  theses,
  activeTab,
  onTabChange,
  onRegisterSuccess,
  onSearch,
  onSignOut,
}: {
  theses: Thesis[];
  activeTab: StaffTab;
  onTabChange: (t: StaffTab) => void;
  onRegisterSuccess: (thesis: Thesis) => void;
  onSearch: () => void;
  onSignOut: () => void;
}) {
  const thisMonthPrefix = new Date().toISOString().slice(0, 7); // "2026-09"
  const stats = {
    total: theses.length,
    pending: theses.filter(isPending).length,
    thisMonth: theses.filter(t => registeredAtISO(t).startsWith(thisMonthPrefix)).length,
  };

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const TABS: { id: StaffTab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "register", label: "Register", icon: "+" },
    { id: "search", label: "Search", icon: "⌕" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];

  return (
    <div className="app-root">
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <ISUSeal size={36} />
          <div className="header-brand">
            <div className="header-title">Thesis Archive — Staff</div>
            <div className="header-sub">ISU Echague Campus</div>
          </div>
          <button className="icon-btn">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {stats.pending > 0 && <span className="dot-notif" />}
          </button>
          <div className="avatar-wrap">
            <div
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              role="button"
              tabIndex={0}
              className="avatar avatar-staff"
            >RS</div>
            {menuOpen && (
              <div className="dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-name">Research Staff</div>
                  <div className="dropdown-sub">CAS Department Staff</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onSignOut(); }} className="dropdown-item dropdown-item-danger">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab nav */}
        <div className="tabs-nav">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === "search" ? onSearch() : onTabChange(tab.id)}
              className={`tab-btn${activeTab === tab.id ? " tab-btn-active" : ""}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="app-shell">
        {activeTab === "dashboard" && (
          <div className="animate-fade-in">
            {/* Welcome */}
            <div className="card card-pad card-mb" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginBottom: 2 }}>Welcome back</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 6 }}>Research Staff</div>
                <span style={{ background: "#23305B", color: "#fff", padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>CAS Department Staff</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>Today</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                  {new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="stat-grid">
              {[
                { label: "Total Theses", value: stats.total, color: "#006439", bg: "#F0F8F4", border: "rgba(0,100,57,0.15)", icon: "📚" },
                { label: "Pending Review", value: stats.pending, color: "#7a6500", bg: "#FFF8E1", border: "rgba(247,208,0,0.4)", icon: "🕐" },
                { label: "This Month", value: stats.thisMonth, color: "#23305B", bg: "#E8EBF2", border: "rgba(35,48,91,0.2)", icon: "📅" },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ background: s.bg, borderColor: s.border, borderTop: `4px solid ${s.color}` }}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label" style={{ color: s.color }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="action-grid">
              <button onClick={() => onTabChange("register")} className="btn btn-primary action-btn">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                Register Thesis
              </button>
              <button onClick={onSearch} className="btn btn-outline-blue action-btn">
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Search Archive
              </button>
            </div>

            {/* Recent theses table */}
            <div className="card">
              <div className="card-title-row">
                <span className="card-title">Recent Theses</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{theses.length} total</span>
              </div>
              {theses.slice(0, 6).map((t, i) => (
                <div key={t.id} className="row-hover" style={{ padding: "13px 18px", borderBottom: i < 5 ? "1px solid #F9FAFB" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <p className="clamp-2" style={{ fontSize: 13, fontWeight: 600, color: "#23305B", margin: 0, flex: 1, lineHeight: 1.4 }}>{t.title}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <DeptBadge dept={t.department} small />
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.year}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {registeredAtISO(t).slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "register" && (
          <RegisterForm onBack={() => onTabChange("dashboard")} onSuccess={thesis => { onRegisterSuccess(thesis); onTabChange("dashboard"); }} />
        )}

        {activeTab === "settings" && (
          <div className="animate-fade-in card card-pad-lg">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 20 }}>Settings</h2>
            {[
              { label: "Department", value: "College of Arts & Sciences", icon: "🏛️" },
              { label: "Role", value: "Research Department Staff", icon: "👤" },
              { label: "Account", value: "staff@isu.edu.ph", icon: "📧" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #F3F4F6" }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{item.value}</div>
                </div>
              </div>
            ))}
            <button onClick={onSignOut} className="btn-danger-soft">
              Sign Out
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

