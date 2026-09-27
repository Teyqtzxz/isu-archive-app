# ⚠️ SUPERSEDED — do not build from this file

This is the **original prompt that was pasted into Figma Make** to generate the
prototype UI. It is kept for provenance only.

**The buildable specification is in [`docs/`](../../../docs/), starting at
[`docs/00-README.md`](../../../docs/00-README.md).** Where this file and `docs/`
disagree, `docs/` wins.

### Still authoritative here

- The **ISU colour variables** in "FIGMA COLOR VARIABLES" below. These match
  `src/index.css` and are the source of truth for the palette.

### Superseded by `docs/`

| This file says | The app does / `docs/` says |
|---|---|
| Floating "Combined Summary (N)" button, bottom-right | **Removed.** There is one button — "View Summary (N)" over manually ticked results (`docs/07` §1) |
| Summary covers the "top 5 results" | Summarises the **ticked** results, in rank order |
| Action bar: "Copy Summary", "Export as PDF", "Close" | **Close only** (`docs/07` §4) |
| Header bar 64px | `--header-h` variable, 56px (`docs/04` §4.2) |
| Search matches "title, author, keyword, year" | Searches **title + abstract + keywords** only. Adviser names are *not* searchable |
| "Relevance: 94%" | Capped just under 100% by design (`docs/05` §4) |
| Offline search index cached in IndexedDB | Not implemented. In-memory only (`docs/05` §6) |
| PWA "Install App" prompt | Not implemented (`docs/08`) |

The rest of this file is the original brief, unedited, below.

---

