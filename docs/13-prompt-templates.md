# 13 - Prompt Templates

**Copy from this file. Don't write your own prompts — the step docs already
contain the right instruction. Your job is to assemble, not to author.**

---

## Part 1 - The one rule

**Two things per message. Always. Never three.**

```
1.  00-AI-PREAMBLE.md  lines 13 to 221  (between the BEGIN/END markers)
2.  exactly ONE step doc, the whole file, nothing after it
```

Extra background makes it *worse*, not better. The AI weights what you hand it.
If you paste the preamble **plus** doc 01 **plus** doc 05, most of the message is
context and doc 05's precise instructions start competing with doc 01's looser
architectural sketch. The AI then builds what doc 01 described instead of what
doc 05 specified.

---

## Part 2 - Before you type anything

Do this once per step. Takes two minutes.

**In the terminal**, one command per line, press Enter after each:

```bash
git branch --show-current
```

If it prints `main`, stop. You are about to work on the wrong branch.

```bash
git pull
npm run dev
```

Leave the dev server running. Open **http://localhost:8443** in a second browser
tab. You want to see the app *before* the AI changes anything, so you know what
it broke if it breaks something.

**One shell note.** The verification steps in these docs use `grep`. PowerShell
has no `grep` — it will say *"grep is not recognized"*, which looks like a failed
check but is not. Either use **Git Bash** (right-click → *Git Bash Here*), where
`grep` works as written, or translate:

| Instead of | In PowerShell use |
|---|---|
| `grep -n "foo" path/to/file.tsx` | `Select-String -Path path/to/file.tsx -Pattern 'foo'` |
| `grep -rn "foo" src/` | `Get-ChildItem src -Recurse -Include *.ts,*.tsx \| Select-String -Pattern 'foo'` |

Both print every match. "Expect no output" still means "expect no output" either
way.

**In OpenCode** — its working directory must be the project root
(`isu-archive-app`). If you started OpenCode from the Desktop it cannot see your
code, and everything below fails silently.

---

## Part 3 - The message you send

Paste these three blocks, in this order, as **one message**:

```
[ BLOCK 1 ]
00-AI-PREAMBLE.md, lines 13 to 221

[ BLOCK 2 ]
--- the whole of your step doc, e.g. 05-search-ranking.md ---

[ BLOCK 3 ]
one line, copied from the step for that doc in Part 4 below
```

Block 3 is short on purpose. Its job is to stop the AI running ahead into the
next step, which it will otherwise try to do.

---

## Part 4 - Every step, ready to go

### Step 02 - Database design

| | |
|---|---|
| Owner | **A** |
| Branch | `person-a-data` |
| Doc | `02-database-design.md` |
| Blocked? | Partly. §6 seed script can be **written** but not **run** - needs Firebase |
| Already done | §5 status enum (marked DONE in the file - the AI will skip it) |

**Block 3:**

> Implement only what `02-database-design.md` specifies. Do not start step 03.

**What the AI produces:** `src/types.ts` (extended), `src/seed.ts`, the
Firestore schema, and the queries in §7.

**Verify:** §9 of the doc. Then `npm run build`.

---

### Step 03 - Firebase, auth, roles

| | |
|---|---|
| Owner | **A** |
| Branch | `person-a-data` |
| Doc | `03-backend-firebase.md` |
| Blocked? | **YES - you cannot start this alone** |

**§1 of this doc is a manual Firebase Console task.** It needs your Google
account: create the project, register the web app, enable Google sign-in and
Firestore, then add the authorized domain. There is no API key to paste and the
AI cannot do it for you.

**Order:** do §1 yourself in the browser first. Only then send the message.
Then §8 (making someone STAFF) also needs the console.

**Block 3:**

> Implement only what `03-backend-firebase.md` specifies. Do not start step 04.

**What the AI produces:** `src/firebase.ts`, real Google sign-in with the
`@isu.edu.ph` check, role routing, session restore, sign-out on every screen,
and `firestore.rules`.

**Verify:** §9. Confirm sign-out works from **all three** screens, not just one.

---

### Step 04 - Frontend

| | |
|---|---|
| Owner | **A** (§2.2–2.3) and **C** (§3.1–4.3) |
| Branch | A on `person-a-data`, C on `person-c-pdf` |
| Doc | `04-frontend.md` |
| Already done | Part 1, the module split - commit `c5644d4`. The AI will see it marked DONE |

A and C work simultaneously here. Their files do not overlap, so no conflict.

**A's block 3:**

> Implement only §2.2 and §2.3 of `04-frontend.md` - `src/data.ts` and wiring it
> into `App.tsx`. Do not touch the CSS sections. Do not start step 05.

**C's block 3:**

> Implement only §3.1 to §4.3 of `04-frontend.md` - the ISU theme, `index.css`,
> and the responsive header. Do not touch `src/data.ts`. Do not start step 05.

**Verify:** §6 of the doc.

---

### Step 05 - Search and ranking

| | |
|---|---|
| Owner | **B** |
| Branch | `person-b-search` |
| Doc | `05-search-ranking.md` |
| Already done | §1 (the move to `src/search.ts`) and §6 (performance). Both marked done - **do not let the AI redo them** |

