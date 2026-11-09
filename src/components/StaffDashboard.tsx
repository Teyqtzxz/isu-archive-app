import { useState, useEffect } from "react";
import type { NewThesis, StaffTab, Thesis } from "../types";
import { countAdded } from "../stats";
import { ownCollegeFilter, shortCollege } from "../colleges";
import { ISUSeal, Icon, RecentStudyCard, initialsOf, type IconName } from "./shared";
import { RegisterForm } from "./RegisterForm";
import { DepartmentStats } from "./DepartmentStats";
import { KeywordModelCard } from "./KeywordModelCard";
import { LibraryCharts } from "./LibraryCharts";
import { ThemePicker, ThemeToggle } from "./ThemeToggle";

/** Who is signed in, for the header, welcome card and settings. */
export interface StaffAccount {
  /** Firebase uid; the unsaved Register / Edit draft belongs to it (draft.ts). */
  uid: string;
  displayName: string;
  email: string;
  /** users/{uid}.department through collegeOf (errata #87): a college's full
   *  name, "" when the console record has none, or a hand-typed value that is
   *  not a college (shown in Settings; the filters start on "All colleges"). */
  department: string;
}

export function StaffDashboard({
  theses,
  studiesReady,
  studiesError,
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
  onDraftDiscarded,
}: {
  theses: Thesis[];
  /** False until the live list has arrived; the form's save waits for it. */
  studiesReady: boolean;
  /** Why the list could not be loaded, or null. */
  studiesError: string | null;
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
  /** A toast when an Edit draft is dropped (the study was saved by someone since). */
  onDraftDiscarded: (message: string) => void;
}) {
  // Staff see their own college's theses on the dashboard. A client-side
  // filter over the same live list (docs/04 §2.3); with no college set in
  // the console — or a value that is not one of the 12 colleges — they see
  // everything rather than nothing. An old department name in the profile
  // has already been read as its college (data.ts, errata #87).
  const dept = ownCollegeFilter(account.department);
  const mine = dept ? theses.filter(t => t.department === dept) : theses;
  const deptLabel = dept ? `${shortCollege(dept)} Staff` : "Research Staff";
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
    { label: dept ? "College Studies" : "Total Studies", value: stats.total, icon: "book", tone: "green" },
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
            <RegisterForm key={editing.id} study={editing} theses={theses} studiesReady={studiesReady}
              studiesError={studiesError} viewerEmail={account.email} uid={account.uid}
              onBack={onEditCancel} onSave={onEditSave} onDraftDiscarded={onDraftDiscarded} />
          </div>
        )}

        {!editing && activeTab === "dashboard" && (
          <div className="animate-fade-in">
            {/* Welcome */}
            <div className="card card-pad card-mb welcome">
              <div className="welcome-text">
                <div className="welcome-overline">Welcome back</div>
                <div className="welcome-name">{name}</div>
                <span className={`role-chip${dept ? "" : " role-chip--muted"}`} title={dept || undefined}>
                  <Icon name="building" size={14} />
                  {dept ? deptLabel : "No college set"}
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
              {/* Recent theses: the student "Recently added" cards and grid. */}
              <section>
                <div className="section-head section-head--wrap">
                  <h2 className="section-title">Recent studies</h2>
                  <span className="card-meta">{mine.length} total</span>
                  {/* The whole library, not `mine`: "" = All Colleges, so staff
                      whose college has no studies yet can still reach the list. */}
                  {theses.length > 0 && (
                    <button type="button" onClick={() => onSearch("", "")} className="link-btn">
                      View all studies
                      <Icon name="arrowRight" size={14} />
                    </button>
                  )}
                </div>
                {mine.length === 0 ? (
                  <div className="card empty-state">
                    <div className="empty-state-icon"><Icon name="book" size={22} /></div>
                    <div className="empty-state-title">{dept ? `No ${shortCollege(dept)} studies yet` : "No studies in the e-library yet"}</div>
                    <div className="empty-state-text">Register one to get started.</div>
                  </div>
                ) : (
                  <div className="recent-grid">
                    {mine.slice(0, 6).map(t => <RecentStudyCard key={t.id} study={t} onOpen={onOpenStudy} />)}
                  </div>
                )}
              </section>

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
              studiesReady={studiesReady}
              studiesError={studiesError}
              viewerEmail={account.email}
              uid={account.uid}
              onBack={() => onTabChange("dashboard")}
              onSave={async thesis => { await onSave(thesis); onTabChange("dashboard"); }}
            />
          </div>
        )}

        {/* Every college, not just `mine`: the point is to compare them. */}
        {!editing && activeTab === "statistics" && (
          <div className="animate-fade-in">
            <DepartmentStats
              theses={theses}
              highlightDept={dept}
              onSelectDepartment={d => onSearch("", d)}
              onSelectKeyword={(k, d) => onSearch(k, d)}
            />
            {/* Staff only: the student dashboard shows DepartmentStats without these. */}
            <LibraryCharts theses={theses} />
            <KeywordModelCard theses={theses} />
          </div>
        )}

        {!editing && activeTab === "settings" && (
          <div className="animate-fade-in card card-pad-lg register-wrap">
            <h2 className="form-title" style={{ marginBottom: 12 }}>Account</h2>
            {([
              { label: "Name", value: name, icon: "user" },
              { label: "Email", value: account.email, icon: "mail" },
              { label: "College", value: dept
                  || (account.department ? `${account.department} (not one of the 12 colleges — ask the Firebase admin)` : "Not set — ask the Firebase admin"),
                icon: "building" },
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