Design a high-fidelity mobile-first web app prototype for "ISU Thesis Archive Search" — the official thesis archive system for Isabela State University Echague Campus.
BRAND IDENTITY (Official ISU Colors from Corporate Visual Identity Manual)
Primary Colors:
- ISU Green (Primary): #006439 — "Abundant Green" PANTONE 18-6026 TCX — Nature, Life, ecological richness
- ISU Yellow (Primary): #F7D000 — "Empire Yellow" PANTONE 14-0756 TCX — Hope, Illumination, golden harvest
Accent Colors:
- ISU Red: #CD202B — "Flame Scarlet" PANTONE 18-1662 TXC — Passion, Entrepreneurship
- ISU Blue: #23305B — "Bellwether Blue" PANTONE 19-3943 TXC — Integrity, Truth, Education, Innovation
Design Language:
- Clean, modern academic interface with "Smart-Green" agenda feel
- Primary actions: ISU Green (#006439) buttons with white text
- Secondary actions: ISU Blue (#23305B) outline buttons
- Backgrounds: White (#FFFFFF) with subtle ISU Green 5% tint (#F0F8F4) for cards
- Hover/focus: ISU Blue (#23305B)
- Warnings: ISU Yellow (#F7D000), Errors: ISU Red (#CD202B)
- Status badges use the four institutional colors meaningfully
- Typography: Inter or Roboto
- Rounded: 8px cards, 4px buttons
- Shadows: 0 2px 8px rgba(0,100,57,0.08)
- ISU Seal logo in header (placeholder: "ISU" in green with yellow accent)
USERS AND ROLES (TWO SEPARATE DASHBOARDS)
1. RESEARCH DEPARTMENT STAFF
- Registers theses by pasting Google Drive links — system automatically reads PDF and fills in abstract + keywords
- Searches archive (department-scoped or all departments)
- Manages their department's theses
2. STUDENT
- Searches archive only (read-only, all departments)
- No registration, no write access
- Views abstract previews and combined summaries
Login: Single Google Sign-In → Firebase Auth → Firestore role check → Routes to appropriate dashboard
6 SCREENS TO CREATE
SCREEN 1: LOGIN (Shared)
- Full-screen centered card (max-width 400px)
- ISU Seal logo at top (green circle with "ISU" text)
- App name: "ISU Thesis Archive" in ISU Green (#006439)
- Subtitle: "Isabela State University — Echague Campus" in ISU Blue (#23305B)
- Google Sign-In button: White with green border, Google icon, "Sign in with ISU Google Account"
- Footer: "Secure login with your @isu.edu.ph account" in muted gray
- Background: Very light green gradient (top: #F0F8F4, bottom: #FFFFFF)
SCREEN 2: STAFF DASHBOARD
- Top header bar (64px): ISU Green background (#006439)
- Left: ISU logo + "Thesis Archive — Staff" in white
- Right: Notification bell (white), Staff avatar circle with initials
- Tab Navigation (below header): Dashboard Register Thesis Search Archive Settings — green underline indicator
- Main Content (padding 24px):
- Welcome Card: "Welcome back, Name" + "CAS Department Staff" badge (ISU Blue background, white text)
- Stats Row (3 cards, white with green top border 4px):
- Total Theses (dept): count — book icon
- Pending Review: count — clock icon (yellow badge)
- This Month: count — calendar icon
- Primary Actions Row:
- "Register New Thesis" (ISU Green, filled, prominent)
- "Search Archive" (ISU Blue outline, secondary)
- Recent Theses Table (department only):
- Columns: Title (truncated), Year, Status Badge, Registered Date
- Status: ARCHIVED (Green), NEEDS REVIEW (Yellow), DRAFT (Gray)
- Hover row → highlight, click → navigate to thesis detail (future)
SCREEN 3: REGISTER THESIS — STAFF ONLY
- Header Bar: Back arrow + "Register New Thesis" (green text) + "Staff Dashboard" breadcrumb
- Form Card (white, green top border 4px, padding 24px):
- Required: Google Drive Link
- Input field + Paste button (clipboard icon)
- Helper text: "Paste the 'Anyone with the link' share URL from Google Drive"
- Validation: Must be valid Drive URL
- Optional: Title (text input, pre-filled after processing)
- Department: Dropdown (defaults to staff's department, disabled/read-only)
- Academic Year: Dropdown (2020–2025)
- Adviser: Searchable dropdown (fetches from Firestore users with role=ADVISER/STAFF)
- Primary Button: "Submit" (ISU Green, full width, disabled until Drive link entered)
- Processing States (appear below button after submit):
- PROCESSING: Yellow bar with spinner + "Reading PDF and filling in details..." (animated dots)
- READY TO REVIEW: Green bar with checkmark + "Details filled in. Please review:" + 
- Editable Abstract (textarea, 5 rows, pre-filled)
- Editable Keywords (chips input: removable, addable, pre-filled)
- Button: "Confirm & Save" (ISU Green)
- NEEDS MANUAL ENTRY: Yellow warning bar + "Could not read PDF completely. Please fill in:" +
- Empty Abstract (textarea) + Keywords (chips) + "Save Manually" button
- On Confirm/Save → Toast "Thesis registered!" → Redirect to Staff Dashboard (Frame 2)
SCREEN 4: SEARCH RESULTS (ARCHIVE) — SHARED BY STAFF & STUDENT
Layout adapts to role:
Staff Header: Green bar with tabs Dashboard Register Search Archive Settings — "Search Archive" active
Student Header: Simpler green bar: Logo + "ISU Thesis Archive" + Avatar
Shared Search Area (sticky):
- Large Search Input (full width, 56px height): Search icon left, placeholder: "Search thesis by title, author, keyword, year...", clear (X) icon right
- Filter Chips Row (scrollable horizontal): 
- Department ▼ (Staff: defaults to their dept; Student: "All Departments")
- Year ▼ (All Years)
- Status ▼ (All Statuses)
- Active filters show as removable chips with X
Results List (infinite scroll, padding 16px):
- Each Result Card (white, green left border 4px, padding 16px, margin-bottom 12px, hover/tap shadow):
- Title Row: Title (bold, ISU Blue #23305B, 16px) + BM25 Score Badge (small, ISU Green bg, white text): "Relevance: 94%"
- Why This Rank? Expandable (chevron down, ISU Green text):
- Opens accordion: Term-by-term breakdown
- Example: student (IDF: 8.2) × TF: 1.0 = 8.2 | attendance (IDF: 3.1) × TF: 1.0 = 3.1
- Total Score: 11.3
- Metadata Row: Department badge (ISU Blue pill), Year, Adviser name
- Hover Preview (Desktop) / Tap Preview (Mobile):
- Floating card appears near cursor (320px max, white, green border, shadow 0 8px 24px rgba(0,100,57,0.15))
- Full abstract text (readable line height)
- "Open in Drive" button (ISU Green outline, opens in new tab)
- Close on click outside / ESC / tap other result
- Empty State (centered, 120px top padding):
- Illustration (search icon, muted green)
- "No theses found" heading
- "Try different keywords, adjust filters, or check spelling."
Floating Action Button (bottom-right, 24px from edge):
- "Combined Summary (N)" — N = visible results count
- ISU Green background, white text, rounded pill, shadow
- Tap → opens Frame 5 (Combined Summary Panel)
SCREEN 5: COMBINED SUMMARY PANEL — SHARED
- Modal (desktop: 600px centered, mobile: full-screen slide-up from bottom)
- Backdrop: Semi-transparent dark (rgba(0,0,0,0.4))
- Header (sticky): "Summary of N Results for 'query'" + Close X (top-right)
- Summary Content:
- 3-4 sentences highlighting common themes across top 5 results
- Each sentence ends with citation chips: 1 2 (ISU Green bg, clickable → scrolls to result)
- Keywords from query highlighted with ISU Yellow background (#FFF8E1)
- Action Bar (sticky bottom on mobile):
- "Copy Summary" (ISU Green, filled)
- "Export as PDF" (ISU Blue outline)
- "Close" (ghost)
SCREEN 6: STUDENT DASHBOARD (Search-Focused Landing)
- Header Bar (64px): ISU Green (#006439)
- Left: ISU Logo + "ISU Thesis Archive" (white)
- Right: Student Avatar (initials, white bg)
- Hero Search Section (centered, max-width 600px, padding 48px 24px):
- Large Search Input (72px height): Search icon, placeholder: "Search for thesis topics, authors, keywords, departments..."
- "Search" Button (ISU Green, 72px height, same width as input on mobile)
- Helper Text: "Browse all archived theses from all departments and years"
- Quick Filter Chips (horizontal scroll, below search):
- "Recent" | "Most Viewed" | "By Department ▼" | "By Year ▼" | "By Adviser ▼"
- Popular/Recent Theses Carousel (horizontal scroll, cards):
- Card: Title (2 lines max), Department badge, Year, "Open" button (ISU Green outline)
- Auto-scroll indicators
- Footer (muted, centered): "Need help? Contact the Research Department at research@isu.edu.ph"
INTERACTION FLOWS TO PROTOTYPE
Flow A: Login → Role-Based Dashboard
1 → (Google Sign-In) → Role Check → STAFF → Frame 2 | STUDENT → Frame 6
Flow B: Staff Register Thesis
Frame 2 → Click "Register New Thesis" → Frame 3
Frame 3 → Fill Drive Link → Click "Submit"
Frame 3 → PROCESSING (2-3s spinner: "Reading PDF and filling in details...")
Frame 3 → READY TO REVIEW: Shows filled-in Abstract + Keywords (editable)
Frame 3 → Staff edits if needed → Click "Confirm & Save"
Frame 3 → Toast "Thesis registered!" → Redirect to Frame 2 (new thesis at top)
Flow C: Staff Search Archive
Frame 2 → Click "Search Archive" tab → Frame 4 (staff header active)
Frame 4 → Type query → Instant BM25 results (client-side)
Frame 4 → Hover title → Abstract Preview Card appears
Frame 4 → Click "Combined Summary (5)" → Frame 5 slides up
Frame 5 → View summary → Copy/Export → Close → Back to Frame 4
Flow D: Student Search Archive
Frame 6 → Type in Hero Search → Frame 4 (student header)
Frame 4 → Filter by Department/Year → Results update
Frame 4 → Tap result → Abstract Preview → "Open in Drive"
Frame 4 → "Combined Summary" → Frame 5
Flow E: Filter & Refine (Both Roles)
Frame 4 → Click Filter Chips → Department/Year/Status applied → Results update instantly
TECHNICAL NOTES FOR FIGMA AI
- Client-side only search: BM25 index built in browser from Firestore data — instant, no backend calls for search
- PDF Processing: pdf.js runs in browser — downloads PDF from Drive link, reads text from first 4 pages, regex finds Abstract/Keywords sections and auto-fills the form
- Role enforcement: Firestore security rules — only STAFF role can write theses; both roles can read
- PWA-ready: Add "Install App" prompt in dashboards (optional)
- Offline-capable: Search index cached in IndexedDB
- Responsive: Mobile-first (375px), tablet (768px), desktop (1440px)
- Department scoping: Staff sees their department by default; Student sees all; both can change filter
FIGMA COLOR VARIABLES (Copy into Figma Variables)
--isu-green: #006439;
--isu-green-light: #F0F8F4;
--isu-green-dark: #004D2B;
--isu-yellow: #F7D000;
--isu-yellow-light: #FFF8E1;
--isu-yellow-dark: #C4A000;
--isu-red: #CD202B;
--isu-red-light: #FDEDEA;
--isu-blue: #23305B;
--isu-blue-light: #E8EBF2;
--isu-blue-dark: #1A2442;
--white: #FFFFFF;
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-500: #6B7280;
--gray-900: #111827;
--shadow-sm: 0 1px 2px rgba(0,100,57,0.05);
--shadow-md: 0 4px 12px rgba(0,100,57,0.08);
--shadow-lg: 0 8px 24px rgba(0,100,57,0.12);
FINAL NOTE FOR FIGMA AI
"Make it feel like an official ISU system — professional, trustworthy, green-first. Two distinct dashboards: Staff is task-oriented (register, manage, search); Student is discovery-oriented (big search, browse, explore). The PDF auto-fill is the magic moment for staff — submit Drive link, system reads PDF and fills the form, staff reviews and saves. Search is the star for both — instant BM25 with explainable 'Why this rank?' and hover abstract preview. Combined Summary is the 'wow' feature — one clean summary with citations. Every interaction fast, explanatory, and proudly ISU Echague branded."
ITERATION PROMPTS FOR FIGMA
After first generation, refine with:
- "Make the Staff Dashboard tabs more prominent"
- "Student Dashboard hero search should be bigger, more central"
- "Add the ISU Seal properly in Login header"
- "Smoothen the hover preview animation (200ms ease-out)"
- "Make the Combined Summary panel slide up from bottom on mobile"
- "Score badge should be smaller, top-right of title"
- "Filter chips should show active state with green background"
- "Processing states need clearer visual distinction"