import { useState, useEffect } from "react";
import type { NewThesis, StaffTab, Thesis, ThesisStatus } from "../types";
import { isPending, registeredAtISO } from "../types";
import { ISUSeal, StatusBadge, DeptBadge, Icon, initialsOf, type IconName } from "./shared";
import { RegisterForm } from "./RegisterForm";

/** Who is signed in, for the header, welcome card and settings. */
export interface StaffAccount {
  displayName: string;
  email: string;
  /** One of DEPARTMENTS, or "" when the console record has none. */
  department: string;
}

export function StaffDashboard({
  theses,
  account,
  activeTab,
  onTabChange,
  onSave,
  onMarkArchived,
  onSearch,
  onSignOut,
}: {
  theses: Thesis[];
  account: StaffAccount;
  activeTab: StaffTab;
  onTabChange: (t: StaffTab) => void;
  onSave: (thesis: NewThesis, status: ThesisStatus) => Promise<void>;
  onMarkArchived: (id: string) => void;
  onSearch: () => void;
  onSignOut: () => void;
}) {
  // Staff see their own department's theses on the dashboard. A client-side
  // filter over the same live list (docs/04 §2.3); with no department set in
  // the console they see everything rather than nothing.
  const dept = account.department;
  const mine = dept ? theses.filter(t => t.department === dept) : theses;
  const deptLabel = dept ? `${dept} Staff` : "Research Staff";
  const name = account.displayName || account.email;

  const thisMonthPrefix = new Date().toISOString().slice(0, 7); // "2026-09"
  const stats = {
    total: mine.length,
    pending: mine.filter(isPending).length,
    thisMonth: mine.filter(t => registeredAtISO(t).startsWith(thisMonthPrefix)).length,
  };

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const TABS: { id: StaffTab; label: string; icon: IconName }[] = [
    { id: "dashboard", label: "Dashboard", icon: "grid" },
    { id: "register", label: "Register", icon: "plus" },
    { id: "search", label: "Search", icon: "search" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  const STAT_CARDS: { label: string; value: number; icon: IconName; tone: string }[] = [
    { label: dept ? "Department theses" : "Total theses", value: stats.total, icon: "book", tone: "green" },
    { label: "Pending review", value: stats.pending, icon: "clock", tone: "yellow" },
    { label: "Added this month", value: stats.thisMonth, icon: "calendar", tone: "blue" },
  ];

  return (
    <div className="app-root">
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <ISUSeal size={36} />
          <div className="header-brand">
            <div className="header-title">Thesis Archive · Staff</div>
            <div className="header-sub">Isabela State University · Echague Campus</div>
          </div>
          <button
            className="icon-btn"
            onClick={() => onTabChange("dashboard")}
            aria-label={stats.pending > 0 ? `${stats.pending} theses pending review` : "No theses pending review"}
            title={stats.pending > 0 ? `${stats.pending} pending review` : "Nothing pending review"}
          >
            <Icon name="bell" size={20} />
            {stats.pending > 0 && <span className="dot-notif">{stats.pending > 9 ? "9+" : stats.pending}</span>}
          </button>
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
              className="avatar avatar-staff"
            >{initialsOf(account.displayName, account.email)}</button>
            {menuOpen && (
              <div className="dropdown" role="menu">
                <div className="dropdown-header">
                  <div className="dropdown-name">{name}</div>
                  <div className="dropdown-sub">{account.email}</div>
                  <div className="dropdown-sub">{deptLabel}</div>
                </div>
                <button role="menuitem" onClick={e => { e.stopPropagation(); setMenuOpen(false); onTabChange("settings"); }} className="dropdown-item">
                  <Icon name="settings" size={16} />
                  Settings
                </button>
                <button role="menuitem" onClick={e => { e.stopPropagation(); setMenuOpen(false); onSignOut(); }} className="dropdown-item dropdown-item-danger">
                  <Icon name="logout" size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab nav */}
        <nav className="tabs-nav" aria-label="Staff sections">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === "search" ? onSearch() : onTabChange(tab.id)}
              className={`tab-btn${activeTab === tab.id ? " tab-btn-active" : ""}`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              <span className="tab-icon"><Icon name={tab.icon} size={16} /></span>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="app-shell">
        {activeTab === "dashboard" && (
          <div className="animate-fade-in">
            {/* Welcome */}
            <div className="card card-pad card-mb welcome">
              <div className="welcome-text">
                <div className="welcome-overline">Welcome back</div>
                <div className="welcome-name">{name}</div>
                <span className={`role-chip${dept ? "" : " role-chip--muted"}`}>
                  <Icon name="building" size={14} />
                  {dept ? deptLabel : "No department set"}
                </span>
              </div>
              <div className="welcome-date">
                <div className="welcome-date-label">Today</div>
                <div className="welcome-date-value">
                  {new Date().toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="stat-grid">
              {STAT_CARDS.map(s => (
                <div key={s.label} className="stat-card">
                  <span className={`stat-icon stat-icon--${s.tone}`}><Icon name={s.icon} size={18} /></span>
                  <div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="dash-layout">
              {/* Recent theses */}
              <div className="card">
                <div className="card-title-row">
                  <span className="card-title">Recent theses</span>
                  <span className="card-meta">{mine.length} total</span>
                </div>
                {mine.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="book" size={22} /></div>
                    <div className="empty-state-title">{dept ? `No ${dept} theses yet` : "No theses in the archive yet"}</div>
                    <div className="empty-state-text">Register one to get started.</div>
                  </div>
                )}
                {mine.slice(0, 6).map(t => (
                  <div key={t.id} className="list-row row-hover">
                    <div className="list-row-top">
                      <p className="list-row-title clamp-2">{t.title}</p>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="list-row-meta">
                      <DeptBadge dept={t.department} small />
                      <span>{t.year}</span>
                      <span aria-hidden="true">·</span>
                      <span>Added {registeredAtISO(t).slice(0, 10)}</span>
                      {isPending(t) && (
                        <button onClick={() => onMarkArchived(t.id)} className="btn btn-outline-green btn-sm list-row-action">
                          <Icon name="check" size={14} />
                          Mark as Archived
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="dash-side">
                <div className="action-grid">
                  <button onClick={() => onTabChange("register")} className="btn btn-primary action-btn">
                    <Icon name="plus" size={18} />
                    Register thesis
                  </button>
                  <button onClick={onSearch} className="btn btn-outline-blue action-btn">
                    <Icon name="search" size={18} />
                    Search archive
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "register" && (
          <div className="register-wrap">
            <RegisterForm
              onBack={() => onTabChange("dashboard")}
              onSave={async (thesis, status) => { await onSave(thesis, status); onTabChange("dashboard"); }}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="animate-fade-in card card-pad-lg register-wrap">
            <h2 className="form-title" style={{ marginBottom: 12 }}>Account</h2>
            {([
              { label: "Name", value: name, icon: "user" },
              { label: "Email", value: account.email, icon: "mail" },
              { label: "Department", value: dept || "Not set — ask the Firebase admin", icon: "building" },
              { label: "Role", value: "Research Department Staff", icon: "layers" },
            ] as { label: string; value: string; icon: IconName }[]).map(item => (
              <div key={item.label} className="settings-row">
                <span className="settings-icon"><Icon name={item.icon} size={18} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="settings-label">{item.label}</div>
                  <div className="settings-value">{item.value}</div>
                </div>
              </div>
            ))}
            <button onClick={onSignOut} className="btn-danger-soft">
              <Icon name="logout" size={16} />
              Sign Out
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
