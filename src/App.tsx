import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = "login" | "staff-dashboard" | "register" | "search" | "summary" | "student-dashboard";
type Role = "staff" | "student";
type ExtractionState = "idle" | "extracting" | "success" | "needs_review";
type StaffTab = "dashboard" | "register" | "search" | "settings";

interface Thesis {
  id: string;
  title: string;
  department: string;
  year: number;
  adviser: string;
  abstract: string;
  keywords: string[];
  status: "archived" | "pending" | "needs_review";
  dateAdded: string;
  driveLink: string;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_THESES: Thesis[] = [
  {
    id: "1",
    title: "Biodiversity Assessment of Macro-invertebrates in Cagayan River Tributaries of Isabela Province",
    department: "Biology",
    year: 2024,
    adviser: "Dr. Maria Santos",
    abstract: "This study assessed the biodiversity of macro-invertebrates in selected tributaries of the Cagayan River within Isabela Province. Using standard sampling protocols, 47 taxa were identified across 12 sampling stations. Shannon diversity index values ranged from 1.84 to 3.21, with upstream stations showing significantly higher diversity. Results indicate that agricultural runoff and sedimentation are primary stressors affecting macroinvertebrate communities. The study recommends targeted riparian buffer restoration and agricultural best management practices to improve water quality and ecological integrity in the region.",
    keywords: ["biodiversity", "macroinvertebrates", "Cagayan River", "water quality", "ecological assessment"],
    status: "archived",
    dateAdded: "2024-11-15",
    driveLink: "#",
  },
  {
    id: "2",
    title: "Precision Agriculture Using IoT-Based Soil Moisture Monitoring for Rice Cultivation in Echague Valley",
    department: "Agriculture",
    year: 2024,
    adviser: "Engr. Jose Reyes",
    abstract: "This research developed and validated an IoT-based soil moisture monitoring system tailored for rice cultivation in the Echague Valley. Sixteen sensor nodes deployed across four rice paddies transmitted real-time soil moisture data via LoRaWAN to a cloud dashboard. Irrigation scheduling based on sensor data reduced water usage by 34% compared to traditional flood irrigation while maintaining comparable yields of 6.2 t/ha. The system achieved 94.7% uptime over a 120-day growing season, demonstrating viability for smallholder farmers with minimal technical overhead.",
    keywords: ["IoT", "precision agriculture", "soil moisture", "rice cultivation", "LoRaWAN", "irrigation"],
    status: "archived",
    dateAdded: "2024-10-28",
    driveLink: "#",
  },
  {
    id: "3",
    title: "Machine Learning-Based Early Detection of Blast Disease in Lowland Rice Using Hyperspectral Imaging",
    department: "Computer Science",
    year: 2024,
    adviser: "Dr. Anna Cruz",
    abstract: "A convolutional neural network model was developed to detect early-stage rice blast disease (Magnaporthe oryzae) using hyperspectral images captured by UAV-mounted sensors. The model achieved 96.3% accuracy in distinguishing blast-infected from healthy leaf tissue at 3–5 days pre-symptomatic stage. Transfer learning from ResNet-50 backbone reduced training requirements to 1,200 labeled samples. Field validation across three municipalities in Isabela demonstrated 89.1% precision under variable lighting conditions.",
    keywords: ["machine learning", "rice blast", "hyperspectral imaging", "CNN", "UAV", "plant disease detection"],
    status: "archived",
    dateAdded: "2024-09-12",
    driveLink: "#",
  },
  {
    id: "4",
    title: "Community-Based Agroforestry Practices and Their Impact on Carbon Sequestration in Upland Isabela",
    department: "Forestry",
    year: 2023,
    adviser: "Dr. Roberto Dela Cruz",
    abstract: "This study quantified carbon sequestration potential of community-based agroforestry systems in upland Isabela using allometric equations and field measurements across 85 plots in 12 barangays. Agroforestry systems stored an average of 47.3 Mg C/ha compared to 12.1 Mg C/ha in monoculture corn. Integration of timber species such as Gmelina arborea with perennial crops significantly enhanced above-ground biomass accumulation. Socioeconomic analysis revealed that participating households earned 28% higher net income.",
    keywords: ["agroforestry", "carbon sequestration", "upland farming", "biomass", "Isabela", "sustainable agriculture"],
    status: "archived",
    dateAdded: "2023-12-01",
    driveLink: "#",
  },
  {
    id: "5",
    title: "Development of Cassava-Based Bioethanol as Alternative Fuel Source for Rural Communities in Cagayan Valley",
    department: "Chemical Engineering",
    year: 2024,
    adviser: "Engr. Liza Pagulayan",
    abstract: "This research optimized fermentation conditions for bioethanol production from locally-sourced cassava starch in Cagayan Valley. Using Saccharomyces cerevisiae under controlled pH (4.5–5.0) and temperature (30–32°C), maximum ethanol yield of 0.48 g/g was achieved at 72-hour fermentation. Life cycle assessment indicated 67% reduction in greenhouse gas emissions compared to conventional gasoline, with raw material costs of PHP 18.40 per liter making it economically viable for rural energy cooperatives.",
    keywords: ["bioethanol", "cassava", "fermentation", "biofuel", "Cagayan Valley", "renewable energy"],
    status: "archived",
    dateAdded: "2024-08-20",
    driveLink: "#",
  },
  {
    id: "6",
    title: "Watershed Management Plan for Pinacanauan River Using GIS-Based Hydrological Modeling",
    department: "Environmental Science",
    year: 2023,
    adviser: "Dr. Carmen Villanueva",
    abstract: "A comprehensive watershed management plan was formulated for the Pinacanauan River watershed using GIS-integrated SWAT hydrological modeling. Land use/land cover analysis revealed 23% forest cover loss over 15 years, contributing to elevated peak discharge and sediment loads. Simulated intervention scenarios indicated that reforestation of 8,000 ha of critical watershed areas would reduce peak flows by 31% and sediment yield by 44%. The study provides spatial prioritization maps for intervention and a governance framework involving 24 barangays across three municipalities.",
    keywords: ["watershed management", "GIS", "hydrological modeling", "SWAT", "Pinacanauan River", "reforestation"],
    status: "pending",
    dateAdded: "2024-12-02",
    driveLink: "#",
  },
  {
    id: "7",
    title: "Effectiveness of Project-Based Learning on Student Academic Performance in STEM Education",
    department: "Education",
    year: 2024,
    adviser: "Prof. Elena Bulan",
    abstract: "This quasi-experimental study evaluated the effectiveness of project-based learning (PBL) on academic performance among Grade 11 STEM students in Echague, Isabela. Using a pretest-posttest control group design with 120 participants, the PBL group demonstrated significantly higher posttest scores (mean = 84.2) compared to the traditional instruction group (mean = 76.5). Qualitative interviews revealed increased engagement, self-directed learning, and collaborative skills among PBL participants. The study recommends integration of PBL approaches across STEM disciplines in senior high school programs.",
    keywords: ["project-based learning", "STEM education", "academic performance", "senior high school", "Isabela"],
    status: "archived",
    dateAdded: "2024-07-18",
    driveLink: "#",
  },
  {
    id: "8",
    title: "Impact of E-Commerce Adoption on the Revenue Growth of Micro-Enterprises in Echague Municipality",
    department: "Business Administration",
    year: 2023,
    adviser: "Dr. Paulo Mendoza",
    abstract: "This descriptive-correlational study examined the impact of e-commerce adoption on revenue growth among 180 registered micro-enterprises in Echague, Isabela. Findings revealed a statistically significant positive correlation (r = 0.67, p < 0.01) between e-commerce usage and quarterly revenue growth. Facebook Marketplace and Shopee were the most widely used platforms, while internet connectivity and digital literacy remained primary adoption barriers. Recommendations include targeted digital training programs and municipal Wi-Fi infrastructure development.",
    keywords: ["e-commerce", "micro-enterprises", "revenue growth", "digital commerce", "Echague", "business administration"],
    status: "needs_review",
    dateAdded: "2024-12-05",
    driveLink: "#",
  },
];

const DEPARTMENTS = ["Biology", "Agriculture", "Computer Science", "Forestry", "Chemical Engineering", "Environmental Science", "Education", "Business Administration", "Civil Engineering", "Nursing"];
const ADVISERS = ["Dr. Maria Santos", "Engr. Jose Reyes", "Dr. Anna Cruz", "Dr. Roberto Dela Cruz", "Engr. Liza Pagulayan", "Dr. Carmen Villanueva", "Dr. Paulo Mendoza", "Prof. Elena Bulan"];

// ─── BM25 ─────────────────────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
}

