# 10 — Group Work Split (3 members)

**Status:** ☐ DONE
**Owner:** all

**Prompt to your AI:**
> *"Read this file and `00-AI-PREAMBLE.md`. Then hold `main`: do not merge anything.
> I will send you each person's branch to review. For each one, check it against
> `00-AI-PREAMBLE.md` and the step doc it claims to implement, and tell me what is
> wrong or missing."*

---

## 1. The one thing to do first, together

`src/App.tsx` is a single ~1,270-line file containing six screens, the search
engine and the extraction mock. Three people editing it concurrently means
conflicts on every commit and lost work.

Before anyone branches: split it into the module layout in `00-AI-PREAMBLE.md`.
Move code **verbatim** — no renaming, no restyling, no fixes. One commit:

```
refactor: split App.tsx into per-screen modules (no behaviour change)
```

**In the same sitting:**

- Migrate the status enum to uppercase (`02` §5). The call sites are spread across
  all three people's files, so it has to be one coordinated commit.
- Delete one of the two lockfiles (`08` §1).

Target: 30 minutes, one screen, everyone present.

---

## 2. Ownership

After the split, each person only edits files they own.

### A — Data & Auth
**Files:** `types.ts` `firebase.ts` `data.ts` `seed.ts` `firestore.rules`
**Docs:** 02, 03, 04 §1–2

Schema, seed, Google sign-in, role routing, session restore, sign out, security
rules, and the Firestore data layer. **A also owns the Firebase console** — one
project, one owner, or the group ends up using the wrong one.

### B — Search & Intelligence
**Files:** `search.ts` `summary.ts` `SearchScreen.tsx` `SummaryPanel.tsx`
**Docs:** 05, 07, plus writing the 20 seed theses

BM25, the debounce, filters, "Why this rank?", and the extractive summary.

`search.ts` and `summary.ts` are **pure functions with no Firebase import**, so
this whole track can be built and verified on day 1 against a plain array, before
any backend exists. That is the biggest scheduling win in the project.

### C — PDF, UI & QA
**Files:** `extractPdf.ts` `RegisterForm.tsx` `index.css`
**Docs:** 06, 04 §3–4, 08, 09

pdf.js extraction, the safe-area header and ISU theme, deployment, and the final
QA pass. Owning QA means nothing ships broken.

**Shared:** `components/ui.tsx` (ISUSeal, StatusBadge, DeptBadge, Toast) — nobody
edits it except C's safe-area additions, and only additively.

---

## 3. Single-owner rules

Two things must not be done by three people at once.

| Task | Sole owner | Why |
|------|-----------|-----|
| Firebase project, web app, auth providers, Firestore, authorized domains | **A** | Two projects = the group uses the wrong one |
| Promote an account to `STAFF` | **A** | one source of truth for roles |
| `firebase deploy`, `firebase.json`, `.firebaserc` | **C** | config conflicts |
| Merging to `main` | **A**, or rotate daily | one pair of eyes on main |

Share the `firebaseConfig` in the group chat, not in git. The apiKey is public by
design for web apps — the real protection is the security rules.

---

## 4. Schedule

The dependency graph is the point: **A unblocks B and C on day 2.**

| Day | A | B | C |
|-----|---|---|---|
| 1 | Read 02–03, create Firebase project, `npm i firebase` | Read 05, copy BM25 into `search.ts` unchanged | Read 06, `npm i pdfjs-dist`, test pdf.js on a local PDF |
| 2 | `firebase.ts`, `types.ts`, `data.ts`, seed | Add debounce; verify fuzzy match; start `summary.ts` | `extractPdf.ts`; test against a **real** Drive link |
| 3 | Google sign-in, role routing, session restore | Filters + "Why this rank?" | `RegisterForm` wired to extraction (save still mocked) |
| 4 | Security rules + Playground test | 20 seed theses | Safe-area CSS + theme; wire the real save |
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
git fetch origin && git rebase origin/main     # daily, no exceptions
```

Merge order, because later merges are easier:

```
1. person-a-data    types.ts + data.ts — everything imports these
2. person-b-search  search.ts / summary.ts — pure, few conflicts
3. person-c-pdf     RegisterForm + index.css
```

No branch lives longer than 24 hours.

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
| **Drive CORS blocks pdf.js** | Files must be "Anyone with the link → Viewer". The `needs_review` manual-entry state already covers the failure — rehearse that path too, it is part of the design |
| **Google sign-in is one account per browser profile** | Use a normal window for one account and incognito for the other. Have all three sign in once so three user docs exist |
| **Only 8 sample theses** | B writes 20. Eight gives BM25 nothing to discriminate and the summary nothing to summarise |
| **`onSnapshot` reads the whole collection** | Fine for hundreds of docs. Only a problem in the thousands — note it, do not build for it |
| **Someone rebuilds the Figma UI** | `01` §5: never rebuild, only replace data sources. `ui.tsx` and the CSS are off-limits to everyone except C |
| **A branch sits unmerged for days** | A merges daily. Enforce it. |
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
| **C** | PDF auto-extraction, responsive UI, deployment | *"How does it read a PDF with no backend?"* → `extractPdf.ts`: pdf.js in-browser, 4 pages, line-preserving text, bounded regex |

Have each person demo their own track in the browser rather than describing it.
The auto-fill in particular is worth showing live, including the manual-entry
fallback.
