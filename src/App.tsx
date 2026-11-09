import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import "./App.css";
import type { NewThesis, Role, Screen, StaffTab, Thesis } from "./types";
import { auth } from "./firebase";
import {
  checkEmailVerified, deleteThesis, getUserProfile, isIsuEmail, linkReset, saveThesis, signOutUser, subscribeToTheses,
  updateThesis,
} from "./data";
import { SLOW_WAIT_MS } from "./auth";
import { describeLinkForLog, parseEmailAction } from "./emailLink";
import { LoginScreen } from "./components/LoginScreen";
import { VerifyEmailScreen } from "./components/VerifyEmailScreen";
import { AuthActionScreen, type AuthActionExit } from "./components/AuthActionScreen";
import { StaffDashboard, type StaffAccount } from "./components/StaffDashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { SearchScreen } from "./components/SearchScreen";
import { CombinedSummaryPanel } from "./components/CombinedSummaryPanel";
import { SignOutDialog } from "./components/SignOutDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { RankedThesis } from "./summary";
import { buildSmartSearch } from "./smartSearch";
import type { ToastKind, ToastState } from "./toast";
import { clearAllDrafts, clearDraft, editViewId, readDraft, readStaffView, saveStaffView } from "./draft";
import { ISUSeal, Icon, SlowNotice, Toast } from "./components/shared";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  // null until auth resolves. Never defaults to staff.
  const [role, setRole] = useState<Role | null>(null);
  // false until Firebase has told us whether a session exists, so a signed-in
  // user refreshing the page does not see the login screen flash first.
  const [authReady, setAuthReady] = useState(false);
  // "This is taking longer than usual": one timer over the whole wait, from the
  // splash or the Sign in press until routing ends. signingIn stays true after a
  // sign-in succeeds, so the timer does not restart when the profile load takes
  // over. Only a message: nothing is cancelled and the routing is not touched.
  const [signingIn, setSigningIn] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  // Only the latest routeSignedInUser run clears the two flags: a stuck older
  // run must not hide a newer wait, and a newer run ends an older one's wait.
  const routeRun = useRef(0);
  const [account, setAccount] = useState<StaffAccount>({ uid: "", displayName: "", email: "", department: "" });
  // Live from Firestore once signed in. `thesesLoaded` and `dataError` keep
  // "still loading", "failed to load" and "genuinely empty" distinguishable —
  // otherwise all three look like an empty archive (docs/04 §2.3).
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [thesesLoaded, setThesesLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  // The smart search box's word list and Trie (smartSearch.ts, docs/16): built
  // once per data change and shared by both search boxes, never per keystroke.
  const smartIndex = useMemo(() => buildSmartSearch(theses), [theses]);
  // The pop-up message (toast.ts): a new one replaces the old; each has its own
  // id, so the same words twice start a new toast, and closing goes by id, so
  // an old toast's timer can never close a newer one.
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastSeq = useRef(0);
  const showToast = useCallback((message: string, kind: ToastKind) => {
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, message, kind });
  }, []);
  const closeToast = useCallback((id: number) => setToast(t => (t?.id === id ? null : t)), []);
  // RegisterForm drops a stale Edit draft: something was dropped, so a notice.
  const draftDiscarded = useCallback((message: string) => showToast(message, "notice"), [showToast]);
  const [staffTab, setStaffTab] = useState<StaffTab>("dashboard");
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  // undefined = use the default (staff: own department, students: all).
  const [searchInitialDept, setSearchInitialDept] = useState<string | undefined>(undefined);
  const [summaryData, setSummaryData] = useState<{ theses: RankedThesis[]; query: string } | null>(null);
  const [citeJump, setCiteJump] = useState<{ thesisId: string; nonce: number; open?: boolean } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Stable, so the dialog's Escape listener is not re-added on every render.
  const cancelSignOut = useCallback(() => setConfirmSignOut(false), []);
  // Staff only. The study being edited (the Register form in edit mode, on the
  // staff dashboard), and the one waiting for the "Delete this study?" answer.
  // A copy taken when Edit was pressed, so a live update cannot reset the form.
  const [editing, setEditing] = useState<Thesis | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Thesis | null>(null);
  // Staff only. A reload while editing (remembered view "edit:<id>", draft.ts):
  // the study to reopen in the edit form once the live list has arrived.
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const cancelDelete = useCallback(() => setConfirmDelete(null), []);
  // A link from a Firebase email (?mode=resetPassword|verifyEmail|signIn&oobCode=…)
  // opens AuthActionScreen over everything else (docs/17 §5, §9).
  const [emailAction, setEmailAction] = useState(() => parseEmailAction(window.location.href));
  // Forgot password's sign-in link (errata #85) signs the person in when they
  // press Save. Until they leave that screen, routeSignedInUser does nothing:
  // no dashboard, and no users/{uid} profile write. Set from the first render,
  // before the auth listener below exists.
  const holdRouting = useRef(emailAction?.kind === "sign-in");
  const linkLogged = useRef(false);
  useEffect(() => {
    if (!emailAction || linkLogged.current) return;
    linkLogged.current = true; // once, also under StrictMode's second effect run
    console.info(describeLinkForLog(window.location.href)); // names only, never values
    // The sign-in link is kept in memory only: off the address bar at once.
    if (emailAction.kind === "sign-in") window.history.replaceState(null, "", window.location.pathname);
  }, [emailAction]);
  // "Send a new link" on an expired reset link opens the login card on Forgot password.
  const [loginForgot, setLoginForgot] = useState(false);

  // The single place that turns "a user is signed in" into a role and a
  // screen — for a fresh sign-in, a session restored on refresh, and a
  // password account that has just verified its email ("I've verified").
  const routeSignedInUser = useCallback(async (user: User | null) => {
    if (holdRouting.current) return;
    const run = ++routeRun.current;
    try {
      if (!user) {
        setRole(null);
        setScreen("login");
        setStaffTab("dashboard");
        setSummaryData(null);
        setEditing(null);
        setConfirmDelete(null);
        setPendingEditId(null);
        // Signed out (here or in another tab): no unsaved draft or remembered
        // tab may outlive the session on a shared PC.
        clearAllDrafts();
        setAuthReady(true);
        return;
      }
      if (!isIsuEmail(user.email)) {
        // A non-ISU account got through the popup (or a stale session was
        // restored). Sign out; the auth listener then runs again with null.
        await signOutUser();
        return;
      }
      if (!user.emailVerified) {
        // A password account whose link has not been clicked yet. The rules deny
        // every read until then, so never try the profile (it would fail and
        // fall back to the student view): "Check your ISU inbox" is all it sees.
        // ISU Google accounts are always verified.
        setRole(null);
        setScreen("verify-email");
        setAuthReady(true);
        return;
      }
      setProfileLoading(true);
      try {
        const profile = await getUserProfile(user);
        if (import.meta.env.DEV) {
          console.info("[auth] signed in", { email: user.email, uid: user.uid, profile });
        }
        setAccount({ uid: user.uid, displayName: user.displayName ?? "", email: user.email ?? "", department: profile.department });
        const r: Role = profile.role === "STAFF" ? "staff" : "student";
        setRole(r);
        if (r === "staff") {
          // A reload returns staff to the tab they were on (sessionStorage,
          // draft.ts; another account's tab is ignored). Students: dashboard.
          const view = readStaffView(user.uid);
          const editId = view && editViewId(view);
          if (view === "search") {
            setSearchInitialQuery("");
            setSearchInitialDept(undefined);
            setCiteJump(null);
            setScreen("search");
          } else {
            setStaffTab(view && !editId ? view as StaffTab : "dashboard");
            setPendingEditId(editId || null);
            setScreen("staff-dashboard");
          }
        } else {
          setScreen("student-dashboard");
        }
      } catch (err) {
        // Firestore unreachable or rules not published yet. If the role cannot
        // be confirmed, show the read-only view. Never default to staff — but
        // say why, or a permissions problem is indistinguishable from a student.
        // The name and email still come from the auth account, so the Drive
        // links keep authuser; only the department is unknown.
        console.error("[auth] could not read the user profile; showing the student view", err);
        setAccount({ uid: user.uid, displayName: user.displayName ?? "", email: user.email ?? "", department: "" });
        showToast("Couldn't load your profile, so you're seeing the student view. Check your connection and sign in again.", "error");
        setRole("student");
        setScreen("student-dashboard");
      }
      setLoginForgot(false); // the next sign-out shows the normal sign-in card
      setAuthReady(true);
    } finally {
      if (run === routeRun.current) {
        setProfileLoading(false);
        setSigningIn(false);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, routeSignedInUser);
    return unsub; // cleanup: without it every re-mount leaks a listener
  }, [routeSignedInUser]);

  // When the wait ends, for any reason, the message goes with it.
  const waiting = !authReady || signingIn || profileLoading;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), SLOW_WAIT_MS);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [waiting]);

  // Live theses. Only while signed in: the rules deny every read to signed-out
  // users, so subscribing earlier would just produce a permission error.
  useEffect(() => {
    setTheses([]);
    setThesesLoaded(false);
    setDataError(null);
    if (!role) return;
    return subscribeToTheses(
      (list) => { setTheses(list); setThesesLoaded(true); setDataError(null); },
      (err) => {
        console.error("[data] could not load theses", err);
        setDataError("Could not load the e-library. Check your connection and reload the page.");
      },
    ); // the returned unsubscribe is the cleanup — no leaked listener per role change
  }, [role]);

  // Reopen the study that was being edited before a reload, once the live
  // list is here (a copy, as Edit takes). Deleted since → back to the
  // dashboard, and its unsaved draft goes, never silently.
  useEffect(() => {
    if (!pendingEditId || !thesesLoaded) return;
    const study = theses.find(t => t.id === pendingEditId);
    setPendingEditId(null);
    if (study) {
      setEditing(study);
      return;
    }
    const hadDraft = !!readDraft(account.uid, pendingEditId);
    clearDraft(pendingEditId);
    showToast(hadDraft
      ? "That study is no longer in the e-library, so your unsaved changes were discarded."
      : "That study is no longer in the e-library.", "notice");
  }, [pendingEditId, thesesLoaded, theses, account.uid, showToast]);

  // Remember the staff screen for a reload (sessionStorage, draft.ts).
  // Not while an edit is waiting to reopen, or it would overwrite "edit:<id>".
  useEffect(() => {
    if (role !== "staff" || pendingEditId) return;
    if (editing) saveStaffView(account.uid, `edit:${editing.id}`);
    else if (screen === "search") saveStaffView(account.uid, "search");
    else if (screen === "staff-dashboard") saveStaffView(account.uid, staffTab);
  }, [role, pendingEditId, editing, screen, staffTab, account.uid]);

  // Every screen and staff tab shares one page scroll, so each change starts at
  // the top — except opening a study ("View details"): SearchScreen
  // scrolls to it. A layout effect runs before every passive (useEffect) effect,
  // child or parent, so this can never undo the jump's scroll; skipping it when a
  // jump is pending also avoids a jump to the top first. (A summary citation does
  // not change the screen, so it never gets here.) goSearch clears citeJump, so
  // only openStudy arrives on Search with one set.
  useLayoutEffect(() => {
    if (screen === "search" && citeJump) return;
    window.scrollTo(0, 0);
    // citeJump is read, not a dependency: only a change of screen or tab scrolls.
  }, [screen, staffTab]);

  // Rejects on failure so RegisterForm can show the error and stay open.
  async function handleSave(thesis: NewThesis) {
    await saveThesis(thesis);
    showToast("Study posted!", "success");
  }

  // Study Details → Edit: the edit form, on the staff dashboard.
  function startEdit(thesis: Thesis) {
    setEditing(thesis);
    setScreen("staff-dashboard");
  }

  // Cancel / Back: nothing saved; back to the search screen at that study.
  function cancelEdit() {
    const id = editing?.id;
    setEditing(null);
    if (id) openStudy(id);
  }

  // Rejects on failure (updateThesis has a clear message) so the form stays
  // open and shows it. registeredAt/registeredBy are left as they were.
  async function handleEditSave(fields: NewThesis) {
    if (!editing) return;
    const id = editing.id;
    await updateThesis(id, fields);
    showToast("Study updated", "success");
    setEditing(null);
    openStudy(id);
  }

  // The dialog closes at once; the study leaves every list, dashboard and
  // statistic through the live subscription. A failure is a toast, not a crash.
  function confirmedDelete() {
    const thesis = confirmDelete;
    setConfirmDelete(null);
    if (!thesis) return;
    deleteThesis(thesis.id)
      .then(() => showToast("Study deleted", "success"))
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : "Could not delete the study. Try again.", "error"));
  }

  // Every Sign Out button only asks; the dialog's "Sign Out" really signs out.
  function handleSignOut() {
    setConfirmSignOut(true);
  }

  // onAuthStateChanged(null) does the screen reset; nothing else to tear down.
  function confirmedSignOut() {
    setConfirmSignOut(false);
    signOutUser().catch(() => showToast("Sign-out failed. Try again.", "error"));
  }

  // Leaving AuthActionScreen: drop the one-time code from the address bar. If
  // this browser is signed in to the account that just verified, carry on to
  // its dashboard instead of leaving it on "Check your ISU inbox".
  async function exitEmailAction(to: AuthActionExit) {
    window.history.replaceState(null, "", window.location.pathname);
    if (emailAction?.kind === "sign-in") {
      // A half-finished reset never leaves a session behind, and the normal
      // saved session is back before the login screen can sign anyone in.
      await linkReset(emailAction.href).leave();
      holdRouting.current = false;
      setEmailAction(null);
      setLoginForgot(to === "forgot");
      await routeSignedInUser(auth.currentUser);
      return;
    }
    setEmailAction(null);
    setLoginForgot(to === "forgot");
    const user = auth.currentUser;
    if (user && !user.emailVerified && await checkEmailVerified().catch(() => false)) {
      routeSignedInUser(user);
    }
  }

  function goSearch(q = "", department?: string) {
    setSearchInitialQuery(q);
    setSearchInitialDept(department);
    // An old jump would otherwise fire again when the search screen remounts.
    setCiteJump(null);
    setPendingEditId(null); // staff moved on before a reloaded edit reopened
    setScreen("search");
  }

  // Dashboard "View details": the search screen, every study listed (no query,
  // all departments, so this one is surely there), with this study's Study
  // Details open and scrolled into view — the same jump the summary citations use.
  function openStudy(thesisId: string) {
    setSearchInitialQuery("");
    setSearchInitialDept("");
    setCiteJump({ thesisId, nonce: Date.now(), open: true });
    setPendingEditId(null);
    setScreen("search");
  }

  function handleCombinedSummary(results: RankedThesis[], query: string) {
    setSummaryData({ theses: results, query });
  }

  if (emailAction) {
    return emailAction.kind === "sign-in"
      ? <AuthActionScreen mode="signIn" oobCode="" signInHref={emailAction.href} onExit={exitEmailAction} />
      : <AuthActionScreen mode={emailAction.mode} oobCode={emailAction.oobCode} onExit={exitEmailAction} />;
  }

  if (!authReady) {
    return (
      <div className="splash" role="status" aria-label="Loading">
        <div className="animate-fade-in"><ISUSeal size={56} /></div>
        {slow && <SlowNotice />}
      </div>
    );
  }

  return (
    <div className="app-root">
      {role && (dataError || !thesesLoaded) && (
        <div role={dataError ? "alert" : "status"}
          className={`data-banner ${dataError ? "data-banner--error" : "data-banner--loading"}`}>
          {dataError
            ? <><Icon name="alert" size={16} />{dataError}</>
            : <><span className="animate-spin" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(var(--accent-rgb), 0.2)", borderTopColor: "var(--accent)" }} />Loading the e-library…</>}
        </div>
      )}

      {screen === "login" && (
        <LoginScreen key={String(loginForgot)} initialMode={loginForgot ? "forgot" : "sign-in"}
          slow={slow} onSigningIn={setSigningIn} />
      )}

      {screen === "verify-email" && (
        <VerifyEmailScreen email={auth.currentUser?.email ?? ""} slow={slow}
          onVerified={() => routeSignedInUser(auth.currentUser)} />
      )}

      {screen === "staff-dashboard" && (
        <StaffDashboard
          theses={theses}
          studiesReady={thesesLoaded}
          studiesError={dataError}
          account={account}
          activeTab={staffTab}
          onTabChange={t => { setEditing(null); setPendingEditId(null); setStaffTab(t); }}
          onSave={handleSave}
          editing={editing}
          onEditSave={handleEditSave}
          onEditCancel={cancelEdit}
          onSearch={(q, dept) => { setEditing(null); goSearch(q, dept); }}
          onOpenStudy={openStudy}
          onSignOut={handleSignOut}
          onDraftDiscarded={draftDiscarded}
        />
      )}

      {screen === "student-dashboard" && (
        <StudentDashboard theses={theses} smartIndex={smartIndex} account={account} onSearch={goSearch}
          onBrowseDepartment={dept => goSearch("", dept)} onOpenStudy={openStudy} onSignOut={handleSignOut} />
      )}

      {screen === "search" && role && (
        <SearchScreen
          theses={theses}
          smartIndex={smartIndex}
          role={role}
          viewerEmail={account.email}
          initialQuery={searchInitialQuery}
          defaultDepartment={account.department}
          initialDepartment={searchInitialDept}
          jumpTo={citeJump}
          onCombinedSummary={handleCombinedSummary}
          onEdit={role === "staff" ? startEdit : undefined}
          onDelete={role === "staff" ? setConfirmDelete : undefined}
          onBack={() => setScreen(role === "staff" ? "staff-dashboard" : "student-dashboard")}
          onSignOut={handleSignOut}
        />
      )}

      {summaryData && (
        <CombinedSummaryPanel
          theses={summaryData.theses}
          query={summaryData.query}
          onClose={() => setSummaryData(null)}
          onCiteJump={thesisId => { setSummaryData(null); setCiteJump({ thesisId, nonce: Date.now() }); }}
        />
      )}

      {confirmSignOut && (
        <SignOutDialog onConfirm={confirmedSignOut} onCancel={cancelSignOut} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          icon="trash"
          title="Delete this study?"
          detail={confirmDelete.title}
          description="This removes it from the e-library for everyone and cannot be undone. The PDF stays in Google Drive."
          confirmLabel="Delete"
          onConfirm={confirmedDelete}
          onCancel={cancelDelete}
        />
      )}

      {toast && <Toast key={toast.id} id={toast.id} message={toast.message} kind={toast.kind} onClose={closeToast} />}
    </div>
  );
}
