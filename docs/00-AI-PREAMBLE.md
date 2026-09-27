# 00-AI-PREAMBLE — Standing Context

**Paste this at the top of EVERY message you send to an AI, before the step doc.**

Without it the AI is working blind: it does not know your architecture, your type
definitions, your colour tokens, or which parts of the prototype are real versus
fake. It will guess, and it will guess wrong.

Copy everything between the rules below.

---

<!-- ===== BEGIN PREAMBLE — copy from here ===== -->

You are helping develop **ISU Thesis Archive Search**, a web app for the Research
Department of Isabela State University — Echague Campus.

## The system

Staff register archived theses by pasting a Google Drive link; the app reads the
PDF in the browser and auto-fills the abstract and keywords. Staff and students
then search the archive with BM25 ranking and read a combined extractive summary
of the top results.

| Role | Can do |
|------|--------|
| `STAFF` (Research Department staff) | Register theses, search, manage |
| `STUDENT` | Search and view only — read-only |

## Hard architecture constraint

**There is no backend server.** This is deliberate, not a limitation:

- Search (BM25) runs in the browser over an in-memory array
- PDF reading (pdf.js) runs in the browser
- Summarisation (extractive) runs in the browser
- Firebase provides **identity and data storage only**

Never introduce a server, an API route, an AI/LLM call, or a paid service.

## Stack

React 19 · Vite 8 · TypeScript 5.7 (strict) · Tailwind CSS v4 · Firebase Auth
(Google) + Cloud Firestore + Hosting · pdf.js (`pdfjs-dist`) · `oxfmt`

## Canonical types (`src/types.ts`)

```typescript
export const STATUSES = ["ARCHIVED", "NEEDS_REVIEW", "DRAFT"] as const;
export type ThesisStatus = (typeof STATUSES)[number];

export interface Thesis {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  department: string;
  year: number;
  adviser: string;
  driveLink: string;
  status: ThesisStatus;
  registeredBy: string;
  registeredAt: Timestamp | string | null;
}

export type Role = "staff" | "student";
export type Screen = "login" | "staff-dashboard" | "register" | "search" | "summary" | "student-dashboard";
export type StaffTab = "dashboard" | "register" | "search" | "settings";
export type ExtractionState = "idle" | "extracting" | "success" | "needs_review";

export function isPending(t: { status: ThesisStatus }): boolean {
  return t.status === "NEEDS_REVIEW" || t.status === "DRAFT";
}
```

**The status enum is UPPERCASE.** Never write `"archived"` or `"pending"`.

## Target file layout

```
src/
  types.ts            ← the types above
  firebase.ts         ← initApp, auth, db (config pasted from console)
  data.ts             ← THE ONLY module that talks to Firestore
  seed.ts             ← one-off seed script
  search.ts           ← pure: tokenize, findMatchScore, buildIndex,
                         computeDocFreq, bestFieldFor, bm25Score, searchTheses
  summary.ts          ← pure: extractive summarisation
  extractPdf.ts       ← pure: Drive link parsing + pdf.js text extraction
  App.tsx             ← screen state machine + routing only
  components/
    LoginScreen.tsx  StaffDashboard.tsx  RegisterForm.tsx
    SearchScreen.tsx  StudentDashboard.tsx  SummaryPanel.tsx
    ui.tsx            ← ISUSeal, StatusBadge, DeptBadge, Toast (shared)
  index.css           ← Tailwind + ISU tokens + safe-area + header vars
```

`search.ts`, `summary.ts` and `extractPdf.ts` are **pure functions with no Firebase
import.** Keep them that way — it is what makes them testable and reviewable.

## What is real vs fake in the current prototype

Real, working — **do not rewrite, move at most**:
- BM25 scoring: `tokenize()`, `bm25Score()`, `docTextOf()`
- Corpus index: `buildIndex()`, `computeDocFreq()`, `bestFieldFor()`
- Fuzzy prefix/substring: `findMatchScore()` → `1.0` exact, `0.8` prefix,
  `0.6` substring (only for query terms of 4+ characters)
