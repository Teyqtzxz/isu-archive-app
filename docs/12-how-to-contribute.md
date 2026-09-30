# 12 — How to Contribute (for people who have never used GitHub)

**Status:** ☑ Reference — read once · **Owner:** everyone · **Depends on:** nothing

> *"Read this whole file once. It takes about ten minutes and it is the only
> Git knowledge you need for this project. Follow the numbered steps literally
> the first time. After that it is four commands."*

---

## The one idea you need

Three people are editing the same project at the same time. If everyone worked
on one shared copy, your changes would land on top of each other and be
impossible to untangle.

Git solves this with three things:

| Thing | What it means here |
|-------|--------------------|
| **commit** | A named save point in history. You can always go back to one. |
| **branch** | Your own private scratch copy of the project. Nobody sees it until you say so. |
| **pull request** | "Please look at my branch and merge it into `main`." |

That is the whole system. A branch is your own copy; a pull request is you
asking to have it merged.

**Never work directly on `main`.** `main` is the finished, working version. Your
branch is a proposal.

---

## Why this project splits work by file

`main` cannot hold two people's work at once without conflicts, so each person
owns specific files and nobody else edits them. **The full list is in
`10-group-work-split.md` §2** — check it before you edit anything. In short: A
has data, auth, `App.tsx` and the dashboards; B has search and the summary; C
has PDF extraction, the register form, the CSS and the deploy config.

If you need a change in someone else's file, **ask them.** Do not edit it. That
one rule prevents nearly every merge conflict you could have.

---

## First time setup (do this once, on your own machine)

```bash
git clone https://github.com/Teyqtzxz/isu-archive-app.git
cd isu-archive-app
npm ci
npm run dev          # opens http://localhost:8443
```

If `npm run dev` prints a port error, that port is taken. Use another port and
open that address instead:

```bash
PORT=3000 npm run dev            # Git Bash / macOS / Linux
```

```powershell
$env:PORT=3000; npm run dev      # Windows PowerShell
```

Check it works before you change anything. You should see the ISU login screen.

---

## The loop (every single time you start a task)

### 1. Get the latest

```bash
git pull
```

Always do this first. Skipping it is the number one cause of merge conflicts.

### 2. Make your own branch

```bash
git checkout -b person-a-data
```

Use your track's branch name: `person-a-data`, `person-b-search` or
`person-c-pdf` (the same names `10` and `13` use). When a task is merged, delete
the branch and make a fresh one from the latest `main`, e.g.
`person-a-data-step04`.

### 3. Work

```bash
npm run dev
```

Edit only your own files.

### 4. Check it still works — every time, before you commit

```bash
npm run build
```

This runs a TypeScript check **and** the build. Both must pass with zero
errors. If you report a task done with a failing build, your work cannot be
merged and you will be asked to fix it.

### 5. Commit

```bash
git add .
git commit -m "Add Firestore data layer with role check"
```

Your message should say *what* you did and, if it is not obvious, *why*.
One line is fine. Use the present tense: "Add", not "Added" or "Adds".

Check what you are about to commit — this catches accidentally included junk:

```bash
git status
```

Never commit `node_modules/` or a `.env`. If you created a `.env`, stop and tell
the group; real secrets must never be pushed. (`src/firebase.ts` with the
Firebase web config **is** committed on purpose — it is not a secret. See
`10` §3.)

### 6. Push your branch

```bash
git push -u origin person-a-data
```

Do this once per branch. Later pushes on the same branch are just `git push`.

### 7. Open the pull request

Go to the repo page on GitHub. It will show a banner offering to compare your
branch. Click **Compare & pull request**.

Fill in:

- **Title** — what you did, same as your commit message
- **Description** — answer these, briefly:
  - What changed?
  - How did you check it? ("`npm run build` passes, tested STAFF and STUDENT
    roles with two browsers")
  - Anything the reviewer should know or any part you are unsure about?

Then click **Create pull request**.

### 8. Wait for review

Someone else merges it. If they ask for changes, you make them on the *same
branch*, `git add`, `git commit`, `git push` — the pull request updates
automatically. Do not open a new pull request.

---

## If something goes wrong

### You edited the wrong file

```bash
git status
git restore src/data.ts      # undo changes to that one file
```

### You committed something broken

```bash
git log --oneline -3                       # find the commit hash
git revert <hash>                          # undo it, safely, with history intact
```

Never use `git reset --hard` unless you understand it. It throws away work.

### Your branch is behind

```bash
git pull origin main
```

Merge `main` into your branch **before** asking for review, not after — and at
least daily while you work. It is much easier to resolve a conflict in your own
branch than in the review. Always merge; never `git rebase` a branch you have
pushed (it would need a force-push, which is banned).

### You have a merge conflict

`git status` marks the file as `both modified` and inserts `<<<<<<<` markers
in the file. Open it, decide what should stay, delete the marker lines, save,
then:

```bash
git add <file>
git commit
```

**This should not happen** if you only touch your own files. If it happens
often, someone is editing files they do not own.

### You are completely lost

```bash
git status
git stash          # save your work, safely, without committing
```

`git stash` never loses work. Use it whenever you are unsure. To get your work
back: `git stash pop`.

---

## Rules that are not negotiable

1. **Never work on `main`.** Always on a branch.
2. **Never edit another person's files.** Ask them.
3. **`npm run build` must pass** before every commit you ask to merge.
4. **Never commit secrets.** No `.env`, no service account JSON, no admin
   credentials. The Firebase web config and the domain-restricted Drive browser
   key are **not** secrets and are committed (preamble rule 11).
5. **Never force-push to `main`.** If a push is rejected, pull and merge —
   do not reach for `--force`.
6. **One task per branch.** Merged task, then delete the branch and start a new one.

---

## Working with an AI that can edit your files

If you use OpenCode, Claude Code or Cursor, the AI reads and writes the project
directly. **Do not copy code out of a chat window** — you do not need to, and
pasting by hand is the most common way a working file gets broken.

Your loop becomes:

1. Make sure you are on your own branch (step 2 above)
2. Start the AI in the project folder
3. Paste everything between the `BEGIN PREAMBLE` and `END PREAMBLE` markers in
   `00-AI-PREAMBLE.md`, then your step doc below it
4. The AI edits the real files and runs `npm run build`
5. It reports back: what changed, which files, how to verify
6. **You** run that doc's Verification section yourself — do not trust the report
7. Commit, push, open the PR

Two things the AI is told not to do, because they would break this workflow:

- **Never commit or push to `main`.** Rules 9 in the preamble. If the AI says it
  committed to `main`, stop and check `git status`.
- **Never run destructive git commands** without asking. Rule 10. If it proposes
  `reset --hard` or `push --force`, say no and ask what it was trying to do.

The AI commits to your branch. **Merging into `main` is a human job** — yours.

---

## If you only remember five commands

```bash
git pull                                        # get latest
git checkout -b my-branch                       # start a branch
git add . && git commit -m "what I did"         # save
git push -u origin my-branch                    # share
                                               # then open the PR on GitHub
```

That is the entire workflow. Everything else in this file is recovery for when
something goes wrong.
