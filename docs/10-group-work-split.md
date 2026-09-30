# 10 — Group Work Split (3 members)

**Status:** ☑ Reference — read it, nothing to build
**Owner:** all

**Prompt to your AI:**
> *"Read this file and `00-AI-PREAMBLE.md`. Then hold `main`: do not merge anything.
> I will send you each person's branch to review. For each one, check it against
> `00-AI-PREAMBLE.md` and the step doc it claims to implement, and tell me what is
> wrong or missing."*

---

## 1. The one thing to do first, together

The module split is **already done and merged** — commit `c5644d4`, a pure
verbatim move of 1,191 code lines with no behaviour change. `src/App.tsx` went
from 1,333 lines to 87. Do not redo it.

Also already done, in the same sitting as the split:

- The stray `pnpm-lock.yaml` was deleted; npm is the only package manager.
- `npm run build` now runs `tsc --noEmit` first, so a type error fails the build.

- The status enum was migrated to uppercase (`02` §5) in one coordinated commit.
- Step 02 (schema + 21-thesis seed) is merged, and `src/firebase.ts` exists with
  placeholder config so the build passes.

Nothing is left to do together. Branch and start your track.

---

## 2. Ownership

**This table is the single source of truth.** `12` and `13` point here rather
than repeating it. Each person only edits files they own.

| Owner | Files |
|---|---|
| **A** | `src/types.ts` `src/firebase.ts` `src/data.ts` `src/seed.ts` `src/App.tsx` `firestore.rules` `components/LoginScreen.tsx` `components/StaffDashboard.tsx` `components/StudentDashboard.tsx` |
| **B** | `src/search.ts` `src/summary.ts` `components/SearchScreen.tsx` `components/CombinedSummaryPanel.tsx` |
| **C** | `src/extractPdf.ts` `components/RegisterForm.tsx` `src/index.css` `src/App.css` `firebase.json` `.firebaserc` |
| shared | `components/shared.tsx` — additive changes only (C's safe-area work) |

When a step needs a one-line change in someone else's file (e.g. adding an
`onSignOut` prop to `SearchScreen`), ask the owner to make it in their branch.

### A — Data & Auth
**Files:** see the table
**Docs:** 02, 03, 04 §1–2

Schema, seed, Google sign-in, role routing, session restore, sign out, security
rules, the Firestore data layer, and the screens that are mostly auth/data
wiring (`App.tsx`, login, the two dashboards). **A also owns the Firebase /
Google Cloud console** — one project, one owner, or the group ends up using the
wrong one. That includes creating the Drive API key for C (`06` §0).

