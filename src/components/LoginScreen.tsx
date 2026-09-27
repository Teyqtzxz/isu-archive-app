import { useState } from "react";
import type { Screen, Role, Thesis } from "../types";
import { ISUSeal } from "./shared";

export function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("staff");

  function handleLogin() {
    setLoading(true);
    setTimeout(() => onLogin(selectedRole), 1400);
  }

  return (
    <div className="login-wrap">
      {/* Top brand stripe */}
      <div className="login-stripe" />

      {/* BG circles */}
      <div className="bg-circle bg-circle--a" />
      <div className="bg-circle bg-circle--b" />

      <div className="animate-fade-in login-card">
        {/* Seal */}
        <div className="login-seal-row">
          <ISUSeal size={72} />
        </div>

        <h1 className="login-h1">
          ISU Thesis Archive
        </h1>
        <p className="login-sub-title">
          Isabela State University
        </p>
        <p className="login-sub-campus">
          Echague Campus
        </p>

        <div className="login-divider" />

        {/* Role selector */}
        <div style={{ marginBottom: 20 }}>
          <p className="role-label">
            Sign in as
          </p>
          <div className="role-grid">
            {(["staff", "student"] as Role[]).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`role-btn${selectedRole === role ? " role-btn-active" : ""}`}
              >
                <span className="role-emoji">{role === "staff" ? "👩‍💼" : "🎓"}</span>
                <span className={`role-name ${selectedRole === role ? "role-name-active" : "role-name-default"}`}>
                  {role === "staff" ? "Research Staff" : "Student"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Info pill */}
        <div className="info-pill">
          <p>
            {selectedRole === "staff" ? "🔒 Staff access · Register & manage theses" : "🔍 Student access · Search & browse archive"}
          </p>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="gbtn"
        >
          {loading ? (
            <>
              <div className="animate-spin" style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(0,100,57,0.15)", borderTopColor: "#006439" }} />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with ISU Google Account
            </>
          )}
        </button>

        <p className="login-foot">
          Secure login with your @isu.edu.ph account
        </p>
      </div>

      <div className="site-foot">
        <p>© 2025 Isabela State University · Echague Campus</p>
      </div>
    </div>
  );
}

// ─── Screen 2: Staff Dashboard ────────────────────────────────────────────────
