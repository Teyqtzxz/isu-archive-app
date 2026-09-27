import { useState } from "react";
import "./App.css";
import type { Role, Screen, StaffTab, Thesis } from "./types";
import { SAMPLE_THESES } from "./data";
import { LoginScreen } from "./components/LoginScreen";
import { StaffDashboard } from "./components/StaffDashboard";
import { RegisterForm } from "./components/RegisterForm";
import { StudentDashboard } from "./components/StudentDashboard";
import { SearchScreen } from "./components/SearchScreen";
import { CombinedSummaryPanel } from "./components/CombinedSummaryPanel";
import { Toast } from "./components/shared";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [role, setRole] = useState<Role>("staff");
  const [theses, setTheses] = useState<Thesis[]>(SAMPLE_THESES);
  const [toast, setToast] = useState<string | null>(null);
  const [staffTab, setStaffTab] = useState<StaffTab>("dashboard");
  const [searchInitialQuery, setSearchInitialQuery] = useState("");
  const [summaryData, setSummaryData] = useState<{ theses: Thesis[]; query: string } | null>(null);

  function handleLogin(r: Role) {
    setRole(r);
    setScreen(r === "staff" ? "staff-dashboard" : "student-dashboard");
  }

  function handleRegisterSuccess(thesis: Thesis) {
    setTheses(prev => [thesis, ...prev]);
    setTimeout(() => setToast("Thesis registered!"), 100);
  }

  function handleSignOut() {
    setScreen("login");
    setRole("staff");
    setStaffTab("dashboard");
  }

  function goSearch(q = "") {
    setSearchInitialQuery(q);
    setScreen("search");
  }

  function handleCombinedSummary(results: Thesis[], query: string) {
    setSummaryData({ theses: results, query });
  }

  return (
    <div className="app-root">
      {screen === "login" && <LoginScreen onLogin={handleLogin} />}

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

      {screen === "search" && (
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
