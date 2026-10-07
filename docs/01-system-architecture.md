# 01 — System Architecture

**Status:** ☑ DONE — confirmed, no build work. Read this for context.
**Owner:** all · **Feeds into:** every other doc

**Prompt to your AI:**
> *"Read this for context. Do not implement anything. Then summarise the
> architecture back to me in one paragraph as if you were explaining it to my
> teacher, and answer: why is there no backend server?"*

---

---

## 1. What This System Is

A web app for the **ISU Thesis Archive Search** at Isabela State University —
Echague Campus. Two types of users:

| Role | Can do |
|------|--------|
| **Research Department Staff** | Register theses (paste Drive link → auto-read PDF), search archive, manage department theses |
| **Student** | Search archive only (read-only), view abstracts and combined summaries |

---

## 2. Tech Stack (final decision)

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | **React + Vite + Tailwind CSS v4** | Already what the Figma prototype generates |
| Auth | **Firebase Auth (Google)** | Free, no server, ISU Google accounts |
| Database | **Cloud Firestore** | Free tier, real-time updates |
| Hosting | **Firebase Hosting** | Free, HTTPS, one-command deploy |
| PDF download | **Google Drive API v3** + API key | Free; the one endpoint Drive lets a browser fetch from (CORS) |
| PDF reading | **pdf.js** (in the browser) | Reads PDFs client-side, zero backend |
| Search | **BM25** (client-side, in-memory) | Instant, explainable, no server |
| Summary | **Extractive** (client-side) | Sentence scoring, no AI/API cost |
| File storage | **Google Drive links** | No database storage space used |

**Key decision:** there is **NO custom backend server**. Everything "smart" runs in
the user's browser. Firebase only provides identity + storage of thesis records.

---

## 3. High-Level Diagram

```
┌──────────────────────────  BROWSER (React app)  ──────────────────────────┐
│                                                                            │
│   LOGIN ────▶ Google Sign-In (Firebase Auth) ────▶ role check ───▶ route   │
│                                                                            │
│   STAFF DASHBOARD            STUDENT DASHBOARD                             │
│      │ Register thesis           │ search bar                              │
│      ▼                           ▼                                         │
│   REGISTER THESIS ◀──────▶  SEARCH RESULTS (BM25)                          │
│      │ paste Drive link            │                                       │
│      ▼                              ├── click title → Abstract Preview     │
│  pdf.js reads PDF ──▶ auto-fill ◀───└── "View Summary" → Combined Summary  │
│      │ abstract + keywords                (extractive, [n] citations)      │
│      ▼                                    │                                │
│  staff reviews → Confirm & Save ─────────► SEARCH INDEX + FIRESTORE        │
│                                                                            │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │
        ┌──────────────────────┴──────────────────────────────┐
        ▼                                                     ▼
   Firebase Auth                                        Cloud Firestore
   (Google sign-in,        ◀──── reads/writes ────▶      collections:
    @isu.edu.ph only)                                 users { uid, role, dept }
                                                       theses { title, abstract,
                                                       keywords, driveLink,
                                                       status, year, adviser }
```

---

## 4. Data Flow Diagrams

### Flow A — Login & Routing
```
Sign in with Google
   → Firebase Auth returns user (email)
   → reject if not @isu.edu.ph
   → look up users/{uid} in Firestore for role
   → role = STAFF   → Staff Dashboard
   → role = STUDENT → Student Dashboard
   → on refresh: onAuthStateChanged restores session automatically
```

### Flow B — Staff registers a thesis
```
Staff Dashboard → "Register New Thesis"
   → paste Google Drive link → Submit
   → Drive API downloads the PDF → pdf.js reads the first pages → regex finds Abstract + Keywords
   → state = READY TO REVIEW (editable form)   OR
     state = NEEDS MANUAL ENTRY (fallback)
   → staff reviews → Confirm & Save
   → saved to Firestore: theses/{id}
   → dashboard updates automatically (Firestore realtime)
```

### Flow C — Search
```
Any search bar → query
   → debounce 300ms (queries under 2 characters count as "no query")
   → apply filters first: Department / Year / Status
   → build the index from what survives, then BM25-score it (title, abstract, keywords)
   → sort by score (or newest first when there is no query)
   → render cards with "Relevance: %"
```

### Flow D — Combined Summary
```
Search screen → tick results → "View Summary (N)"
   → take the N ticked theses' abstracts, in rank order
   → extractive sentence scoring (BM25 + MMR) → one sentence per ticked thesis, with [n] citations
   → show in slide-up panel → Close only
```

