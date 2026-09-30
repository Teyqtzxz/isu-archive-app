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
- The Google Drive API (free, API key, called from the browser) is used for one
  thing only: downloading a shared thesis PDF so pdf.js can read it

Never introduce a server, an API route, an AI/LLM call, or a paid service. The
Drive API download in step 06 is the one sanctioned external call.

## Stack

React 19 · Vite 8 · TypeScript 5.7 (strict) · Tailwind CSS v4 · Firebase Auth
(Google) + Cloud Firestore + Hosting · Google Drive API v3 (PDF download) ·
pdf.js (`pdfjs-dist`) · `oxfmt`

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

export function isPending(t: Pick<Thesis, "status">): boolean {
  return t.status === "NEEDS_REVIEW" || t.status === "DRAFT";
}

/** registeredAt as a sortable ISO string, whatever shape it arrived in. null → "" (sorts last). */
export function registeredAtISO(t: Pick<Thesis, "registeredAt">): string;

export const DEPARTMENTS = [ /* the ten strings below */ ] as const;

/** Stored role on users/{uid}. Uppercase; separate from the lowercase routing `Role`. */
export type AccountRole = "STAFF" | "STUDENT";

/** What the register form hands to saveThesis(): the server adds id, registeredBy, registeredAt. */
export type NewThesis = Omit<Thesis, "id" | "status" | "registeredBy" | "registeredAt">;
```

This is what `src/types.ts` exports today (step 02 is merged). **Never compare or
subtract `registeredAt` directly** — it is a three-way union. Sort and compare
through `registeredAtISO()`.

`users.department` must be one of `DEPARTMENTS` (or `""`), never a college code
like `"CAS"` — staff filters compare it against `Thesis.department`.

### The status enum — three traps

1. **`Thesis.status` is UPPERCASE.** The only legal values are `ARCHIVED`,
   `NEEDS_REVIEW`, `DRAFT`. Never write `"archived"` or `"pending"`. Get the
   values from `STATUSES`, never from a hand-written array literal.
2. **`ExtractionState` is a different thing and stays lowercase.** It is
   `"idle" | "extracting" | "success" | "needs_review"` and is UI workflow
   state, not stored data. It merely shares a word with `NEEDS_REVIEW`.
   Uppercasing it "for consistency" is a wrong cleanup.
3. **Never build a status label inline.** Display text lives in
   `STATUS_LABELS` in `src/components/shared.tsx`, and both the badge and the
   search filter pills read it. The old code had `s.charAt(0).toUpperCase() +
   s.slice(1)`, which turns `"ARCHIVED"` into `"ARCHIVED"` — all caps, in the
   middle of the staff UI.

## Target file layout

```
src/
  types.ts            ← the types above, incl. DEPARTMENTS        ✅ EXISTS
  data.ts             ← the ONLY Firestore module: sign-in, user profile,
                        live theses, saveThesis, updateThesisStatus,
                        plus the ADVISERS option list            ✅ EXISTS
  firebase.ts         ← app, auth, db — real config for project
                        isu-archive-9253b (committed on purpose) ✅ EXISTS
  seed.ts             ← one-off seed script, 21 theses; skips
                        existing titles; removeDuplicateTheses() ✅ EXISTS
  index.css           ← Tailwind + design tokens (ISU colours,
                        greys, radii, shadows) + safe-area vars  ✅ EXISTS
  App.css             ← all component styles, read the tokens    ✅ EXISTS
  search.ts           ← pure: tokenize, findMatchScore, docTextOf,
                        SearchIndex, buildIndex, computeDocFreq,
                        bestFieldFor, bm25Score                  ✅ EXISTS
  App.tsx             ← auth listener, live-data subscription, screen
                        routing (~180 lines; no screen UI inside) ✅ EXISTS
  components/
    shared.tsx        ← ISUSeal, StatusBadge, DeptBadge, Toast,
                        STATUS_LABELS, Icon, initialsOf          ✅ EXISTS
    LoginScreen.tsx   StaffDashboard.tsx   RegisterForm.tsx
    SearchScreen.tsx  StudentDashboard.tsx CombinedSummaryPanel.tsx  ✅ EXIST
  ─── not created yet ───
  summary.ts          ← pure: extractive summarisation (step 07)
  extractPdf.ts       ← pure: Drive API download + pdf.js text extraction (step 06)