### B — Search & Intelligence
**Files:** see the table
**Docs:** 05, 07 (the 21 seed theses are already written, in A's `seed.ts`)

BM25, the debounce, filters, "Why this rank?", and the extractive summary.

`search.ts` and `summary.ts` are **pure functions with no Firebase import**, so
this whole track can be built and verified on day 1 against a plain array, before
any backend exists. That is the biggest scheduling win in the project.

Note the summary file is `CombinedSummaryPanel.tsx`, not `SummaryPanel.tsx`.

### C — PDF, UI & QA
**Files:** see the table
**Docs:** 06, 04 §3–4, 08, 09

pdf.js extraction, the safe-area header and ISU theme, deployment, and the final
QA pass. Owning QA means nothing ships broken.

**Shared:** `components/shared.tsx` (ISUSeal, StatusBadge, DeptBadge, Toast) — nobody
edits it except C's safe-area additions, and only additively.

---

## 3. Single-owner rules

Two things must not be done by three people at once.

| Task | Sole owner | Why |
|------|-----------|-----|
| Firebase project, web app, auth providers, Firestore, authorized domains | **A** | Two projects = the group uses the wrong one |
| Promote an account to `STAFF` (in the console, `03` §8) | **A** | one source of truth for roles |
| Drive API key (`06` §0) | **A** creates, **C** uses | it lives in the same Google Cloud project |
| `firebase deploy`, `firebase.json`, `.firebaserc` | **C** | config conflicts |
| Merging to `main` | **A**, or rotate daily | one pair of eyes on main |

**Commit `src/firebase.ts` with the real `firebaseConfig`** — do not keep it in
the group chat or a `.env`. The apiKey is public by design for web apps (every
visitor's browser downloads it), and a fresh clone must build and run for QA and
grading. The real protection is the security rules. The same goes for the
domain-restricted Drive API key in `extractPdf.ts`.

---

## 4. Schedule

The dependency graph is the point: **A unblocks B and C on day 2.**

| Day | A | B | C |
|-----|---|---|---|
| 1 | Read 03, create Firebase project, paste config into `firebase.ts`, create the Drive API key for C | Read 05, add debounce; verify fuzzy match | Read 06, run the **Drive API spike** (`06` §0), `npm i pdfjs-dist` |
| 2 | Google sign-in, `AccountRole` → `types.ts`, role routing, session restore | Filters + "Why this rank?" (`idf`/`tf`) | `extractPdf.ts`; test against **real** ISU thesis PDFs |
| 3 | Security rules + Playground test; promote staff; run the seed | Start `summary.ts` | `RegisterForm` wired to extraction (save still mocked) |
| 4 | `data.ts` live data + `saveThesis` + "Mark as Archived" | Finish summary panel + citations | Safe-area CSS + theme; wire the real save |
| 5 | 🔀 **INTEGRATION — all three, one screen** 🔀 | | |
| 6 | Fix bugs in own files | Fix bugs in own files | Fix bugs in own files |
| 7 | — | — | Deploy, then full QA pass |

**Day 5 is non-negotiable.** Three people who each assume the other wired it is how
a project gets demoed broken.

---

## 5. Git

```bash
git checkout -b person-a-data      # likewise -b person-b-search, -b person-c-pdf
git add -A && git commit -m "feat(search): add 300ms debounce to SearchScreen"
git push -u origin person-b-search
git pull origin main               # daily: merge main into your branch
```

**Merge, never rebase.** Rebasing a pushed branch forces a `push --force`, which
preamble rule 10 forbids. `git pull origin main` is always safe.

Merge order, because later merges are easier:

```
1. person-a-data    types.ts + data.ts — everything imports these
2. person-b-search  search.ts / summary.ts — pure, few conflicts
3. person-c-pdf     RegisterForm + index.css
```

Merge `main` into your branch daily, and open a PR as soon as a piece works —
small PRs merge cleanly.

---

## 6. Working with the AI

Each of you runs your own AI session for your own docs. Two rules keep the sessions
from conflicting:

1. **Always paste `00-AI-PREAMBLE.md` first.** Without it the AI does not know the
   types, the file layout, or which parts of the prototype are real. It will guess.
2. **Stay inside your own files.** If the AI wants to touch a file you do not own,
   stop it. That is the merge conflict you set out to avoid.

If an AI insists on a dependency the other person is building, stop and ask that
person rather than stubbing it yourself — two stubs that never meet is a worse
problem than a two-hour wait.

---

## 7. Risks

Decide these now, not in a panic.

| Risk | Mitigation |
|---|---|
| **Drive blocks the PDF download (CORS)** | Direct Drive links are blocked by the browser, so `06` downloads through the Drive API with a key. C runs the day-1 spike (`06` §0) before building. Files must still be "Anyone with the link → Viewer". The `needs_review` manual-entry state covers any failure — rehearse that path too |
| **Google sign-in is one account per browser profile** | Use a normal window for one account and incognito for the other. Have all three sign in once so three user docs exist |
| **Only 8 sample theses** | Resolved — `seed.ts` has 21 |
| **`onSnapshot` reads the whole collection** | Fine for hundreds of docs. Only a problem in the thousands — note it, do not build for it |
| **Someone rebuilds the Figma UI** | `01` §5: never rebuild, only replace data sources. `shared.tsx` and the CSS are off-limits to everyone except C |
| **A branch sits unmerged for days** | A merges daily; everyone runs `git pull origin main` daily. Enforce it. |
| **Duplicate thesis registrations** | Nothing currently prevents two staff registering the same thesis. Add a normalised-title check before `addDoc` |

---

## 8. Defending it

Each person presents their own track and can answer the other two in one sentence
each. Expect *"why is there no backend server?"* — the answer is in `01` §2:
everything smart runs client-side, Firebase provides identity and storage only,
which keeps it free and instant.

| Person | "I built…" | Likely question |
|--------|-----------|-----------------|
| **A** | Auth, roles, the database, security rules | *"How do you stop a student writing to the database?"* → `firestore.rules`, `isStaff()`, immutable `role` |
| **B** | BM25 ranking, fuzzy matching, combined summary | *"What is BM25, and why not plain TF-IDF?"* → `search.ts`: term-frequency saturation, length normalisation, k1/b |
| **C** | PDF auto-extraction, responsive UI, deployment | *"How does it read a PDF with no backend?"* → `extractPdf.ts`: Drive API download (CORS-friendly, free), pdf.js in-browser, first pages only, line-preserving text, bounded regex |

Have each person demo their own track in the browser rather than describing it.
The auto-fill in particular is worth showing live, including the manual-entry
fallback.