---

## 5. What the Prototype Already Gives Us

Verified against the code. **Never rebuild working UI — only replace data sources
and fake behaviour.**

| Piece | Where | Status |
|-------|-------|--------|
| 6 screens as components | `LoginScreen`, `StaffDashboard`, `RegisterForm`, `StudentDashboard`, `SearchScreen`, `CombinedSummaryPanel` | ✅ done |
| BM25 scoring | `tokenize()`, `bm25Score()` | ✅ real |
| Prefix/substring matching | `findMatchScore()` → `0.8` prefix, `0.6` substring | ✅ real |
| "Why this rank?" breakdown | — | ❌ removed 2026-09-30 (group decision) |
| Department/year/status filters | `SearchScreen` | ✅ done |
| Register processing states | `RegisterForm` (`extractState`) | ⚠️ driven by a **random** `setTimeout` |
| Data | `subscribeToTheses` / `saveThesis` in `data.ts` | ✅ live Firestore (step 04). `DEPARTMENTS` lives in `types.ts` |
| Login | `LoginScreen` | ✅ Google sign-in, ISU only (step 03) |
| PDF extraction | `MOCK_ABSTRACT` + `Math.random() > 0.3` | ❌ → pdf.js (step 06) |
| Summary | one static template string | ❌ → extractive algorithm (step 07) |
| 300ms debounce | `SearchScreen` | ✅ built (step 05) |
| Theme + responsive header | `index.css`, `App.css` | ✅ done (step 04 Parts 3–4) |
| Status values | uppercase `STATUSES` enum in `types.ts` | ✅ migrated (`02` §5) |
| Schema | `registeredBy` / `registeredAt` + `registeredAtISO()`, 21-thesis `seed.ts` | ✅ done (step 02) |
| PDF download | direct Drive fetch in the old spec | ❌ → Google Drive API with an API key (step 06) — the direct fetch is blocked by CORS |

The `App.tsx` module split is done (commit `c5644d4`) — see `04-frontend.md` Part 1.

**Rule of thumb:** never rebuild the UI. Only replace data sources and fake
behavior with real ones.

---

## 6. Folder/Project Setup (do this once)

> **Already done.** The app is at `Teyqtzxz/isu-archive-app` and the specs you are
> reading are in that repo's `docs/` folder. Clone it and you have everything:
>
> ```bash
> git clone https://github.com/Teyqtzxz/isu-archive-app.git
> cd isu-archive-app
> npm ci
> npm run dev        # opens http://localhost:8443
> ```
>
> The original from-scratch setup, for reference only:

```bash
# 1. Create the app folder
mkdir isu-archive-app
cd isu-archive-app

# 2. Copy ALL files from the unzipped "ISU Thesis Archive Prototype.zip"
#    (index.html, package.json, vite.config.ts, tsconfig.json, src/, ...)
# 3. Install + run
npm install
npm run dev        # opens http://localhost:8443

# 4. Version control
git init
git add -A
git commit -m "Initial: Figma prototype UI + BM25 search"
```

**Note:** this project uses **npm**. A stray `pnpm-lock.yaml` was committed
alongside `package-lock.json` and has been deleted — with two lockfiles, three
people install three different dependency trees and "works on my machine" becomes
a group-wide problem. Use `npm ci` when starting from a clean clone, and
`npm install` after adding a dependency. Do not reintroduce pnpm or yarn.

The dev server runs on **port 8443**, not 5173 (set in `vite.config.ts`):
`http://localhost:8443`.

---

## 7. Non-Functional Requirements

- **Responsive:** mobile-first (375px) → tablet (768px) → desktop (1440px),
  headers must respect `env(safe-area-inset-*)` for notches/Dynamic Island.
- **Performance:** instant search (client-side in-memory index, debounced input).
- **Offline-ready (optional):** cache thesis list in IndexedDB/localStorage so
  search still works offline.
- **Security:** Firestore rules must enforce **STAFF writes only**; students read-only.
- **Recoverable PDFs:** only the first pages are processed (`06` §4); graceful fallback to manual entry.

---

## 8. Verification

- [ ] You can explain the architecture to your teacher in one minute
- [x] `isu-archive-app` exists and `npm run dev` shows the Login screen
- [x] The first Git commit exists

## Connect to next files

Start with `00-AI-PREAMBLE.md`, then `02-database-design.md`.