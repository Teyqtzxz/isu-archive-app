import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import "./App.css";
import type { NewThesis, Role, Screen, StaffTab, Thesis } from "./types";
import { auth } from "./firebase";
import {
  getUserProfile, isIsuEmail, saveThesis, signOutUser, subscribeToTheses,
} from "./data";
import { LoginScreen } from "./components/LoginScreen";
import { StaffDashboard, type StaffAccount } from "./components/StaffDashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { SearchScreen } from "./components/SearchScreen";
import { CombinedSummaryPanel } from "./components/CombinedSummaryPanel";
import { SignOutDialog } from "./components/SignOutDialog";
import type { RankedThesis } from "./summary";
import { ISUSeal, Icon, Toast } from "./components/shared";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  // null until auth resolves. Never defaults to staff.
  const [role, setRole] = useState<Role | null>(null);
  // false until Firebase has told us whether a session exists, so a signed-in
  // user refreshing the page does not see the login screen flash first.
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState<StaffAccount>({ displayName: "", email: "", department: "" });
  // Live from Firestore once signed in. `thesesLoaded` and `dataError` keep
  // "still loading", "failed to load" and "genuinely empty" distinguishable —
  // otherwise all three look like an empty archive (docs/04 §2.3).
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [thesesLoaded, setThesesLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<StaffTab>("dashboard");
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  // undefined = use the default (staff: own department, students: all).
  const [searchInitialDept, setSearchInitialDept] = useState<string | undefined>(undefined);
  const [summaryData, setSummaryData] = useState<{ theses: RankedThesis[]; query: string } | null>(null);
  const [citeJump, setCiteJump] = useState<{ thesisId: string; nonce: number } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  // Stable, so the dialog's Escape listener is not re-added on every render.
  const cancelSignOut = useCallback(() => setConfirmSignOut(false), []);

  // The single place that turns "a user is signed in" into a role and a
  // screen — for a fresh sign-in and for a session restored on refresh alike.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setRole(null);
        setScreen("login");
        setStaffTab("dashboard");
        setSummaryData(null);
        setAuthReady(true);
        return;
      }
      if (!isIsuEmail(user.email)) {
        // A non-ISU account got through the popup (or a stale session was
        // restored). Sign out; this callback then runs again with null.
        await signOutUser();
        return;
      }
      try {
        const profile = await getUserProfile(user);
        if (import.meta.env.DEV) {
          console.info("[auth] signed in", { email: user.email, uid: user.uid, profile });
        }
        setAccount({ displayName: user.displayName ?? "", email: user.email ?? "", department: profile.department });
        const r: Role = profile.role === "STAFF" ? "staff" : "student";
        setRole(r);
        setScreen(r === "staff" ? "staff-dashboard" : "student-dashboard");
      } catch (err) {
        // Firestore unreachable or rules not published yet. If the role cannot
        // be confirmed, show the read-only view. Never default to staff — but
        // say why, or a permissions problem is indistinguishable from a student.
        console.error("[auth] could not read the user profile; showing the student view", err);
        setRole("student");
        setScreen("student-dashboard");
      }
      setAuthReady(true);
    });
    return unsub; // cleanup: without it every re-mount leaks a listener
  }, []);

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

  // Rejects on failure so RegisterForm can show the error and stay open.
  async function handleSave(thesis: NewThesis) {
    await saveThesis(thesis);
    setToast("Study posted!");
  }

  // Every Sign Out button only asks; the dialog's "Sign Out" really signs out.
  function handleSignOut() {
    setConfirmSignOut(true);
  }

  // onAuthStateChanged(null) does the screen reset; nothing else to tear down.
  function confirmedSignOut() {
    setConfirmSignOut(false);
    signOutUser().catch(() => setToast("Sign-out failed. Try again."));
  }

  function goSearch(q = "", department?: string) {
    setSearchInitialQuery(q);
    setSearchInitialDept(department);
    setScreen("search");
  }

  function handleCombinedSummary(results: RankedThesis[], query: string) {
    setSummaryData({ theses: results, query });
  }

  if (!authReady) {
    return (
      <div className="splash" role="status" aria-label="Loading">
        <div className="animate-fade-in"><ISUSeal size={56} /></div>
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
            : <><span className="animate-spin" style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,100,57,0.2)", borderTopColor: "var(--isu-green)" }} />Loading the e-library…</>}
        </div>
      )}

      {screen === "login" && <LoginScreen />}

      {screen === "staff-dashboard" && (
        <StaffDashboard
          theses={theses}
          account={account}
          activeTab={staffTab}
          onTabChange={setStaffTab}
          onSave={handleSave}
          onSearch={goSearch}
          onSignOut={handleSignOut}
        />
      )}

      {screen === "student-dashboard" && (
        <StudentDashboard theses={theses} account={account} onSearch={goSearch}
          onBrowseDepartment={dept => goSearch("", dept)} onSignOut={handleSignOut} />
      )}

      {screen === "search" && role && (
        <SearchScreen
          theses={theses}
          role={role}
          viewerEmail={account.email}
          initialQuery={searchInitialQuery}
          defaultDepartment={account.department}
          initialDepartment={searchInitialDept}
          jumpTo={citeJump}
          onCombinedSummary={handleCombinedSummary}
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

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