firestore.rules       ← project root, not src/ — ISU-only, role immutable,
                        theses writes staff-only; pasted into the console ✅ EXISTS
```

File ownership (who may edit what) is in `10-group-work-split.md` §2.

**The split is already done.** `App.tsx` used to be 1333 lines holding
everything. It now holds only state, the auth and data wiring, and routing —
each screen, the types, the data layer and the search engine are in their own
files. Do not redo this. If a
step below tells you to "move code into `src/search.ts`", that file already
exists — the work is to *add* to it, not to create it.

`CombinedSummaryPanel.tsx` keeps its current name. A target layout of
`SummaryPanel.tsx` was considered and rejected: renaming it now would collide
with the file-ownership split in `10-group-work-split.md`, and the name is
accurate.

`search.ts`, `summary.ts` and `extractPdf.ts` are **pure functions with no Firebase
import.** Keep them that way — it is what makes them testable and reviewable.

## What is real vs fake in the current code

Real, working — **do not rewrite**:
- BM25 scoring: `tokenize()`, `bm25Score()`, `docTextOf()` — in `src/search.ts`
- Corpus index: `buildIndex()`, `computeDocFreq()`, `bestFieldFor()` — in `src/search.ts`
- Fuzzy prefix/substring: `findMatchScore()` → `1.0` exact, `0.8` prefix,
  `0.6` substring (only for query terms of 4+ characters)
- Relevance % normalised to the top score, capped at 97% by design
- 300ms search debounce, department/year/status filters with removable chips
  (step 05)
- Google sign-in (ISU accounts only), role routing, session restore, sign-out,
  and `firestore.rules` (step 03)
- Live Firestore data, save with status, "Mark as Archived", staff department
  (step 04)
- The theme, responsive header and icon set (step 04 Parts 3–4)
- All six screens' UI, one file per screen in `src/components/`

Three things in there are **deliberate and must survive a refactor** — each one
was a bug that was fixed, and each is easy to "clean up" back into a bug:

| Rule | Why it exists |
|------|---------------|
| `bm25Score(query, thesis, docIndex, index, df)` takes an **index**, not a corpus | The corpus-taking version re-tokenised every document once per document per keystroke — quadratic. 461 ms → 6.3 ms at 200 theses. |
| `queryTerm.length >= 4` before a substring match | Without it, 2–3 letter terms match inside almost every word: `ion` hits all 21 seed theses and `dr` matched `hydrological`. (4+ letter terms like `rate` still match mid-word by design.) |
| `avgDocLen` falls back to `1` on an empty corpus | Otherwise an empty archive yields `NaN`, and `NaN > 0` is false, so every result silently disappears. |

Fake, must be replaced:
- `RegisterForm` `setTimeout` + `MOCK_ABSTRACT` + `Math.random() > 0.3` → pdf.js
  (step 06). Saving is already real — only the PDF reading is fake.
- `CombinedSummaryPanel` static template string, and its Copy / Export buttons
  → extractive algorithm with Close only (step 07)

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
9. **Never commit or push to `main`.** You are always on a named branch. Commit
   there and let a human open and merge the pull request. `main` is the
   finished version; your branch is a proposal. If you are unsure which branch
   you are on, ask before committing anything.
10. **Never run a destructive git command** — `reset --hard`, `clean -fd`,
    `push --force`, `rebase` on someone else's branch, or `checkout .` — without
    asking first. These throw away work that cannot be recovered. `git status`,
    `git diff`, `git log` and `git restore <file>` are always safe.
11. **Never commit a secret.** No `.env`, no service account JSON, no real API
    key. Firebase's *web* config (`src/firebase.ts`) and the domain-restricted
    Drive browser key (`src/extractPdf.ts`) are safe to commit and **are**
    committed — every browser downloads them anyway. Admin and service-account
    credentials are not.
12. **Only edit the files this step doc names.** If a file outside the step's
    scope needs changing, stop and ask first. Working on a file another member
    owns is how the ownership split gets a merge conflict — that is the exact
    failure the file layout was designed to prevent.

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

The header reads `--header-h` and is `position: sticky` in normal flow, so
content always starts below it and no page needs a matching top padding. Never
hardcode a header height anywhere else. Full token list: `src/index.css`.

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
