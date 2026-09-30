import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import "./App.css";
import type { Role, Screen, StaffTab, Thesis } from "./types";
import { auth } from "./firebase";
import { SAMPLE_THESES, getUserProfile, isIsuEmail, signOutUser } from "./data";
import { LoginScreen } from "./components/LoginScreen";
import { StaffDashboard } from "./components/StaffDashboard";
import { RegisterForm } from "./components/RegisterForm";
import { StudentDashboard } from "./components/StudentDashboard";
import { SearchScreen } from "./components/SearchScreen";
import { CombinedSummaryPanel } from "./components/CombinedSummaryPanel";
import { ISUSeal, Toast } from "./components/shared";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  // null until auth resolves. Never defaults to staff.
  const [role, setRole] = useState<Role | null>(null);
  // false until Firebase has told us whether a session exists, so a signed-in
  // user refreshing the page does not see the login screen flash first.
  const [authReady, setAuthReady] = useState(false);
  const [theses, setTheses] = useState<Thesis[]>(SAMPLE_THESES);
  const [toast, setToast] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<StaffTab>("dashboard");
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [summaryData, setSummaryData] = useState<{ theses: Thesis[]; query: string } | null>(null);

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
        const r: Role = profile.role === "STAFF" ? "staff" : "student";
        setRole(r);
        setScreen(r === "staff" ? "staff-dashboard" : "student-dashboard");
      } catch {
        // Firestore unreachable or rules not published yet. If the role cannot
        // be confirmed, show the read-only view. Never default to staff.
        setRole("student");
        setScreen("student-dashboard");
      }
      setAuthReady(true);
    });
    return unsub; // cleanup: without it every re-mount leaks a listener
  }, []);

  function handleRegisterSuccess(thesis: Thesis) {
    setTheses(prev => [thesis, ...prev]);
    setTimeout(() => setToast("Thesis registered!"), 100);
  }

  // onAuthStateChanged(null) does the screen reset; nothing else to tear down.
  function handleSignOut() {
    signOutUser().catch(() => setToast("Sign-out failed. Try again."));
  }

  function goSearch(q = "") {
    setSearchInitialQuery(q);
    setScreen("search");
  }

  function handleCombinedSummary(results: Thesis[], query: string) {
    setSummaryData({ theses: results, query });
  }

  if (!authReady) {
    return (
      <div className="app-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="animate-fade-in"><ISUSeal size={56} /></div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {screen === "login" && <LoginScreen />}

      {screen === "staff-dashboard" && (
        <StaffDashboard
          theses={theses}
          activeTab={staffTab}
          onTabChange={setStaffTab}
          onRegisterSuccess={thesis => { handleRegisterSuccess(thesis); }}
          onSearch={() => goSearch()}
          onSignOut={handleSignOut}
        />
      )}

      {screen === "student-dashboard" && (
        <StudentDashboard theses={theses} onSearch={goSearch} onSignOut={handleSignOut} />
      )}

      {screen === "search" && role && (
        <SearchScreen
          theses={theses}
          role={role}
          initialQuery={searchInitialQuery}
          onCombinedSummary={handleCombinedSummary}
          onBack={() => setScreen(role === "staff" ? "staff-dashboard" : "student-dashboard")}
        />
      )}

      {summaryData && (
        <CombinedSummaryPanel
          theses={summaryData.theses}
          query={summaryData.query}
          onClose={() => setSummaryData(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