function findMatchScore(queryTerm: string, docToken: string): number {
  if (queryTerm.length < 2) return 0;
  if (docToken === queryTerm) return 1;
  if (docToken.startsWith(queryTerm)) return 0.8;
  // A mid-token match is only trustworthy for longer terms. Without this guard
  // "rate" matches generate/accurate/graduate/corporate, and a thesis stuffed
  // with those words outranks the one that actually contains the term.
  if (queryTerm.length >= 4 && docToken.includes(queryTerm)) return 0.6;
  return 0;
}

function docTextOf(t: Thesis): string {
  return `${t.title} ${t.abstract} ${t.keywords.join(" ")}`;
}

/** Pre-tokenised corpus. Built once per result set, not once per keystroke. */
interface SearchIndex {
  docTokens: string[][];
  avgDocLen: number;
  vocab: string[];
  postings: Map<string, number[]>;
}

function buildIndex(theses: Thesis[]): SearchIndex {
  const docTokens = theses.map(t => tokenize(docTextOf(t)));
  const totalLen = docTokens.reduce((n, ts) => n + ts.length, 0);
  const postings = new Map<string, number[]>();
  docTokens.forEach((ts, i) => {
    for (const tok of new Set(ts)) {
      const list = postings.get(tok);
      if (list) list.push(i);
      else postings.set(tok, [i]);
    }
  });
  return {
    docTokens,
    // Guard: an empty corpus must not produce NaN and poison every score.
    avgDocLen: docTokens.length > 0 ? totalLen / docTokens.length : 1,
    vocab: Array.from(postings.keys()),
    postings,
  };
}

