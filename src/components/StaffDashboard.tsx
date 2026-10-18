import { useState, useEffect } from "react";
import type { NewThesis, StaffTab, Thesis } from "../types";
import { registeredAtISO } from "../types";
import { countAdded } from "../stats";
import { ISUSeal, DeptBadge, Icon, initialsOf, authorsPreview, formatPosted, type IconName } from "./shared";
import { RegisterForm } from "./RegisterForm";
import { DepartmentStats } from "./DepartmentStats";
import { KeywordModelCard } from "./KeywordModelCard";
import { ThemePicker, ThemeToggle } from "./ThemeToggle";

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
  editing,
  onEditSave,
  onEditCancel,
  onSearch,
  onOpenStudy,
  onSignOut,
}: {
  theses: Thesis[];
  account: StaffAccount;
  activeTab: StaffTab;
  onTabChange: (t: StaffTab) => void;
  onSave: (thesis: NewThesis) => Promise<void>;
  /** Set while staff edit a study (Study Details → Edit): the edit form
   *  replaces the tab content and no tab is marked active. */
  editing?: Thesis | null;
  /** Rejects on failure so the edit form can show the error and stay open. */
  onEditSave?: (thesis: NewThesis) => Promise<void>;
  onEditCancel?: () => void;
  /** department: undefined = the default filter (own department), "" = all. */
  onSearch: (q?: string, department?: string) => void;
  /** Open the search screen at this study, with its Study Details expanded. */
  onOpenStudy: (thesisId: string) => void;
  onSignOut: () => void;
}) {
  // Staff see their own department's theses on the dashboard. A client-side
  // filter over the same live list (docs/04 §2.3); with no department set in
  // the console they see everything rather than nothing.
  const dept = account.department;
  const mine = dept ? theses.filter(t => t.department === dept) : theses;
  const deptLabel = dept ? `${dept} Staff` : "Research Staff";
  const name = account.displayName || account.email;

  // Local time, not UTC: see countAdded() in stats.ts.
  const stats = { total: mine.length, ...countAdded(mine) };

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
    { id: "statistics", label: "Statistics", icon: "chart" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  const STAT_CARDS: { label: string; value: number; icon: IconName; tone: string }[] = [
    { label: dept ? "Department Studies" : "Total Studies", value: stats.total, icon: "book", tone: "green" },
    { label: "Added this month", value: stats.thisMonth, icon: "clock", tone: "yellow" },
    { label: "Added this year", value: stats.thisYear, icon: "calendar", tone: "blue" },
  ];

  return (
    <div className="app-root">
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <ISUSeal size={36} />
          <div className="header-brand">
            <div className="header-title">Research Study E-Library · Staff</div>
            <div className="header-sub">Isabela State University · Echague Campus</div>
          </div>
          <ThemeToggle />
          <button onClick={onSignOut} className="header-signout" aria-label="Sign out" title="Sign out">
            <Icon name="logout" size={16} />
            Sign Out
          </button>
          <div className="avatar-wrap">
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              title="Account"
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
              className={`tab-btn${!editing && activeTab === tab.id ? " tab-btn-active" : ""}`}
              aria-current={!editing && activeTab === tab.id ? "page" : undefined}
            >
              <span className="tab-icon"><Icon name={tab.icon} size={16} /></span>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="app-shell">
        {/* Edit study: the Register form in edit mode, keyed so another study starts fresh. */}
        {editing && onEditSave && onEditCancel && (
          <div className="register-wrap">
            <RegisterForm key={editing.id} study={editing} theses={theses} viewerEmail={account.email}
              onBack={onEditCancel} onSave={onEditSave} />
          </div>
        )}

        {!editing && activeTab === "dashboard" && (
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
                  <span className="card-title">Recent studies</span>
                  <span className="card-meta">{mine.length} total</span>
                </div>
                {mine.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icon name="book" size={22} /></div>
                    <div className="empty-state-title">{dept ? `No ${dept} studies yet` : "No studies in the e-library yet"}</div>
                    <div className="empty-state-text">Register one to get started.</div>
                  </div>
                )}
                {/* No status badge: every study is POSTED. The whole row opens the
                    study, as "View details" does on the student dashboard. */}
                {mine.slice(0, 6).map(t => {
                  const authors = authorsPreview(t.authors);
                  return (
                    <button key={t.id} type="button" onClick={() => onOpenStudy(t.id)}
                      className="list-row list-row-btn row-hover">
                      <span className="list-row-title clamp-2">{t.title}</span>
                      <span className="study-brief">
                        {authors && <span className="study-brief-authors clamp-2">{authors}</span>}
                        <span className="study-brief-line clamp-2">Adviser: {t.adviser}</span>
                      </span>
                      <span className="list-row-meta">
                        <DeptBadge dept={t.department} small />
                        <span>{t.year}</span>
                      </span>
                      {t.keywords.length > 0 && (
                        <span className="study-brief-kws">
                          {t.keywords.slice(0, 3).map(kw => <span key={kw} className="kw-mini kw-mini--clip">{kw}</span>)}
                        </span>
                      )}
                      {registeredAtISO(t) && <span className="study-brief-line">Posted {formatPosted(t, "short")}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Quick actions */}
              <div className="dash-side">
                <div className="action-grid">
                  <button onClick={() => onTabChange("register")} className="btn btn-primary action-btn">
                    <Icon name="plus" size={18} />
                    Register study
                  </button>
                  <button onClick={() => onSearch()} className="btn btn-outline-blue action-btn">
                    <Icon name="search" size={18} />
                    Search e-library
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!editing && activeTab === "register" && (
          <div className="register-wrap">
            <RegisterForm
              theses={theses}
              viewerEmail={account.email}
              onBack={() => onTabChange("dashboard")}
              onSave={async thesis => { await onSave(thesis); onTabChange("dashboard"); }}
            />
          </div>
        )}

        {/* Every department, not just `mine`: the point is to compare them. */}
        {!editing && activeTab === "statistics" && (
          <div className="animate-fade-in">
            <DepartmentStats
              theses={theses}
              highlightDept={dept}
              onSelectDepartment={d => onSearch("", d)}
              onSelectKeyword={(k, d) => onSearch(k, d)}
            />
            {/* Staff only: the student dashboard shows DepartmentStats without it. */}
            <KeywordModelCard theses={theses} />
          </div>
        )}

        {!editing && activeTab === "settings" && (
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
            <div className="settings-row">
              <span className="settings-icon"><Icon name="moon" size={18} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="settings-label">Theme</div>
                <ThemePicker />
              </div>
            </div>
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
