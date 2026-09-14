import { useState, useEffect, useRef } from "react";

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

function bm25Score(query: string, doc: Thesis, avgDocLen: number): { score: number; termScores: { term: string; score: number; field: string }[] } {
  const k1 = 1.5, b = 0.75;
  const tokens = tokenize(query);
  const docText = `${doc.title} ${doc.abstract} ${doc.keywords.join(" ")}`;
  const docTokens = tokenize(docText);
  const docLen = docTokens.length;
  const termFreq: Record<string, number> = {};
  docTokens.forEach(t => { termFreq[t] = (termFreq[t] || 0) + 1; });
  const N = SAMPLE_THESES.length;
  const termScores: { term: string; score: number; field: string }[] = [];
  let total = 0;
  tokens.forEach(term => {
    const tf = termFreq[term] || 0;
    const df = SAMPLE_THESES.filter(d => tokenize(`${d.title} ${d.abstract} ${d.keywords.join(" ")}`).includes(term)).length;
    if (df === 0) return;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
    const s = idf * tfNorm;
    const field = tokenize(doc.title).includes(term) ? "title" : tokenize(doc.keywords.join(" ")).includes(term) ? "keyword" : "abstract";
    termScores.push({ term, score: s, field });
    total += s;
  });
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
  const map = {
    archived: { bg: "#F0F8F4", color: "#006439", border: "rgba(0,100,57,0.3)", label: "Archived" },
    pending: { bg: "#FFF8E1", color: "#7a6500", border: "rgba(247,208,0,0.5)", label: "Pending" },
    needs_review: { bg: "#FDEDEA", color: "#a01820", border: "rgba(205,32,43,0.3)", label: "Needs Review" },
  };
  const s = map[status];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: "0.2px", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function DeptBadge({ dept, small }: { dept: string; small?: boolean }) {
  return (
    <span style={{ background: "#E8EBF2", color: "#23305B", border: "1px solid #c5ccdf", padding: small ? "2px 7px" : "3px 9px", borderRadius: 4, fontSize: small ? 10 : 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {dept}
    </span>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="animate-toast" style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      background: "#006439", color: "#fff", padding: "12px 20px",
      borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 20px rgba(0,100,57,0.4)", whiteSpace: "nowrap"
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  );
}

// Safe-area-aware header height helper
const HEADER_STYLE: React.CSSProperties = {
  background: "#006439",
  paddingTop: "env(safe-area-inset-top, 0px)",
  boxShadow: "0 2px 8px rgba(0,100,57,0.25)",
  position: "sticky",
  top: 0,
  zIndex: 50,
};

// ─── Screen 1: Login ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("staff");

  function handleLogin() {
    setLoading(true);
    setTimeout(() => onLogin(selectedRole), 1400);
  }

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #F0F8F4 0%, #FFFFFF 55%, #F0F8F4 100%)",
      padding: "24px 16px", position: "relative", overflow: "hidden",
      paddingTop: "calc(env(safe-area-inset-top, 0px) + 24px)",
    }}>
      {/* Top brand stripe */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "calc(env(safe-area-inset-top, 0px) + 4px)", background: "linear-gradient(90deg, #006439 0%, #F7D000 50%, #CD202B 100%)", zIndex: 10 }} />

      {/* BG circles */}
      <div style={{ position: "absolute", top: -80, left: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(0,100,57,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(247,208,0,0.07)", pointerEvents: "none" }} />

      <div className="animate-fade-in" style={{
        background: "#fff", borderRadius: 16, padding: "40px 28px",
        boxShadow: "0 4px 32px rgba(0,100,57,0.10), 0 1px 4px rgba(0,0,0,0.04)",
        width: "100%", maxWidth: 400, border: "1px solid rgba(0,100,57,0.08)"
      }}>
        {/* Seal */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <ISUSeal size={72} />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#006439", textAlign: "center", marginBottom: 4, letterSpacing: "-0.3px" }}>
          ISU Thesis Archive
        </h1>
        <p style={{ fontSize: 13, fontWeight: 500, color: "#23305B", textAlign: "center", marginBottom: 2 }}>
          Isabela State University
        </p>
        <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", marginBottom: 28 }}>
          Echague Campus
        </p>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #e5e7eb, transparent)", marginBottom: 22 }} />

        {/* Role selector */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textAlign: "center", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Sign in as
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["staff", "student"] as Role[]).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                style={{
                  padding: "12px 8px", borderRadius: 8, cursor: "pointer",
                  border: `2px solid ${selectedRole === role ? "#006439" : "#E5E7EB"}`,
                  background: selectedRole === role ? "#F0F8F4" : "#fff",
                  transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}
              >
                <span style={{ fontSize: 22 }}>{role === "staff" ? "👩‍💼" : "🎓"}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: selectedRole === role ? "#006439" : "#6B7280", textTransform: "capitalize" }}>
                  {role === "staff" ? "Research Staff" : "Student"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Info pill */}
        <div style={{ background: "#F0F8F4", borderRadius: 8, padding: "9px 14px", marginBottom: 20, border: "1px solid rgba(0,100,57,0.12)" }}>
          <p style={{ fontSize: 12, color: "#006439", fontWeight: 500, margin: 0, textAlign: "center" }}>
            {selectedRole === "staff" ? "🔒 Staff access · Register & manage theses" : "🔍 Student access · Search & browse archive"}
          </p>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: "13px 20px", borderRadius: 8,
            border: "1.5px solid #006439", background: loading ? "#F0F8F4" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            cursor: loading ? "default" : "pointer", fontSize: 14, fontWeight: 600,
            color: "#006439", transition: "all 0.15s",
            boxShadow: loading ? "none" : "0 1px 4px rgba(0,100,57,0.10)"
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#F0F8F4"; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#fff"; }}
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

        <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 16 }}>
          Secure login with your @isu.edu.ph account
        </p>
      </div>

      <div style={{ marginTop: 28, textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#9CA3AF" }}>© 2025 Isabela State University · Echague Campus</p>
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
}: {
  theses: Thesis[];
  activeTab: StaffTab;
  onTabChange: (t: StaffTab) => void;
  onRegisterSuccess: (thesis: Thesis) => void;
  onSearch: () => void;
}) {
  const stats = {
    total: theses.length,
    pending: theses.filter(t => t.status === "pending" || t.status === "needs_review").length,
    thisMonth: theses.filter(t => t.dateAdded >= "2024-11").length,
  };

  const TABS: { id: StaffTab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "register", label: "Register", icon: "+" },
    { id: "search", label: "Search", icon: "⌕" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={HEADER_STYLE}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 11, height: 60 }}>
          <ISUSeal size={36} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>Thesis Archive — Staff</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>ISU Echague Campus</div>
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: 8, borderRadius: 8, position: "relative" }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {stats.pending > 0 && <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#F7D000", border: "1.5px solid #006439" }} />}
          </button>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #23305B, #3a4f8a)", border: "2px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>RS</div>
        </div>

        {/* Tab nav */}
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 4px", display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === "search" ? onSearch() : onTabChange(tab.id)}
              style={{
                flex: 1, padding: "10px 4px", background: "none", border: "none",
                cursor: "pointer", color: activeTab === tab.id ? "#F7D000" : "rgba(255,255,255,0.65)",
                fontSize: 12, fontWeight: activeTab === tab.id ? 700 : 500,
                borderBottom: `2.5px solid ${activeTab === tab.id ? "#F7D000" : "transparent"}`,
                transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              }}
            >
              <span style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 800, width: "100%", margin: "0 auto", padding: "20px 16px 24px" }}>
        {activeTab === "dashboard" && (
          <div className="animate-fade-in">
            {/* Welcome */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", marginBottom: 14, border: "1px solid rgba(0,100,57,0.08)", boxShadow: "0 2px 8px rgba(0,100,57,0.05)", display: "flex", alignItems: "center", gap: 14 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { label: "Total Theses", value: stats.total, color: "#006439", bg: "#F0F8F4", border: "rgba(0,100,57,0.15)", icon: "📚" },
                { label: "Pending Review", value: stats.pending, color: "#7a6500", bg: "#FFF8E1", border: "rgba(247,208,0,0.4)", icon: "🕐" },
                { label: "This Month", value: stats.thisMonth, color: "#23305B", bg: "#E8EBF2", border: "rgba(35,48,91,0.2)", icon: "📅" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "14px 10px", border: `1px solid ${s.border}`, borderTop: `4px solid ${s.color}`, textAlign: "center" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: s.color, fontWeight: 500, marginTop: 4, opacity: 0.85 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <button onClick={() => onTabChange("register")} style={{ padding: "13px 12px", borderRadius: 8, background: "#006439", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,100,57,0.25)", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#004d2b")}
                onMouseLeave={e => (e.currentTarget.style.background = "#006439")}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                Register Thesis
              </button>
              <button onClick={onSearch} style={{ padding: "13px 12px", borderRadius: 8, background: "#fff", border: "2px solid #23305B", color: "#23305B", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#E8EBF2")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                Search Archive
              </button>
            </div>

            {/* Recent theses table */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,100,57,0.08)", boxShadow: "0 2px 8px rgba(0,100,57,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Recent Theses</span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>{theses.length} total</span>
              </div>
              {theses.slice(0, 6).map((t, i) => (
                <div key={t.id} style={{ padding: "13px 18px", borderBottom: i < 5 ? "1px solid #F9FAFB" : "none", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#FAFCFB")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#23305B", margin: 0, flex: 1, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</p>
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
          <div className="animate-fade-in" style={{ background: "#fff", borderRadius: 12, padding: "24px 20px", border: "1px solid rgba(0,100,57,0.08)", boxShadow: "0 2px 8px rgba(0,100,57,0.04)" }}>
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
            <button style={{ marginTop: 24, width: "100%", padding: "12px", borderRadius: 8, background: "#FDEDEA", border: "1px solid rgba(205,32,43,0.2)", color: "#CD202B", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
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

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 8,
    border: "1.5px solid #E5E7EB", fontSize: 13, color: "#111827",
    outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif",
    background: extractState === "extracting" ? "#F9FAFB" : "#fff",
    transition: "border-color 0.15s"
  };

  return (
    <div className="animate-fade-in">
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: s.active || s.done ? 1 : 0.38 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: s.done ? "#006439" : s.active ? "#F7D000" : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: s.done ? "#fff" : s.active ? "#7a6500" : "#9CA3AF" }}>
                {s.done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: s.active ? "#006439" : "#9CA3AF", whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: s.done ? "#006439" : "#E5E7EB" }} />}
          </div>
        ))}
      </div>

      {/* Form card */}
      {(extractState === "idle" || extractState === "extracting") && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px", border: "1px solid rgba(0,100,57,0.08)", borderTop: "4px solid #006439", boxShadow: "0 2px 8px rgba(0,100,57,0.06)", marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 16 }}>Thesis Details</h2>

          {/* Drive link */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Google Drive Link <span style={{ color: "#CD202B" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input value={form.driveLink} onChange={e => setForm(p => ({ ...p, driveLink: e.target.value }))}
                  placeholder="https://drive.google.com/file/d/..."
                  disabled={extractState === "extracting"} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#006439")}
                  onBlur={e => (e.target.style.borderColor = "#E5E7EB")} />
              </div>
              <button onClick={() => { if (navigator.clipboard) navigator.clipboard.readText().then(t => setForm(p => ({ ...p, driveLink: t }))).catch(() => {}); }}
                disabled={extractState === "extracting"}
                style={{ padding: "0 14px", borderRadius: 8, border: "1.5px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 16, color: "#6B7280" }}
                title="Paste from clipboard">📋</button>
            </div>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Paste the "Anyone with the link" share URL from Google Drive</p>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Title <span style={{ color: "#CD202B" }}>*</span></label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Enter full thesis title" disabled={extractState === "extracting"} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#006439")} onBlur={e => (e.target.style.borderColor = "#E5E7EB")} />
          </div>

          {/* Dept + Year */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Department <span style={{ color: "#CD202B" }}>*</span></label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} disabled={extractState === "extracting"}
                style={{ ...inputStyle, color: form.department ? "#111827" : "#9CA3AF", appearance: "none" }}>
                <option value="">Select dept.</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Academic Year</label>
              <select value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} disabled={extractState === "extracting"}
                style={{ ...inputStyle, appearance: "none" }}>
                {[2025, 2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Adviser */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Adviser <span style={{ color: "#CD202B" }}>*</span></label>
            <select value={form.adviser} onChange={e => setForm(p => ({ ...p, adviser: e.target.value }))} disabled={extractState === "extracting"}
              style={{ ...inputStyle, color: form.adviser ? "#111827" : "#9CA3AF", appearance: "none" }}>
              <option value="">Select adviser</option>
              {ADVISERS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {error && (
            <div style={{ background: "#FDEDEA", border: "1px solid rgba(205,32,43,0.3)", borderRadius: 8, padding: "10px 14px", marginTop: 14, fontSize: 13, color: "#a01820", display: "flex", gap: 8, alignItems: "center" }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* Extracting state */}
      {extractState === "extracting" && (
        <div className="animate-fade-in" style={{ background: "#FFF8E1", borderRadius: 12, padding: "24px 20px", border: "1px solid rgba(247,208,0,0.4)", textAlign: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", width: 52, height: 52 }}>
              <div className="animate-spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid #FFF8E1", borderTopColor: "#F7D000" }} />
              <div style={{ position: "absolute", inset: 8, borderRadius: "50%", background: "#FFF8E1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📄</div>
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#7a6500", marginBottom: 6 }}>Reading PDF and filling in details...</div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>pdf.js · Scanning pages 1–4 · Regex: Abstract/Keywords</div>
          <div style={{ height: 5, borderRadius: 3, background: "rgba(247,208,0,0.2)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: "#F7D000", width: "72%", transition: "width 2.5s ease" }} />
          </div>
        </div>
      )}

      {/* Result states */}
      {(extractState === "success" || extractState === "needs_review") && (
        <div className="animate-slide-up">
          {/* Status bar */}
          <div style={{
            borderRadius: 10, padding: "14px 16px", marginBottom: 14,
            background: extractState === "success" ? "#F0F8F4" : "#FFF8E1",
            border: `1px solid ${extractState === "success" ? "rgba(0,100,57,0.2)" : "rgba(247,208,0,0.5)"}`,
            display: "flex", alignItems: "center", gap: 12
          }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: extractState === "success" ? "#006439" : "#F7D000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {extractState === "success"
                ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                : <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01" stroke="#7a6500" strokeWidth="2" strokeLinecap="round" /></svg>
              }
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: extractState === "success" ? "#006439" : "#7a6500" }}>
                {extractState === "success" ? "Details filled in. Please review:" : "Could not read PDF completely. Please fill in:"}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {extractState === "success" ? "Abstract and keywords extracted — edit if needed" : "Manual entry required for abstract and keywords"}
              </div>
            </div>
          </div>

          {/* Thesis summary */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", marginBottom: 12, border: "1px solid rgba(0,100,57,0.08)", boxShadow: "0 2px 6px rgba(0,100,57,0.04)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.45, margin: "0 0 8px" }}>{form.title}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <DeptBadge dept={form.department} small />
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{form.year} · {form.adviser}</span>
            </div>
          </div>

          {/* Editable abstract */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", marginBottom: 12, border: "1px solid rgba(0,100,57,0.08)", boxShadow: "0 2px 6px rgba(0,100,57,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>Abstract</label>
              <span style={{ fontSize: 10, color: "#9CA3AF", background: "#F3F4F6", padding: "2px 7px", borderRadius: 4 }}>Editable</span>
            </div>
            <textarea value={abstract} onChange={e => setAbstract(e.target.value)} rows={5}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, color: "#374151", lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}
              onFocus={e => (e.target.style.borderColor = "#006439")} onBlur={e => (e.target.style.borderColor = "#E5E7EB")} />
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{abstract.split(" ").filter(Boolean).length} words</div>
          </div>

          {/* Keywords chips */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "14px 16px", marginBottom: 16, border: "1px solid rgba(0,100,57,0.08)", boxShadow: "0 2px 6px rgba(0,100,57,0.04)" }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Keywords (Chips Input)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {keywords.map(kw => (
                <span key={kw} style={{ background: "#FFF8E1", border: "1px solid rgba(247,208,0,0.5)", color: "#7a6500", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  {kw}
                  <button onClick={() => setKeywords(p => p.filter(k => k !== kw))} style={{ background: "none", border: "none", cursor: "pointer", color: "#CD202B", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }}
                placeholder="Add keyword, press Enter..." style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "#006439")} onBlur={e => (e.target.style.borderColor = "#E5E7EB")} />
              <button onClick={() => { if (newKw.trim()) { setKeywords(p => [...p, newKw.trim()]); setNewKw(""); } }}
                style={{ padding: "8px 14px", borderRadius: 8, background: "#F0F8F4", border: "1px solid rgba(0,100,57,0.2)", color: "#006439", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                + Add
              </button>
            </div>
          </div>

          <button onClick={handleSave} style={{ width: "100%", padding: "15px", borderRadius: 8, background: "#006439", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 2px 8px rgba(0,100,57,0.25)" }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {extractState === "success" ? "Confirm & Save" : "Save Manually"}
          </button>
        </div>
      )}

      {/* Submit button */}
      {extractState === "idle" && (
        <button onClick={handleSubmit} style={{ width: "100%", padding: "15px", borderRadius: 8, background: "#006439", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 2px 8px rgba(0,100,57,0.25)", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#004d2b")}
          onMouseLeave={e => (e.currentTarget.style.background = "#006439")}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Submit
        </button>
      )}
    </div>
  );
}

// ─── Screen 6: Student Dashboard ──────────────────────────────────────────────
function StudentDashboard({ theses, onSearch }: { theses: Thesis[]; onSearch: (q: string) => void }) {
  const [heroQuery, setHeroQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const quickFilters = ["Recent", "Agriculture", "Computer Science", "Forestry", "Biology", "Education"];

  const recent = [...theses].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 6);

  function handleSearch() {
    if (heroQuery.trim()) onSearch(heroQuery);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={HEADER_STYLE}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 11, height: 60 }}>
          <ISUSeal size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>ISU Thesis Archive</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Echague Campus</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #F7D000, #c4a000)", border: "2px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#7a6500" }}>JD</div>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 800, width: "100%", margin: "0 auto" }}>
        {/* Hero search section */}
        <div style={{ background: "linear-gradient(160deg, #006439 0%, #004d2b 100%)", padding: "40px 20px 48px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.3px" }}>
            Discover ISU Research
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", marginBottom: 28, fontWeight: 400 }}>
            Browse all archived theses from all departments and years
          </p>

          {/* Big search input */}
          <div style={{ position: "relative", maxWidth: 560, margin: "0 auto 16px" }}>
            <svg style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="rgba(0,100,57,0.5)" strokeWidth="2.5" />
              <path d="M20 20l-3-3" stroke="rgba(0,100,57,0.5)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={heroQuery}
              onChange={e => setHeroQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search for thesis topics, authors, keywords, departments..."
              style={{
                width: "100%", padding: "18px 18px 18px 52px", borderRadius: 12,
                border: "none", fontSize: 15, color: "#111827", outline: "none",
                boxSizing: "border-box", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                fontFamily: "Inter, sans-serif"
              }}
            />
          </div>
          <button onClick={handleSearch} style={{ padding: "15px 40px", borderRadius: 10, background: "#F7D000", border: "none", color: "#7a6500", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.2)", transition: "all 0.15s", width: "100%", maxWidth: 560 }}
            onMouseEnter={e => (e.currentTarget.style.background = "#ffe033")}
            onMouseLeave={e => (e.currentTarget.style.background = "#F7D000")}>
            Search Theses
          </button>
        </div>

        <div style={{ padding: "20px 16px 32px" }}>
          {/* Quick filter chips */}
          <div style={{ overflowX: "auto", marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 8, width: "max-content", paddingBottom: 4 }}>
              {quickFilters.map(f => (
                <button key={f} onClick={() => { setActiveFilter(f === activeFilter ? "" : f); if (f !== "Recent") onSearch(f); }}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${activeFilter === f ? "#006439" : "#E5E7EB"}`, background: activeFilter === f ? "#006439" : "#fff", color: activeFilter === f ? "#fff" : "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Recent theses carousel */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Recent Theses</h2>
              <button onClick={() => onSearch("")} style={{ fontSize: 12, color: "#006439", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>View all →</button>
            </div>
            <div style={{ overflowX: "auto", marginRight: -16, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 12, width: "max-content" }}>
                {recent.map(t => (
                  <div key={t.id} style={{ width: 240, background: "#fff", borderRadius: 10, padding: "14px", border: "1px solid rgba(0,100,57,0.08)", borderLeft: "4px solid #006439", boxShadow: "0 2px 8px rgba(0,100,57,0.06)", flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#23305B", lineHeight: 1.45, margin: "0 0 10px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <DeptBadge dept={t.department} small />
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{t.year}</span>
                    </div>
                    <button onClick={() => onSearch(t.title.split(" ").slice(0, 4).join(" "))}
                      style={{ marginTop: 12, width: "100%", padding: "7px", borderRadius: 6, border: "1.5px solid rgba(0,100,57,0.25)", background: "#fff", color: "#006439", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F0F8F4")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
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

  const avgDocLen = theses.reduce((acc, t) => acc + tokenize(`${t.title} ${t.abstract} ${t.keywords.join(" ")}`).length, 0) / theses.length;

  const results = (() => {
    let f = theses;
    if (deptFilter) f = f.filter(t => t.department === deptFilter);
    if (yearFilter) f = f.filter(t => t.year === parseInt(yearFilter));
    if (statusFilter) f = f.filter(t => t.status === statusFilter);
    if (!query.trim()) return f.map(t => ({ thesis: t, score: 0, termScores: [] as { term: string; score: number; field: string }[] }));
    return f.map(t => ({ thesis: t, ...bm25Score(query, t, avgDocLen) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  })();

  const maxScore = Math.max(...results.map(r => r.score), 0.01);
  const allDepts = Array.from(new Set(theses.map(t => t.department)));
  const allYears = Array.from(new Set(theses.map(t => t.year))).sort((a, b) => b - a);
  const hasActiveFilters = deptFilter || yearFilter || statusFilter;

  return (
    <div style={{ minHeight: "100dvh", background: "#F9FAFB" }}>
      {/* Sticky header + search */}
      <div style={{ ...HEADER_STYLE }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {/* Top bar */}
          <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 10, height: 56 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: 6, borderRadius: 6, display: "flex" }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <ISUSeal size={26} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {role === "staff" ? "Search Archive" : "ISU Thesis Archive"}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.1)", padding: "3px 8px", borderRadius: 10 }}>{theses.length} theses</span>
          </div>
          {/* Search input */}
          <div style={{ padding: "0 14px 12px" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" stroke="rgba(0,100,57,0.4)" strokeWidth="2" />
                <path d="M20 20l-3-3" stroke="rgba(0,100,57,0.4)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by title, author, keyword, year..."
                style={{ width: "100%", padding: "12px 36px 12px 36px", borderRadius: 8, border: "none", background: "#fff", fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }} />
              {query && (
                <button onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "#E5E7EB", border: "none", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: "#6B7280" }}>×</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", width: "max-content" }}>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 20, border: `1.5px solid ${deptFilter ? "#006439" : "#E5E7EB"}`, fontSize: 12, fontWeight: 500, color: deptFilter ? "#006439" : "#6B7280", background: deptFilter ? "#F0F8F4" : "#fff", outline: "none", cursor: "pointer", appearance: "none" }}>
              <option value="">{role === "staff" ? "My Department ▼" : "All Departments ▼"}</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 20, border: `1.5px solid ${yearFilter ? "#006439" : "#E5E7EB"}`, fontSize: 12, fontWeight: 500, color: yearFilter ? "#006439" : "#6B7280", background: yearFilter ? "#F0F8F4" : "#fff", outline: "none", cursor: "pointer", appearance: "none" }}>
              <option value="">All Years ▼</option>
              {allYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {role === "staff" && ["archived", "pending", "needs_review"].map(s => (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
                style={{ padding: "6px 12px", borderRadius: 20, border: `1.5px solid ${statusFilter === s ? "#006439" : "#E5E7EB"}`, fontSize: 12, fontWeight: 500, color: statusFilter === s ? "#006439" : "#6B7280", background: statusFilter === s ? "#F0F8F4" : "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                {s === "needs_review" ? "Needs Review" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            {hasActiveFilters && (
              <button onClick={() => { setDeptFilter(""); setYearFilter(""); setStatusFilter(""); }}
                style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid #CD202B", fontSize: 12, fontWeight: 600, color: "#CD202B", background: "#FDEDEA", cursor: "pointer", whiteSpace: "nowrap" }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "14px 16px 100px" }}>
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
              style={{ padding: "7px 12px", borderRadius: 8, background: "#006439", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              📋 Summary ({selected.size})
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
              <div key={t.id} style={{ background: isSelected ? "#F0F8F4" : "#fff", borderRadius: 10, border: `1px solid ${isSelected ? "rgba(0,100,57,0.25)" : "rgba(0,100,57,0.08)"}`, borderLeft: "4px solid #006439", boxShadow: "0 2px 8px rgba(0,100,57,0.06)", overflow: "hidden", transition: "box-shadow 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,100,57,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,100,57,0.06)")}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}
                      style={{ marginTop: 3, accentColor: "#006439", cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <button onClick={() => setPreviewId(showPreview ? null : t.id)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "block" }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#23305B", lineHeight: 1.45, margin: 0, transition: "color 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#006439")}
                          onMouseLeave={e => (e.currentTarget.style.color = "#23305B")}>
                          {t.title}
                        </h3>
                      </button>
                    </div>
                    {pct > 0 && (
                      <div style={{ flexShrink: 0, background: "#006439", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
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
                      <span key={kw} style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: 4 }}>{kw}</span>
                    ))}
                  </div>

                  {/* BM25 why this rank */}
                  {query && termScores.length > 0 && (
                    <div style={{ paddingLeft: 24 }}>
                      <button onClick={() => setExpandedRank(isExpanded ? null : t.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#006439", fontWeight: 600, padding: 0 }}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Why this rank?
                        <svg style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                      </button>
                      {isExpanded && (
                        <div className="animate-slide-up" style={{ background: "#F0F8F4", borderRadius: 8, padding: "12px 14px", marginTop: 8, border: "1px solid rgba(0,100,57,0.12)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#006439", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>BM25 Term Scores</div>
                          {termScores.map(ts => (
                            <div key={ts.term} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827", minWidth: 80, fontFamily: "monospace" }}>{ts.term}</span>
                              <div style={{ flex: 1, height: 5, borderRadius: 3, background: "#E5E7EB", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 3, background: "#006439", width: `${Math.min(100, (ts.score / Math.max(...termScores.map(x => x.score))) * 100)}%` }} />
                              </div>
                              <span style={{ fontSize: 11, color: "#6B7280", minWidth: 34 }}>{ts.score.toFixed(2)}</span>
                              <span style={{ fontSize: 10, color: ts.field === "title" ? "#006439" : ts.field === "keyword" ? "#7a6500" : "#9CA3AF", background: ts.field === "title" ? "#F0F8F4" : ts.field === "keyword" ? "#FFF8E1" : "#F3F4F6", padding: "1px 6px", borderRadius: 3, fontWeight: 600 }}>
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
                  <div className="animate-slide-up" style={{ background: "#FAFCFB", borderTop: "1px solid rgba(0,100,57,0.08)", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#006439", textTransform: "uppercase", letterSpacing: "0.4px" }}>Abstract</span>
                      <a href={t.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#23305B", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, border: "1.5px solid #23305B", padding: "4px 10px", borderRadius: 6, background: "#fff" }}>
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

      {/* Floating FAB */}
      {results.length >= 2 && (
        <button onClick={() => onCombinedSummary(results.map(r => r.thesis).slice(0, 10), query)}
          style={{ position: "fixed", bottom: 24, right: 20, background: "#006439", color: "#fff", border: "none", padding: "13px 18px", borderRadius: 24, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,100,57,0.4)", zIndex: 40, transition: "transform 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
          📋 Combined Summary ({Math.min(results.length, 10)})
        </button>
      )}
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
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }} />
      <div className="animate-slide-up-modal" style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "90dvh", display: "flex", flexDirection: "column", boxShadow: "0 -4px 40px rgba(0,0,0,0.2)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {/* Handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E5E7EB" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "12px 20px 0", borderBottom: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 2px" }}>
                Summary of {theses.length} Results
              </h2>
              {query && <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>for query: <span style={{ fontWeight: 700, color: "#006439" }}>"{query}"</span></p>}
            </div>
            <button onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "#6B7280", flexShrink: 0 }}>×</button>
          </div>
          <div style={{ paddingBottom: 14, paddingTop: 4 }}>
            <span style={{ background: "#F0F8F4", color: "#006439", border: "1px solid rgba(0,100,57,0.2)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              📋 Extractive Summary · BM25 Top Results
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.78, marginBottom: 16 }}
            dangerouslySetInnerHTML={{ __html: highlightKw(extractive) }} />

          {/* Citations */}
          <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "12px 14px", marginBottom: 16, border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Sources</div>
            {theses.slice(0, 4).map((t, i) => (
              <div key={t.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <span style={{ background: "#006439", color: "#fff", fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{t.title} ({t.year}) · {t.adviser}</span>
              </div>
            ))}
          </div>

          {/* Keyword highlights */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>Key Terms</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {keywords.map(kw => (
                <span key={kw} className="keyword-highlight" style={{ fontSize: 12, fontWeight: 500, color: "#374151", borderRadius: 3, padding: "2px 4px" }}>{kw}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 8 }}>
          <button onClick={handleCopy}
            style={{ flex: 1, padding: "12px", borderRadius: 8, background: copied ? "#006439" : "#fff", border: `1.5px solid ${copied ? "#006439" : "rgba(0,100,57,0.25)"}`, color: copied ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
            {copied ? "✓ Copied!" : "📋 Copy Summary"}
          </button>
          <button style={{ flex: 1, padding: "12px", borderRadius: 8, border: "2px solid #23305B", background: "#fff", color: "#23305B", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            📄 Export PDF
          </button>
          <button onClick={onClose} style={{ padding: "12px 16px", borderRadius: 8, background: "none", border: "1.5px solid #E5E7EB", color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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

  function goSearch(q = "") {
    setSearchInitialQuery(q);
    setScreen("search");
  }

  function handleCombinedSummary(results: Thesis[], query: string) {
    setSummaryData({ theses: results, query });
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {screen === "login" && <LoginScreen onLogin={handleLogin} />}

      {screen === "staff-dashboard" && (
        <StaffDashboard
          theses={theses}
          activeTab={staffTab}
          onTabChange={setStaffTab}
          onRegisterSuccess={thesis => { handleRegisterSuccess(thesis); }}
          onSearch={() => goSearch()}
        />
      )}

      {screen === "student-dashboard" && (
        <StudentDashboard theses={theses} onSearch={goSearch} />
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