/** Document frequency per query term, computed once per query. */
function computeDocFreq(tokens: string[], index: SearchIndex): Map<string, number> {
  const df = new Map<string, number>();
  for (const term of tokens) {
    if (df.has(term)) continue;
    const seen = new Set<number>();
    for (const v of index.vocab) {
      if (findMatchScore(term, v) > 0) {
        for (const i of index.postings.get(v)!) seen.add(i);
      }
    }
    df.set(term, seen.size);
  }
  return df;
}

/** Which field produced the match, for the "Why this rank?" breakdown. */
function bestFieldFor(t: Thesis, queryTerm: string): string {
  if (tokenize(t.title).some(x => findMatchScore(queryTerm, x) > 0)) return "title";
  if (tokenize(t.keywords.join(" ")).some(x => findMatchScore(queryTerm, x) > 0)) return "keyword";
  return "abstract";
}

function bm25Score(query: string, thesis: Thesis, docIndex: number, index: SearchIndex, df: Map<string, number>): { score: number; termScores: { term: string; score: number; field: string }[] } {
  const k1 = 1.5, b = 0.75;
  const N = index.docTokens.length;
  const docTokens = index.docTokens[docIndex];
  const docLen = docTokens.length;
  const termScores: { term: string; score: number; field: string }[] = [];
  let total = 0;
  for (const queryTerm of tokenize(query)) {
    const dfCount = df.get(queryTerm) ?? 0;
    if (dfCount === 0) continue;

    // Weighted term frequency: exact hits count 1.0, prefix 0.8, substring 0.6.
    let bestTf = 0;
    for (const dt of docTokens) {
      const m = findMatchScore(queryTerm, dt);
      if (m > 0) bestTf += m;
    }
    if (bestTf === 0) continue;

    const idf = Math.log((N - dfCount + 0.5) / (dfCount + 0.5) + 1);
    const tfNorm = (bestTf * (k1 + 1)) / (bestTf + k1 * (1 - b + b * (docLen / index.avgDocLen)));
    const s = idf * tfNorm;
    termScores.push({ term: queryTerm, score: s, field: bestFieldFor(thesis, queryTerm) });
    total += s;
  }
  return { score: total, termScores };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function ISUSeal({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, #006439 60%, #004d2b 100%)",
      border: `${size > 36 ? 2 : 1.5}px solid rgba(247,208,0,0.55)`,
      boxShadow: "0 2px 8px rgba(0,100,57,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontWeight: 800, color: "#F7D000", fontSize: size * 0.38, letterSpacing: "-0.5px", lineHeight: 1 }}>ISU</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Thesis["status"] }) {
  const cls = {
    archived: "status-archived",
    pending: "status-pending",
    needs_review: "status-needs-review",
  }[status];
  const label = {
    archived: "Archived",
    pending: "Pending",
    needs_review: "Needs Review",
  }[status];
  return (
    <span className={`status-badge ${cls}`}>
      {label}
    </span>
  );
}

function DeptBadge({ dept, small }: { dept: string; small?: boolean }) {
  return (
    <span className={`dept-badge${small ? " dept-badge--small" : ""}`}>
      {dept}
    </span>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="animate-toast isu-toast">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  );
}

// ─── Screen 1: Login ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
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
function StaffDashboard({
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
    pending: theses.filter(t => t.status === "pending" || t.status === "needs_review").length,
    thisMonth: theses.filter(t => t.dateAdded.startsWith(thisMonthPrefix)).length,
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
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>· {t.dateAdded}</span>
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

// ─── Register Form (reusable) ─────────────────────────────────────────────────
function RegisterForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: (thesis: Thesis) => void }) {
  const [extractState, setExtractState] = useState<ExtractionState>("idle");
  const [form, setForm] = useState({ driveLink: "", title: "", department: "", year: "2024", adviser: "" });
  const [abstract, setAbstract] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKw, setNewKw] = useState("");
  const [error, setError] = useState("");

  const MOCK_ABSTRACT = "This study investigates the application of machine learning algorithms for predictive modeling of crop yield in Isabela Province, Philippines. Using historical weather data, soil profiles, and satellite imagery from 2010 to 2023, a gradient boosting model achieved 87.3% prediction accuracy for palay yield. Feature importance analysis revealed that soil nitrogen content and rainfall distribution during the tillering stage are primary determinants of yield variability. The model offers practical value for agricultural planning at the municipal level, enabling early intervention and resource allocation optimization.";
  const MOCK_KEYWORDS = ["machine learning", "crop yield prediction", "palay", "Isabela Province", "gradient boosting", "precision agriculture"];

  const steps = [
    { label: "Fill Details", active: extractState === "idle" || extractState === "extracting", done: extractState !== "idle" },
    { label: "Processing", active: extractState === "extracting", done: extractState === "success" || extractState === "needs_review" },
    { label: "Review & Save", active: extractState === "success" || extractState === "needs_review", done: false },
  ];

  function handleSubmit() {
    if (!form.driveLink || !form.title || !form.department || !form.adviser) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!form.driveLink.includes("drive.google.com")) {
      setError("Please enter a valid Google Drive link (drive.google.com).");
      return;
    }
    setError("");
    setExtractState("extracting");
    setTimeout(() => {
      setAbstract(MOCK_ABSTRACT);
      setKeywords(MOCK_KEYWORDS);
      setExtractState(Math.random() > 0.3 ? "success" : "needs_review");
    }, 2800);
  }

  function handleSave() {
    onSuccess({
      id: Date.now().toString(), title: form.title, department: form.department,
      year: parseInt(form.year), adviser: form.adviser, abstract, keywords,
      status: "archived", dateAdded: new Date().toISOString().split("T")[0], driveLink: form.driveLink,
    });
  }

  return (
    <div className="animate-fade-in">
      {/* Step indicator */}
      <div className="steps-row">
        {steps.map((s, i) => (
          <div key={s.label} className="step-col">
            <div className="step-node-wrap" style={{ opacity: s.active || s.done ? 1 : 0.38 }}>
              <div className={`step-node ${s.done ? "step-node-done" : s.active ? "step-node-active" : "step-node-todo"}`}>
                {s.done ? "✓" : i + 1}
              </div>
              <span className={`step-label ${s.active ? "step-label-active" : "step-label-todo"}`}>{s.label}</span>
            </div>
            {i < 2 && <div className={`step-line ${s.done ? "step-line-done" : "step-line-todo"}`} />}
          </div>
        ))}
      </div>

      {/* Form card */}
      {(extractState === "idle" || extractState === "extracting") && (
        <div className="card card-pad-xl card-accent card-mb">
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Thesis Details</h2>

          {/* Drive link */}
          <div className="field-mb">
            <label className="field-label">
              Google Drive Link <span className="field-req">*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input value={form.driveLink} onChange={e => setForm(p => ({ ...p, driveLink: e.target.value }))}
                  placeholder="https://drive.google.com/file/d/..."
                  disabled={extractState === "extracting"} className="input" />
              </div>
              <button onClick={() => { if (navigator.clipboard) navigator.clipboard.readText().then(t => setForm(p => ({ ...p, driveLink: t }))).catch(() => {}); }}
                disabled={extractState === "extracting"}
                className="paste-btn"
                title="Paste from clipboard">📋</button>
            </div>
            <p className="hint">Paste the "Anyone with the link" share URL from Google Drive</p>
          </div>

          {/* Title */}
          <div className="field-mb">
            <label className="field-label">Title <span className="field-req">*</span></label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Enter full thesis title" disabled={extractState === "extracting"} className="input" />
          </div>

          {/* Dept + Year */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label className="field-label">Department <span className="field-req">*</span></label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} disabled={extractState === "extracting"}
                className="input" style={{ color: form.department ? "#111827" : "#9CA3AF", appearance: "none" }}>
                <option value="">Select dept.</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Academic Year</label>
              <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} disabled={extractState === "extracting"}
                className="input" style={{ appearance: "none" }}>
                {[2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Adviser */}
          <div>
            <label className="field-label">Adviser <span className="field-req">*</span></label>
            <select value={form.adviser} onChange={e => setForm(p => ({ ...p, adviser: e.target.value }))} disabled={extractState === "extracting"}
              className="input" style={{ color: form.adviser ? "#111827" : "#9CA3AF", appearance: "none" }}>
              <option value="">Select adviser</option>
              {ADVISERS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {error && (
            <div className="error-box">
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* Extracting state */}
      {extractState === "extracting" && (
        <div className="animate-fade-in extract-panel">
          <div className="spin-ring">
            <div className="animate-spin spin-ring-inner" />
            <div className="spin-core">📄</div>
          </div>
          <div className="extract-title">Reading PDF and filling in details...</div>
          <div className="extract-sub">pdf.js · Scanning pages 1–4 · Regex: Abstract/Keywords</div>
          <div className="progress-track">
            <div className="progress-fill" />
          </div>
        </div>
      )}

      {/* Result states */}
      {(extractState === "success" || extractState === "needs_review") && (
        <div className="animate-slide-up">
          {/* Status bar */}
          <div className={`status-bar ${extractState === "success" ? "status-bar-success" : "status-bar-review"}`}>
            <div className={`status-icon ${extractState === "success" ? "status-icon-success" : "status-icon-review"}`}>
              {extractState === "success"
                ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="#7a6500" strokeWidth="2" strokeLinecap="round" /></svg>
              }
            </div>
            <div>
              <div className={`status-title ${extractState === "success" ? "status-title-success" : "status-title-review"}`}>
                {extractState === "success" ? "Details filled in. Please review:" : "Could not read PDF completely. Please fill in:"}
              </div>
              <div className="status-sub">
                {extractState === "success" ? "Abstract and keywords extracted — edit if needed" : "Manual entry required for abstract and keywords"}
              </div>
            </div>
          </div>

          {/* Thesis summary */}
          <div className="review-card">
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.45, margin: "0 0 8px" }}>{form.title}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <DeptBadge dept={form.department} small />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{form.year} · {form.adviser}</span>
            </div>
          </div>

          {/* Editable abstract */}
          <div className="review-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="field-label" style={{ marginBottom: 0 }}>Abstract</label>
              <span className="overlap-lbl">Editable</span>
            </div>
            <textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={5} className="textarea" />
            <div className="word-count">{abstract.split(" ").filter(Boolean).length} words</div>
          </div>

          {/* Keywords chips */}
          <div className="review-card">
            <label className="field-label" style={{ marginBottom: 10 }}>Keywords (Chips Input)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {keywords.map(kw => (
                <span key={kw} className="kw-chip">
                  {kw}
                  <button onClick={() => setKeywords(p => p.filter(k => k !== kw))} className="kw-chip-x">×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }}
                placeholder="Add keyword, press Enter..." className="input" style={{ padding: "8px 12px", fontSize: 12 }} />
              <button onClick={() => { if (newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }} className="chip-add">
                + Add
              </button>
            </div>
          </div>

          <button onClick={handleSave} className="btn-submit">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {extractState === "success" ? "Confirm & Save" : "Save Manually"}
          </button>
        </div>
      )}

      {/* Submit button */}
      {extractState === "idle" && (
        <button onClick={handleSubmit} className="btn-submit">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Submit
        </button>
      )}
    </div>
  );
}

// ─── Screen 6: Student Dashboard ──────────────────────────────────────────────
function StudentDashboard({ theses, onSearch, onSignOut }: { theses: Thesis[]; onSearch: (q: string) => void; onSignOut: () => void }) {
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

  const recent = [...theses].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 6);

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

// ─── Search Screen ────────────────────────────────────────────────────────────
function SearchScreen({
  theses, role, initialQuery, onCombinedSummary, onBack,
}: {
  theses: Thesis[]; role: Role; initialQuery?: string;
  onCombinedSummary: (results: Thesis[], query: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState(initialQuery || "");
  const [deptFilter, setDeptFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedRank, setExpandedRank] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Filters narrow the candidate set, then the index is built from what survives.
  // N, doc-frequency and avgDocLen therefore all describe the same corpus — they
  // used to disagree, because avgDocLen came from all theses while N came from
  // the filtered ones.
  const filtered = useMemo(() => {
    let f = theses;
    if (deptFilter) f = f.filter(t => t.department === deptFilter);
    if (yearFilter) f = f.filter(t => t.year === parseInt(yearFilter));
    if (statusFilter) f = f.filter(t => t.status === statusFilter);
    return f;
  }, [theses, deptFilter, yearFilter, statusFilter]);

  const index = useMemo(() => buildIndex(filtered), [filtered]);

  const results = useMemo(() => {
    const empty = [] as { term: string; score: number; field: string }[];

    // No query: everything, newest first.
    if (!query.trim()) {
      return filtered
        .map(t => ({ thesis: t, score: 0, termScores: empty }))
        .sort((a, b) => b.thesis.dateAdded.localeCompare(a.thesis.dateAdded));
    }

    const df = computeDocFreq(tokenize(query), index);
    return filtered
      .map((t, i) => ({ thesis: t, ...bm25Score(query, t, i, index, df) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [filtered, index, query]);

  const maxScore = Math.max(...results.map(r => r.score), 0.01);
  const allDepts = Array.from(new Set(theses.map(t => t.department)));
  const allYears = Array.from(new Set(theses.map(t => t.year))).sort((a, b) => b - a);
  const hasActiveFilters = deptFilter || yearFilter || statusFilter;

  return (
    <div className="app-root" style={{ background: "#F9FAFB" }}>
      {/* Sticky header + search */}
      <div className="site-header">
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {/* Top bar */}
          <div className="search-topbar">
            <button onClick={onBack} className="back-btn">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <ISUSeal size={26} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {role === "staff" ? "Search Archive" : "ISU Thesis Archive"}
              </span>
            </div>
            <span className="count-pill">{theses.length} theses</span>
          </div>
          {/* Search input */}
          <div className="search-bar-row">
            <div className="search-bar">
              <svg className="search-bar-icon" width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="rgba(0,100,57,0.4)" strokeWidth="2" />
                <path d="M20 20l-3-3" stroke="rgba(0,100,57,0.4)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by title, author, keyword, year..."
                className="search-input" />
              {query && (
                <button onClick={() => setQuery("")} className="search-clear">×</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="filter-bar">
        <div style={{ maxWidth: 800, margin: "0 auto", overflowX: "auto" }}>
          <div className="filter-row-inner">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className={`select-pill${deptFilter ? " select-pill-active" : ""}`}>
              <option value="">{role === "staff" ? "My Department ▼" : "All Departments ▼"}</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className={`select-pill${yearFilter ? " select-pill-active" : ""}`}>
              <option value="">All Years ▼</option>
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {role === "staff" && ["archived", "pending", "needs_review"].map(s => (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                className={`btn-pill${statusFilter === s ? " btn-pill-active" : ""}`}>
                {s === "needs_review" ? "Needs Review" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); setStatusFilter(""); }}
                className="btn-clear">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="results-main">
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            {query ? (
              <>{results.length} result{results.length !== 1 ? "s" : ""} for <span style={{ color: "#006439" }}>"{query}"</span></>
            ) : (
              <>{results.length} theses</>
            )}
          </div>
          {selected.size > 0 && (
            <button onClick={() => onCombinedSummary(results.filter(r => selected.has(r.thesis.id)).map(r => r.thesis), query)}
              className="btn btn-primary" style={{ padding: "7px 12px", fontSize: 12 }}>
              View Summary ({selected.size})
            </button>
          )}
        </div>

        {results.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.4 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#374151", marginBottom: 6 }}>No theses found</div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>Try different keywords, adjust filters, or check spelling.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {results.map(({ thesis: t, score, termScores }) => {
            const pct = query && score > 0 ? Math.round((score / maxScore) * 93) + 4 : 0;
            const isExpanded = expandedRank === t.id;
            const isSelected = selected.has(t.id);
            const showPreview = previewId === t.id;

            return (
              <div key={t.id} className={`result-card${isSelected ? " result-card-selected" : ""}`}>
                <div className="result-pad">
                  <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                      style={{ marginTop: 3, accentColor: "#006439", cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <button onClick={() => setPreviewId(showPreview ? null : t.id)} className="result-title-btn">
                        <h3 className="result-title">
                          {t.title}
                        </h3>
                      </button>
                    </div>
                    {pct > 0 && (
                      <div className="score-pill">
                        {pct}%
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8, paddingLeft: 24 }}>
                    <DeptBadge dept={t.department} small />
                    <StatusBadge status={t.status} />
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.year} · {t.adviser}</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 24, marginBottom: query && termScores.length > 0 ? 8 : 0 }}>
                    {t.keywords.slice(0, 4).map(kw => (
                      <span key={kw} className="kw-mini">{kw}</span>
                    ))}
                  </div>

                  {/* BM25 why this rank */}
                  {query && termScores.length > 0 && (
                    <div style={{ paddingLeft: 24 }}>
                      <button onClick={() => setExpandedRank(isExpanded ? null : t.id)} className="why-btn">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Why this rank?
                        <svg style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                      {isExpanded && (
                        <div className="animate-slide-up term-box">
                          <div className="term-overline">BM25 Term Scores</div>
                          {termScores.map(ts => (
                            <div key={ts.term} className="term-row">
                              <span className="term-name">{ts.term}</span>
                              <div className="term-track">
                                <div className="term-fill" style={{ width: `${Math.min(100, (ts.score / Math.max(...termScores.map(x => x.score))) * 100)}%` }} />
                              </div>
                              <span className="term-score">{ts.score.toFixed(2)}</span>
                              <span className={`term-field term-field-${ts.field}`}>
                                {ts.field}
                              </span>
                            </div>
                          ))}
                          <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6 }}>
                            IDF × TF-normalized · BM25 k₁=1.5 b=0.75
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline abstract preview */}
                {showPreview && (
                  <div className="animate-slide-up preview-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span className="term-overline" style={{ marginBottom: 0 }}>Abstract</span>
                      <a href={t.driveLink} target="_blank" rel="noreferrer" className="drive-btn">
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Open in Drive
                      </a>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>{t.abstract}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ─── Combined Summary Panel ───────────────────────────────────────────────────
function CombinedSummaryPanel({ theses, query, onClose }: { theses: Thesis[]; query: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const extractive = `Several theses archived at ISU Echague Campus address research related to ${query || "key thematic areas"} in Isabela Province [1][2]. These studies collectively highlight interdisciplinary approaches combining field surveys, computational modeling, and community-based methodologies [3]. Findings consistently emphasize sustainable resource management and data-driven policy frameworks [1][4]. Taken together, they contribute substantially to the regional knowledge base and provide practical recommendations for local government units and research institutions [2][3].`;

  const keywords = Array.from(new Set(theses.flatMap(t => t.keywords))).slice(0, 8);

  function highlightKw(text: string) {
    if (!query) return text;
    const terms = tokenize(query);
    let result = text;
    terms.forEach(term => {
      result = result.replace(new RegExp(`\\b${term}\\b`, "gi"), `<mark class="keyword-highlight">${term}</mark>`);
    });
    return result;
  }

  function handleCopy() {
    navigator.clipboard.writeText(extractive);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay">
      <div onClick={onClose} className="modal-backdrop" />
      <div className="animate-slide-up-modal modal-sheet">
        {/* Handle */}
        <div className="sheet-handle-row">
          <div className="sheet-handle" />
        </div>

        {/* Header */}
        <div className="sheet-header">
          <div className="sheet-title-row">
            <div>
              <h2 className="sheet-h2">
                Summary of {theses.length} Results
              </h2>
              {query && <p className="sheet-query">for query: <span style={{ fontWeight: 700, color: "#006439" }}>"{query}"</span></p>}
            </div>
            <button onClick={onClose} className="sheet-close">×</button>
          </div>
          <div className="mode-pill-row">
            <span className="mode-pill">
              📋 Extractive Summary · BM25 Top Results
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="sheet-body">
          <p className="summary-text"
            dangerouslySetInnerHTML={{ __html: highlightKw(extractive) }} />

          {/* Citations */}
          <div className="sources-box">
            <div className="overline-label">Sources</div>
            {theses.slice(0, 4).map((t, i) => (
              <div key={t.id} className="source-row">
                <span className="source-num">{i + 1}</span>
                <span className="source-text">{t.title} ({t.year}) · {t.adviser}</span>
              </div>
            ))}
          </div>

          {/* Keyword highlights */}
          <div>
            <div className="overline-label">Key Terms</div>
            <div className="keywords-row">
              {keywords.map(kw => (
                <span key={kw} className="keyword-highlight" style={{ fontSize: 12, fontWeight: 500, color: "#374151", borderRadius: 3, padding: "2px 4px" }}>{kw}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="sheet-action">
          <button onClick={handleCopy}
            className={`btn-copy${copied ? " btn-copy-done" : ""}`}>
            {copied ? "✓ Copied!" : "📋 Copy Summary"}
          </button>
          <button className="btn-export">
            📄 Export PDF
          </button>
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
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
