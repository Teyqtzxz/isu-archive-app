# 00-AI-PREAMBLE — Standing Context

**Paste this at the top of EVERY message you send to an AI, before the step doc.**

Without it the AI is working blind: it does not know your architecture, your type
definitions, your colour tokens, or which parts of the prototype are real versus
fake. It will guess, and it will guess wrong.

Copy everything between the rules below.

---

<!-- ===== BEGIN PREAMBLE — copy from here ===== -->

You are helping develop **ISU Research Study E-Library**, a web app for the
Research Department of Isabela State University — Echague Campus. (Its working
name was "ISU Thesis Archive Search"; the professor renamed it on 2026-10-12.)

**Words on screen vs words in code.** The UI says **study / studies** (theses
*and* capstones are stored) and **E-Library**, never "thesis", "theses" or
"archive". The code keeps its original names on purpose — `Thesis`,
`NewThesis`, `saveThesis`, the Firestore collection `theses`, `ThesisStatus` —
because renaming a collection would orphan every stored record. Do not rename
identifiers, and do not put "thesis" or "archive" back into on-screen text.

## The system

Students read the whole study **view-only** in Google's viewer ("Read full study"; staff see "Open in Drive"). Each PDF is shared as **Isabela State University → Viewer** with download/print/copy limited to **Editors** — that Drive setting is the real protection, and it also blocks the Drive API download, so staff register from a PDF on their computer.

Staff register research studies by pasting a Google Drive link; the app reads
the PDF in the browser and auto-fills the abstract and keywords, and saving
**posts** the study at once (there is no review queue). Staff and students then
search the e-library with BM25F ranking (title, keywords, authors, adviser,
abstract and Academic Year, title weighted most), read a combined extractive summary of
the results they tick, and see department statistics.

| Role | Can do |
|------|--------|
| `STAFF` (Research Department staff) | Register and post studies, edit and delete them (Study Details), search, statistics |
| `STUDENT` | Search, view and statistics — read-only |

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
/** The one legal status. Everything staff register is posted at once. */
export type ThesisStatus = "POSTED";

export interface Thesis {
  id: string;
  title: string;
  authors: string[];   // in citation order; required on Register
  abstract: string;
  keywords: string[];
  department: string;
  year: number;
  adviser: string;
  driveLink: string;
  status: ThesisStatus;
  registeredBy: string;
  registeredAt: Timestamp | string | null;
  updatedBy?: string;                       // uid of the last editor; absent if never edited
  updatedAt?: Timestamp | string | null;    // serverTimestamp of the last edit
}

export type Role = "staff" | "student";
export type Screen = "login" | "staff-dashboard" | "register" | "search" | "summary" | "student-dashboard";
export type StaffTab = "dashboard" | "register" | "search" | "statistics" | "settings";
export type ExtractionState = "idle" | "extracting" | "success" | "needs_review";

/** registeredAt as a sortable ISO string, whatever shape it arrived in. null → "" (sorts last). */
export function registeredAtISO(t: Pick<Thesis, "registeredAt">): string;

export const DEPARTMENTS = [ /* the ten strings below */ ] as const;

/** Stored role on users/{uid}. Uppercase; separate from the lowercase routing `Role`. */
export type AccountRole = "STAFF" | "STUDENT";

/** What the register form hands to saveThesis() (edit mode: updateThesis()):
 *  saveThesis adds status (always POSTED); the server adds id, registeredBy,
 *  registeredAt; updateThesis adds updatedBy, updatedAt. */