- "Why this rank?" per-term breakdown
- Relevance % normalised to the top score, capped at 97% by design
- All six screens' UI

Three things in there are **deliberate and must survive a refactor** — each one
was a bug that was fixed, and each is easy to "clean up" back into a bug:

| Rule | Why it exists |
|------|---------------|
| `bm25Score(query, thesis, docIndex, index, df)` takes an **index**, not a corpus | The corpus-taking version re-tokenised every document once per document per keystroke — quadratic. 461 ms → 6.3 ms at 200 theses. |
| `queryTerm.length >= 4` before a substring match | Without it, `rate` matched `invertebrates`, `demonstrated` and `integrated`, and `dr` matched `hydrological`. |
| `avgDocLen` falls back to `1` on an empty corpus | Otherwise an empty archive yields `NaN`, and `NaN > 0` is false, so every result silently disappears. |

Fake, must be replaced:
- `SAMPLE_THESES`, `DEPARTMENTS`, `ADVISERS` constants → Firestore
- `LoginScreen` role buttons → Google sign-in
- `RegisterForm` `setTimeout` + `MOCK_ABSTRACT` + `Math.random() > 0.3` → pdf.js
- `CombinedSummaryPanel` static template string → extractive algorithm
- The lowercase status union → the canonical enum above

## Rules

1. **Never rebuild working UI.** Replace data sources and fake behaviour only.
   Doc 01 §5 is the authority on this.
2. **`src/data.ts` is the only module that imports `firebase/firestore`.** If a
   component needs data, it calls a function in `data.ts`.
3. **Status is always passed in**, never hardcoded inside a save function.
4. **Firestore security rules are the security boundary.** Never write a rule that
   lets a user modify their own `role`.
5. **Graceful degradation is a feature, not an error.** If a PDF cannot be read, the
   manual-entry state is the correct outcome — never crash or hang.
6. **No new dependencies** without asking me first.
7. TypeScript strict mode; no `any` except where pdf.js types force it.
8. `npm run dev` to develop, `npm run build` to verify it compiles. Both must pass
   with zero errors before you report done. **This project uses npm — there is no
   `pnpm-lock.yaml`, and you must not create one.** Dev server is on port
   **8443**, not 5173.

## ISU colour tokens (`src/index.css`)

```css
:root {
  --isu-green: #006439;         /* primary, header, primary buttons */
  --isu-green-light: #F0F8F4;   /* card backgrounds */
  --isu-yellow: #F7D000;        /* warnings, highlight bar */
  --isu-yellow-light: #FFF8E1;  /* keyword highlight in summary */
  --isu-red: #CD202B;           /* errors, remove chip */
  --isu-blue: #23305B;          /* secondary/outline, titles, dept badges */
}
```

Never change these. They are from the ISU Corporate Visual Identity Manual.

## Safe-area / responsive header

```css
:root {
  --header-top: env(safe-area-inset-top, 0);
  --header-bottom: env(safe-area-inset-bottom, 0);
  --header-left: env(safe-area-inset-left, 0);
  --header-right: env(safe-area-inset-right, 0);
  --header-h: 56px;              /* 640px → 60px, 1024px → 64px */
}
```

The header height and `.main-content` padding must both read `--header-h`. Never
hardcode a pixel height in two places.

## Departments (exact strings — used as filter values, must match everywhere)

```typescript
export const DEPARTMENTS = [
  "Biology", "Agriculture", "Computer Science", "Forestry",
  "Chemical Engineering", "Environmental Science", "Education",
  "Business Administration", "Civil Engineering", "Nursing",
] as const;
```

## Current task

I will tell you which step doc to follow. Implement exactly that step, then stop
and report: what you changed, which files, and how I can verify it.

<!-- ===== END PREAMBLE — copy to here ===== -->

---

## How to use this

1. Copy the block above.
2. Paste it, then paste the step doc (e.g. `03-backend-firebase.md`) below it.
3. The AI implements one step and stops.
4. Verify using that doc's **Verification** section.
5. Tick the step, then move to the next.

If the AI tries to do more than the current step, tell it:
*"Implement only what `NN-*.md` specifies. Do not start the next step."*