**Block 3:**

> Implement only what `05-search-ranking.md` specifies. `src/search.ts` already
> exists and is correct - do not rewrite it. Do not start step 06.

**What the AI produces:** the 300ms debounce, filter chips, "Why this rank?",
empty states, and the expanded seed list.

**Verify:** §8 of the doc — it is a long checklist. Two checks matter most:

- Searching `rate` must **not** surface the machine-learning or watershed
  theses. If it does, the `length >= 4` guard was lost.
- Relevance reads **~97%, not 100%**. That is deliberate.

**Coordinate:** §7 asks you to expand the seed data, and that data lives in
`src/data.ts` - which is **A's** file. Whoever writes `data.ts` first owns it. If
A's PR is already merged, build on top of it. If not, do the search work and
leave the seed rows to A.

---

### Step 06 - PDF extraction

| | |
|---|---|
| Owner | **C** |
| Branch | `person-c-pdf` |
| Doc | `06-pdf-extraction.md` |

**Block 3:**

> Implement only what `06-pdf-extraction.md` specifies. Do not start step 07.

**What the AI produces:** `src/extractPdf.ts`, plus `RegisterForm` rewired off
the `setTimeout` mock.

**Note:** this step installs `pdfjs-dist`. Preamble rule 6 says ask before adding
a dependency — but this doc authorises it, so send this extra line:

> Installing `pdfjs-dist` is approved for this step.

**Verify:** §8. The important one: a PDF that cannot be read must land in the
manual-entry state, not a crash or a spinner that never stops.

---

### Step 07 - Combined summary

| | |
|---|---|
| Owner | **B** |
| Branch | `person-b-search` |
| Doc | `07-combined-summary.md` |

**Block 3:**

> Implement only what `07-combined-summary.md` specifies. Do not call any AI or
> any API. Do not start step 08.

**What the AI produces:** `src/summary.ts`, and `CombinedSummaryPanel.tsx` rewired
to call it instead of the hardcoded string.

**Verify:** §8. The two automated checks that matter:

```bash
grep -n "const extractive" src/components/CombinedSummaryPanel.tsx
```
expect **no output** - the mock is gone.

```bash
grep -n 'from "../summary"' src/components/CombinedSummaryPanel.tsx
```
expect **a match** - it calls the real algorithm.

---

### Step 08 - Deployment

| | |
|---|---|
| Owner | **C** |
| Branch | `person-c-pdf` |
| Doc | `08-deployment.md` |

**Block 3:**

> Implement only what `08-deployment.md` specifies. Do not run any deployment
> command yourself - I will do that.

**Then you deploy**, following the doc. This is the first step that leaves your
laptop.

**Verify:** §8. Open the deployed URL in a private window and confirm you are
**not** signed in.

---

### Step 09 - QA

| | |
|---|---|
| Owner | **C** |
| Branch | `person-c-pdf` |
| Doc | `09-testing-checklist.md` |

This step is **backwards on purpose** — you test, the AI plans.

**Block 3:**

> Do not run the app - I will test manually and report results. Instead, give me
> a prioritised test plan for `09-testing-checklist.md`, splitting each check into
> what can be automated with `grep` or `npm run build`, versus what needs a human
> on a real device with two Google accounts.

**Then you run the checklist** and send failures back. The doc has an
"Automated checks in one block" section — run it as-is, all at once.

---

## Part 5 - Day one, do this once

Before real work starts, run the onboarding prompt from `01-system-architecture.md`.
It builds no code. Its only job is to tell you whether the AI actually
understands your system.

If its one-paragraph summary of the architecture is wrong, you find out in thirty
seconds. Otherwise you find out three days into a broken build.

Do this **once**, with one member's AI. Never paste doc 01 again.

---

## Part 6 - If the AI goes wrong

Do not debug. Say one of these.

| What happened | What to type |
|---|---|
| It did too much at once | `Undo that. Do one file at a time and show me the diff.` |
| It rewrote working UI | `Never rebuild the UI. Replace data sources and fake behaviour only. Doc 01 §5 is the authority.` |
| It invented a server or an API call | `There is no backend. Everything runs client-side.` |
| It started the next step | `Stop. Implement only what this file specifies. Do not start step NN.` |
| It installed a package | `Ask me before adding any dependency. Which package, and why?` |
| It committed to `main` | `Stop. Check git status. main is never committed to directly.` |
| Build fails | `npm run build` fails. Here is the output. Fix only that error. Do not refactor anything else. |

**The build is the gate.** `npm run build` runs `tsc --noEmit` before Vite, so a
type error fails the build instead of shipping. If it prints errors, nothing gets
committed.

---

## Part 7 - Commit and hand it over

You verify first, then commit. Never the other way round.

```bash
git status
git diff
```

Read the diff. It should touch **only** the files your step doc named. If it
touched a file belonging to another member, stop - that is a merge conflict
waiting to happen.

```bash
git add .
git commit -m "Step 05: debounce and filters, per docs/05-search-ranking.md"
git push
```

Then open the PR and **wait**. You merge, not them.

**Never `git push` to `main`.** Preamble rules 9–11. The ruleset will block you
anyway, which is the point.