export type NewThesis = Omit<Thesis, "id" | "status" | "registeredBy" | "registeredAt" | "updatedBy" | "updatedAt">;
```

Records saved before the `authors` field existed have no authors and are read as
`[]` in `data.ts`, so display code must handle an empty list ("Not recorded").

This is what `src/types.ts` exports today. **Never compare or
subtract `registeredAt` directly** — it is a three-way union. Sort and compare
through `registeredAtISO()`.

`users.department` must be one of `DEPARTMENTS` (or `""`), never a college code
like `"CAS"` — staff filters compare it against `Thesis.department`.

### Status — one value, and four traps

There is no review step any more (professor's decision, 2026-10-12): only
Research Department staff register, so a saved study is **posted** at once.

1. **`POSTED` is the only status.** There is no `ARCHIVED`, `NEEDS_REVIEW`,
   `DRAFT`, `isPending()`, `STATUSES`, status filter, "Pending review" stat or
   "Mark as Archived" button — all were removed on purpose. Do not bring any of
   them back.
2. **Old records still hold old values.** Records saved before the change may
   store `ARCHIVED`, `NEEDS_REVIEW` or `DRAFT`. `subscribeToTheses()` in
   `data.ts` reads every record as `POSTED`, so nothing else needs to handle
   them. `markAllPosted()` in `seed.ts` rewrites them in the database.
3. **`ExtractionState` is a different thing and stays lowercase.** Its
   `"needs_review"` means "the PDF could not be read, type the abstract
   yourself" — UI workflow state, not a stored status. Do not rename it. Staff
   must still type an abstract before "Save Manually" posts the study.
4. **No status is shown on screen.** Every study is posted, so there is no
   status badge or label anywhere (`StatusBadge` and `STATUS_LABELS` were
   removed from `shared.tsx`, errata #60). Do not add one back.

## Target file layout

```
src/
  types.ts            ← the types above, incl. DEPARTMENTS        ✅ EXISTS
  data.ts             ← the ONLY Firestore module: sign-in, user profile,
                        live theses (all read as POSTED), saveThesis
                        (adviser is typed freely: no option list),
                        updateThesis(id, fields) (keeps registeredAt/
                        registeredBy, adds updatedAt/updatedBy),
                        deleteThesis(id) (the Drive PDF stays);
                        both reject with a clear message        ✅ EXISTS
  firebase.ts         ← app, auth, db — real config for project
                        isu-archive-9253b (committed on purpose) ✅ EXISTS
  seed.ts             ← devtools maintenance helpers, NO sample
                        data (removed on the professor's request —
                        never add fake studies back):
                        removeSampleStudies(), removeDuplicateTheses(),
                        markAllPosted()                           ✅ EXISTS
  index.css           ← Tailwind + design tokens (ISU colours,
                        greys, radii, shadows) + safe-area vars  ✅ EXISTS
  App.css             ← all component styles, read the tokens    ✅ EXISTS
  search.ts           ← pure: tokenize, findMatchScore, docTextOf,
                        SearchIndex, buildIndex, computeDocFreq,
                        bestFieldFor, bm25Score (BM25F: field
                        weights + year), textOnly,
                        relevancePercent; examples in
                        search.check.ts (node src/search.check.ts) ✅ EXISTS
  summary.ts          ← pure: extractive summary, MMR over BM25,
                        one sentence per ticked study (step 07);
                        scores sentences via textOnly() only      ✅ EXISTS
  extractPdf.ts       ← pure: Drive API download or a local file +
                        pdf.js text extraction (step 06)          ✅ EXISTS
  stats.ts            ← pure: countByDepartment, topKeywords      ✅ EXISTS
  snippet.ts          ← pure: abstractSnippet — the one abstract
                        sentence on a search result card, from
                        splitSentences() output — plus queryTerms /
                        queryWordPattern, the word match highlightKw
                        shares (prefix, as search: "learn" →
                        "learning"; words under 2 letters ignored;
                        ñ and accents are letters);
                        examples in snippet.check.ts
                        (node src/snippet.check.ts)               ✅ EXISTS
  citation.ts         ← pure: APA 7 — splitName, apaName,
                        apaReference, apaInText, apaInTextLabels;
                        examples in citation.check.ts
                        (node src/citation.check.ts)              ✅ EXISTS
  validation.ts       ← pure: the Register form and search box
                        input rules and their messages; examples
                        in validation.check.ts
                        (node src/validation.check.ts)            ✅ EXISTS
  theme.ts            ← Light / Dark / System: parseChoice,
                        resolveTheme, toggledChoice (pure) +
                        read/save (localStorage, try/catch) and
                        apply (data-theme on <html>); examples
                        and the dark-palette contrast checks in
                        theme.check.ts (node src/theme.check.ts)  ✅ EXISTS
  similarity.ts       ← pure: TF-IDF vectors (title 3, keywords 2,
                        abstract 1; common words dropped) +
                        cosine similarity → 0–100% and shared key
                        terms: buildSimilarityIndex, similarStudies,
                        buildOriginalityIndex + originalityCheck
                        (overall or abstract-only, higher wins),
                        similarityLevel, THRESHOLDS; examples in
                        similarity.check.ts
                        (node src/similarity.check.ts); method in
                        docs/14-similarity.md                     ✅ EXISTS
  keywordModel.ts     ← pure: the keyword model — multinomial
                        Naive Bayes one-vs-rest (Laplace) on title
                        + abstract → keywords, plus TF-IDF two-word
                        phrases of the abstract: keywordKey,
                        trainKeywordModel (excludeId),
                        predictKeywords, extractPhrases,
                        suggestKeywords, leaveOneOutFolds,
                        evaluateKeywordModel, KEYWORD_MODEL;
                        words via similarity.ts (foldPlural,
                        isCountedTerm); examples in
                        keywordModel.check.ts
                        (node src/keywordModel.check.ts); method
                        in docs/15-keyword-model.md              ✅ EXISTS
  App.tsx             ← auth listener, live-data subscription, screen
                        routing (~180 lines; no screen UI inside) ✅ EXISTS
  components/
    shared.tsx        ← ISUSeal, DeptBadge, Toast, Icon, initialsOf,
                        formatPosted (the one "Posted" date
                        format), authorsPreview (+ Parts),
                        highlightKw (query words in <mark>: the
                        summary, the result snippet, author
                        names and adviser on result cards —
                        names skip titles/degrees, isNameTitle)  ✅ EXISTS
    LoginScreen.tsx   StaffDashboard.tsx   RegisterForm.tsx
    SearchScreen.tsx  StudentDashboard.tsx CombinedSummaryPanel.tsx
    DepartmentStats.tsx (staff Statistics tab + student dashboard)
    KeywordModelCard.tsx (staff Statistics tab only: the keyword
                      model's leave-one-out accuracy vs baseline)
    ConfirmDialog.tsx (the one "Are you sure?" dialog: Cancel
                      focused, red confirm, Escape/backdrop =
                      Cancel — never copy it, reuse it)
    SignOutDialog.tsx ("Sign out?", built on ConfirmDialog)
    ThemeToggle.tsx   (moon/sun button in every header and on the
                      login screen; ThemePicker = Light / Dark /
                      System in staff Settings and the student
                      account menu; useTheme keeps them in step)  ✅ EXIST

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

`search.ts`, `summary.ts`, `extractPdf.ts`, `stats.ts`, `citation.ts`, `snippet.ts`, `similarity.ts` and `keywordModel.ts` are **pure functions with no Firebase
import.** Keep them that way — it is what makes them testable and reviewable.

## What is real vs fake in the current code

Real, working — **do not rewrite**:
- BM25F scoring: `tokenize()`, `bm25Score()`, `docTextOf()` — in `src/search.ts`.
  Fields and weights: title 3, keywords 2, authors 2, adviser 2, abstract 1;
  a 4-digit query word also matches the Academic Year exactly (weight 3, and
  it counts in df). Titles/degrees (Dr., Engr., PhD…) are not indexed in the
  name fields. Tokens keep ñ and accents (`\p{L}`), not folded. `05` §3a
- Corpus index: `buildIndex()`, `computeDocFreq()`, `bestFieldFor()` — in `src/search.ts`
- Fuzzy prefix/substring: `findMatchScore()` → `1.0` exact, `0.8` prefix,
  `0.6` substring (only for query terms of 4+ characters)
- Relevance % normalised to the top score, capped at 97% by design
  (`relevancePercent()` in `search.ts`)
- 300ms search debounce, department/year filters with removable chips
  (step 05)
- Google sign-in (ISU accounts only), role routing, session restore, sign-out
  with a "Sign out?" confirmation, and `firestore.rules` (step 03)
- Live Firestore data, save (always POSTED), staff department (step 04)
- Staff **Edit** and **Delete** in Study Details (students never see them).
  Edit is `RegisterForm` in edit mode (`study` prop): pre-filled and cleaned
  as when typed, same `validation.ts` checks, reading a PDF optional (none
  chosen → no Drive download, the current abstract/keywords are kept), "Save
  changes" → `updateThesis()`, toast "Study updated", back to Search at that
  study. Delete asks "Delete this study?" (`ConfirmDialog`) → `deleteThesis()`,
  toast "Study deleted"; the live subscription removes it everywhere
- PDF reading from Drive or from this computer, with manual entry when it fails
  (step 06); the extractive summary (step 07)
- Department statistics: studies per department and top keywords (staff
  Statistics tab, student dashboard)
- APA 7 citations (`citation.ts`): a full reference in Study Details, and
  in-text citations plus an APA reference list in the combined summary
- The theme, responsive header and icon set (step 04 Parts 3–4)
- Dark mode: Light / Dark / System (default System, follows the device
  live), remembered per device, applied before first paint (errata #63)
- Document similarity, TF-IDF + cosine (`similarity.ts`, errata #64): the
  originality check on the Register / Edit save step and "Similar studies"
  in Study Details
- Keyword model, Naive Bayes + TF-IDF phrases (`keywordModel.ts`, errata
  #65): "Suggested keywords" on the Register / Edit save step and the
  "Keyword model" accuracy card in the staff Statistics tab
- Every screen's UI, one file per screen in `src/components/`

Four things in there are **deliberate and must survive a refactor** — each one
was a bug that was fixed, and each is easy to "clean up" back into a bug:

| Rule | Why it exists |
|------|---------------|
| `bm25Score(query, thesis, docIndex, index, df)` takes an **index**, not a corpus | The corpus-taking version re-tokenised every document once per document per keystroke — quadratic. 461 ms → 6.3 ms at 200 theses. |
| `queryTerm.length >= 4` before a substring match | Without it, 2–3 letter terms match inside almost every word: `ion` hits all 21 seed theses and `dr` matched `hydrological`. (4+ letter terms like `rate` still match mid-word by design.) |
| `avgDocLen` (and each field's `avgFieldLen`) falls back to `1` on an empty corpus or an unfilled field | Otherwise an empty archive yields `NaN`, and `NaN > 0` is false, so every result silently disappears. |
| `summary.ts` scores sentences with `textOnly(sentence)`, never `{ ...thesis, … }` | Search indexes authors, adviser and year; a copied thesis would make every sentence of a study "match" its author's name or year (errata #61). |

Nothing in the app is fake any more: the mock PDF reader and the template
summary were replaced in steps 06 and 07.

### APA 7 citations — the format is the professor's

```
Acosta, J. R., & Mindanao, L. (2026). *Title as typed* [Unpublished research study]. Isabela State University – Echague Campus.
(Acosta, 2026) · (Acosta & Mindanao, 2026) · (Acosta et al., 2026)
```

- The title is kept **exactly as typed** (no sentence-case conversion) and set
  in italics; the year is the study's Academic Year (`year`). No URL.
- Names are split by `splitName()`: the last word is the surname, together
  with any particles before it (`Dela Cruz`, `De los Santos`, `Sta. Maria`);
  suffixes stay after the initials (`Rizal, J., Jr.`). A name typed as
  `Surname, Given` is taken as written.
- Study Details starts with a **"Citation"** row (APA 7 format); the summary's
  list is headed **"References"** (APA 7 format). A study with no authors
  recorded shows **"Not recorded"**, never a reference without authors.
- Never build a citation inline: use `citation.ts`, and add an example to
  `citation.check.ts` for any naming rule you change.

### Similarity — originality check and similar studies (`docs/14`)

- Computed in the browser from the studies already loaded; nothing is stored
  and `firestore.rules`, `data.ts` and search ranking are not involved. The
  vectors are built once per data change (`useMemo`), never per keystroke.
- **Save step (Register and Edit study):** the study as it will be saved vs
  every stored study (Edit: never itself), at most 3 matches, each scored
  overall **and by abstract alone** — the higher score sets the level and is
  shown with its reason ("Abstract 100% similar" / "91% similar overall"),
  so a copied abstract under a new title is still caught: **≥ 80%**
  "Possible duplicate — this study may already be registered" + the checkbox
  **"I checked — register anyway"**, which must be ticked before Confirm &
  Save / Save Manually / Save changes; **50–79%** "Very similar study found";
  **30–49%** "Related studies". "Show details" opens the match inside the
  warning (the form is never left); "Open in Drive" opens a new tab.
- **Study Details (staff and students):** "Similar studies", the top 3 other
  studies at **≥ 15%** (overall score), each opening that study (the same jump as "View
  details"; search words and filters that hide it are cleared). None → no
  section.
- Both show **"Shared key terms"** (`SharedTerms` in `shared.tsx`).
- Change a threshold or word rule only in `similarity.ts`, with an example in
  `similarity.check.ts`. It is a screening aid, not a plagiarism verdict:
  paraphrasing is not caught (`docs/14` §5).

### Keyword model — suggested keywords and accuracy (`docs/15`)

- A machine-learning model trained in the browser from the studies already
  loaded (once per data change, `useMemo`); nothing is stored, no AI service,
  no library. Learned part: multinomial **Naive Bayes**, one-vs-rest per known
  keyword, Laplace smoothing, features = title + abstract words (similarity's
  word rules), labels = keywords normalised by `keywordKey()` ("Rice" = "rices").
  Only studies with keywords are training studies. Extracted part: the top
  **TF-IDF two-word phrases** of the abstract (never across punctuation; shown
  as written, "low-cost sensors").
- **Save step (Register and Edit study):** "Suggested keywords", at most **6**,
  learned first — only at **P ≥ 0.9 and ≥ 5 evidence words** — then phrases;
  each chip says "learned from N studies" or "from this abstract". Never a
  keyword the study already has; clicking adds it through `addKeywords()`
  exactly like typing (same rules, max 10); **never added automatically**.
  **Edit study never trains on the study being edited** (`excludeId`).
- **Staff Statistics tab:** "Keyword model" card — training studies, known
  keywords, leave-one-out **with near-copies (≥ 80%) hidden**: "N studies
  tested, M copies hidden", model vs baseline (6 most common keywords) for
  ≥ 1 correct / precision / recall, and below 30 studies with keywords
  "Fewer than 30 studies with keywords — not reliable yet." Never show the
  plain (copies kept) score on screen; it is explained in `docs/15` §5.
- Change a threshold only in `KEYWORD_MODEL` (`keywordModel.ts`), with an
  example in `keywordModel.check.ts`. Search ranking, similarity scores and
  validation rules are not affected.

### Input validation — one module, one example per rule

- Every Register input and both search boxes are checked by `validation.ts`;
  never write a check or an error message inline in a component. Add an
  example to `validation.check.ts` for any rule you add or change.
- Messages sit under their own field (`aria-invalid` + `aria-describedby`).
  Format checks run on leaving a field (or on **+ Add**), required fields on
  submit; nothing shows an error while typing. Search boxes never show one.
- Names: an author needs a first name and a surname (`J. Dela Cruz` counts;
  `Dela Cruz` alone does not; `Dela Cruz, Juan` is accepted). The adviser may
  start with a title and end with degrees after a comma (`Dr. Maria Santos,
  PhD`); the `Surname, Given` form is for authors only. A name typed all in
  lowercase or ALL CAPS is saved with capitals; mixed case is kept as typed.
- Academic Year is a text box, not a dropdown or date picker: digits only, 4
  digits, any past year up to this year, saved as a number.
- **Edit study uses the same checks** (it is the same form). A saved record is
  cleaned on loading as if typed; an author name saved before the checks
  existed is kept, but saving asks for it to be fixed (`cleanAuthorList()`).
- These checks run in the browser only; `firestore.rules` does not check field
  contents yet.

## Rules

1. **Never rebuild working UI.** Replace data sources and fake behaviour only.
   Doc 01 §5 is the authority on this.
2. **`src/data.ts` is the only module that imports `firebase/firestore`.** If a
   component needs data, it calls a function in `data.ts`.
3. **Status is set in one place:** `saveThesis()` writes `POSTED`
   (`updateThesis()` never writes `status`, `registeredAt` or `registeredBy`). Never add a
   second status or a review queue unless the group decides so first.
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

## Theme tokens and dark mode

**Rule: never hard-code a colour.** No hex, `rgb()`, `white` or brand token
for a text, background or border colour in `App.css` or a component; use the
semantic tokens in `index.css`. A brand token (`--isu-*`) is only for a fill
that looks the same in both themes (the seal, the brand stripe, the yellow
button, the avatars, the role chip). This check must print nothing:

```bash
grep -nE "#[0-9a-fA-F]{3,6}" src/App.css src/components/*.tsx
```

| Token | Use | Light | Dark |
|---|---|---|---|
| `--page-bg` | page | `--gray-50` | `#0E1412` |
| `--surface` | cards, dialogs | `#FFFFFF` | `#161E1B` |
| `--surface-raised` · `--input-bg` | raised bits, inputs | `--gray-50` · `--surface` | `#1D2723` |
| `--surface-hover` | row hover, preview, sources box | `--gray-25` | `#1A2320` |
| `--border` · `--border-strong` · `--divider` | borders, input borders, row lines | `--gray-200` · `300` · `100` | `#2B3632` · `#3A4742` · `#232D29` |
| `--fill-muted` · `--fill-strong` | tracks, empty icons · handles | `--gray-100` · `200` | `#212A26` · `#34403B` |
| `--text` · `--text-body` | headings · body text | `--gray-900` · `700` | `#E7EDEA` |
| `--text-secondary` · `--text-muted` | secondary · meta | `--gray-600` · `500` | `#9DABA5` |
| `--text-subtle` | placeholders, optional | `--gray-400` | `#85928D` |
| `--accent` | green text, links, active, focus, borders | `--isu-green` | `#5FD39A` |
| `--accent-fill` (+ `-hover`) | green buttons, `--on-fill` text | `--isu-green` | `#0F7A4A` |
| `--accent-soft` | green tint behind `--accent` | `--isu-green-light` | `#183328` |
| `--header-bg` · `--tab-active` | header, hero · active tab line | `--isu-green` · `--isu-yellow` | `#0B3D28` · `#5FD39A` |
| `--title-text` · `--badge-text` on `--badge-bg` | study titles · department badge | `--isu-blue` on `--isu-blue-light` | `#A9BBF5` on `#1E2844` |
| `--warn-text` on `--warn-soft` | keyword chips, review bar | `--isu-yellow-ink` on `--isu-yellow-light` | `#F7D000` on `#2C2A12` |
| `--highlight-bg` | query words in `<mark>` (normal text colour) | `--isu-yellow-light` | `rgba(247, 208, 0, 0.30)` |
| `--danger` · `--error-text` | red text, icons · messages | `--isu-red` · `--isu-red-ink` | `#FF6B6B` |
| `--danger-fill` (+ `-hover`) | red buttons, white text | `--isu-red` | `#D13438` |
| `--toast-bg` · `--backdrop` · `--shadow-*` | toast · dialog backdrop · depth | as before | `#2B3632` · darker · much softer |

`--accent-rgb`, `--danger-rgb`, `--blue-rgb`, `--on-fill-rgb` hold the same
colours as numbers for see-through tints: `rgba(var(--accent-rgb), 0.2)`.

- Dark values live in `index.css` under `:root[data-theme="dark"]` and, for
  System on a dark device, the identical block in
  `@media (prefers-color-scheme: dark)`. Add a token to `:root` (light) and to
  **both** dark blocks; `node src/theme.check.ts` fails if the blocks differ
  or a text pair is under 4.5:1. Add a pair there for any new text colour.
- The light values are the app's original look. Never change them for dark
  mode's sake; add a token instead.
- `color-scheme` is set with the theme, so native inputs, selects,
  checkboxes and scrollbars match.
- The choice is in `localStorage` under `isu-theme` (`light` / `dark`; none =
  System). The inline script in `index.html` sets `data-theme` before first
  paint and must keep the same key and values as `theme.ts`.

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
