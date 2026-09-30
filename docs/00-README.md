# 00 — README (Master Index)

**ISU Thesis Archive Search** — development docs for a thesis archive search app
at Isabela State University, Echague Campus.

Staff register theses by pasting a Google Drive link; the app reads the PDF in the
browser and auto-fills the abstract and keywords. Staff and students then search
with BM25 ranking and read a combined extractive summary of the top results.

---

## How to use these docs with an AI

Each file is a **self-contained implementation spec**. Work through them in order,
one at a time.

1. Open `00-AI-PREAMBLE.md` and copy the block between the rules.
2. Paste that block into a new AI message.
3. Below it, paste the step doc — e.g. `03-backend-firebase.md`.
4. The AI implements that one step and stops.
5. Run that doc's **Verification** section yourself.
6. Tick the step, commit, move on.

### Keeping the AI on track

| Problem | What to say |
|---|---|
| It starts the next step | *"Implement only what this file specifies. Do not start step NN."* |
| It rewrites working UI | *"Never rebuild the UI. Replace data sources and fake behaviour only."* |
| It adds a server or an API call | *"There is no backend. Everything runs client-side."* |
| It adds a package | *"Ask me before adding any dependency."* |
| It produced a lot at once | *"Undo that. Do one file at a time and show me the diff."* |

### Order

| # | File | Owner | What you get |
|---|------|-------|--------------|
| 00 | **this file** | — | index + trackers |
| 00 | `00-AI-PREAMBLE.md` | — | **paste before every message** |
| 01 | `01-system-architecture.md` | all | context; no build work |
| 02 | `02-database-design.md` | A | types, schema, seed script, enum migration |
| 03 | `03-backend-firebase.md` | A | Firebase, Google auth, roles, security rules |
| 04 | `04-frontend.md` | A + C | ~~module split~~ **done**, then live data, theme, header |
| 05 | `05-search-ranking.md` | B | debounce + filters (`search.ts` already exists) |
| 06 | `06-pdf-extraction.md` | C | pdf.js auto-extraction |
| 07 | `07-combined-summary.md` | B | extractive summary |
| 08 | `08-deployment.md` | C | build, deploy, authorize domain |
| 09 | `09-testing-checklist.md` | C | full QA pass |
| 10 | `10-group-work-split.md` | all | who owns what, merge order, risks |
| 11 | `11-doc-errata.md` | — | what was corrected and why |
| 12 | `12-how-to-contribute.md` | everyone | **read once if you have never used GitHub** |
| 13 | `13-prompt-templates.md` | everyone | **copy-paste prompts for every step — start here** |

Steps 06 and 07 are independent — take whichever you prefer.

---

## What already exists

The app is **not** a blank project. A Figma prototype is already built and working:

- 6 screens as React components, one file per screen
- Real BM25 with IDF/TF saturation, over a prebuilt corpus index
- Real prefix + substring matching
- Department / year / status filters
- "Why this rank?" term-by-term breakdown

What is still fake:

- Data comes from a hardcoded `SAMPLE_THESES` array in `src/data.ts`, not Firestore
- Login has two role buttons, not Google sign-in
- PDF extraction is a `setTimeout` and a `MOCK_ABSTRACT` string
- The summary is one static template string

**Do not rebuild the working parts.** Replace the data sources and the fake
behaviour. This rule appears in `01-system-architecture.md` §5 and in the
preamble, and it is the main thing that keeps the project on schedule.

---

## Progress tracker

Verified against the code on 2026-09-30.

| Step | Owner | Status |
|------|-------|--------|
| 01 Architecture | all | ☑ done |
| Split `App.tsx` into modules | all, together | ☑ done — `c5644d4` |
| Delete one lockfile | with the split | ☑ done — npm only |
| Build runs `tsc --noEmit` | with the split | ☑ done |
| Migrate status enum to uppercase | all, together | ☑ done — see `02` §5 |
| 02 Schema + seed | A | ☑ done — PR #4 (`b774d97`); build fixed by adding placeholder `src/firebase.ts` |
| 03 Auth + rules + authorized domains | A | ☑ done — verified 2026-09-30 (sign-in, roles, 5 Playground rows) |
| 04 Live data | A | ☑ done — verified 2026-09-30 |
| 04 Theme + safe-area | C | ☐ |
| 05 Debounce + filters | B | ☐ (seed to 20 already done — 21 theses in `src/seed.ts`) |
| 06 pdf.js extraction | C | ☐ |
| 07 Extractive summary | B | ☐ |
| 08 Deployed | C | ☐ |
| 09 QA passed | C | ☐ |

---

## Feature tracker

- ☐ Sign in with an ISU Google account (`@isu.edu.ph` only)
- ☐ Role routing: STAFF → Staff Dashboard · STUDENT → Student Dashboard
- ☐ Sign out from every screen
- ☐ Staff registers a thesis by pasting a Google Drive link
- ☐ System reads the PDF (first pages, see `06` §4) → auto-fills Abstract + Keywords
- ☐ Fallback to manual entry if the PDF cannot be read
- ☐ Staff reviews → Confirm & Save → stored in Firestore
- ☐ Statuses: ARCHIVED / NEEDS_REVIEW (+ "Mark as Archived"); DRAFT reserved, see `02` §4
- ☐ Search: BM25, prefix + substring, 300ms debounce
- ☐ "Why this rank?" term-by-term breakdown
- ☐ Filters: Department / Year / Status
- ☐ Hover/tap a result → abstract preview → "Open in Drive"
- ☐ Combined summary of top results, extractive, with `[n]` citations
- ☐ Responsive headers with safe-area handling
- ☐ Security: only STAFF can write; students read-only
- ☐ Deployed on Firebase Hosting with HTTPS

---

## System at a glance

| | |
|---|---|
| Roles | Research Department staff (register + search) · Students (search only) |
| Stack | React 19 + Vite 8 + TypeScript + Tailwind 4 |
| Backend | Firebase Auth + Cloud Firestore + Hosting — **no custom server** |
| Search | BM25, in-browser, in-memory |
| PDF | Downloaded via the Google Drive API (free, API key), read by pdf.js in-browser |
| Summary | Extractive, in-browser, no AI |
| Storage | PDFs stay in Google Drive; the app stores only the share link |

---

## Documents that are no longer authoritative

`11-doc-errata.md` records what was corrected and why. It is a changelog, not a
spec — the step docs are the source of truth. Read it if you are curious why a
doc says something surprising, or if you quoted something from it earlier.
