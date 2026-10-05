# 09 — Final Testing Checklist (QA)

**Status:** ☐ TODO
**Owner:** C · **Depends on:** all · **Last step**

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first. Do not run the app — I will test manually and
> report results. Instead, give me a prioritised test plan for this checklist,
> including which tests can be automated as `grep`/`npm run build` checks versus
> which need a human on a real device with two Google accounts."*

This is a **human** step. Run the app — locally and on the deployed URL — and click
through everything below. ✓ pass, ✗ fix and re-test.

Each item marked **[auto]** can be checked by a command. Run those first; they take
seconds and catch the regressions that are easiest to reintroduce.

---

## 1. Authentication

- [ ] **[auto]** `grep -rn "page.reload\|alert(" src/` returns nothing
- [ ] Sign in with an `@isu.edu.ph` Google account → correct dashboard
- [ ] A non-ISU account is rejected with a visible on-screen message
- [ ] Refresh keeps you signed in
- [ ] Sign-in works on the **deployed** URL, not only localhost
      (an `auth/unauthorized-domain` error means `08-deployment.md` §4b is missing)
- [ ] You can switch between two accounts using a normal window and an incognito
      window — Google reuses the last signed-in account otherwise
- [ ] Sign Out works from: Staff Dashboard (every tab, incl. Register) · Search ·
      Student Dashboard. The Summary panel is a modal over Search — Close, then
      Sign Out from Search
- [ ] Sign Out on mobile is reachable via the avatar dropdown

## 2. Roles and security

Run all four rows in the Firestore **Rules Playground**. Row 4 is the one that
matters most.

- [ ] Student writes to `theses` → **denied**
- [ ] Staff writes to `theses` → **allowed**
- [ ] Student updates own `users/{uid}` doc, `role` unchanged → **allowed**
- [ ] Student updates own doc to `role: "STAFF"` → **denied**
- [ ] No account can create a new user doc already born as `STAFF`
- [ ] A non-ISU Google account reading `theses` → **denied** (the rules enforce
      the domain, not just the login screen — `03` §7)
- [ ] STUDENT never sees the Register form or the staff tabs
- [ ] STAFF sees Dashboard / Register / Search / Settings + their department badge
- [ ] Student default filter is "All Departments"; staff default is their department

## 3. Staff dashboard

- [ ] Stats count real data: Total Theses (dept) / Pending Review / This Month
- [ ] Pending Review = `NEEDS_REVIEW` + `DRAFT`, via the `isPending` helper
- [ ] **Registering via "Save Manually" makes the Pending Review count go up by 1**
      — this proves status is passed in rather than hardcoded
- [ ] Recent Theses lists only the staff member's department, and the badge
      shows that department (not a hardcoded "CAS")
- [ ] Badges: ARCHIVED green · NEEDS REVIEW yellow · DRAFT gray
- [ ] **Every** status badge renders — an unstyled badge means an enum mismatch
- [ ] Rows are newest first — a just-saved thesis appears at the top at once
- [ ] "Mark as Archived" on a NEEDS REVIEW row turns it ARCHIVED and Pending
      Review drops by 1
- [ ] An empty database shows an empty state, not a crash

## 4. Register thesis (PDF auto-fill)

- [ ] **[auto]** `grep -rn "MOCK_ABSTRACT\|Math.random" src/` returns nothing
- [ ] **[auto]** `grep -rn "drive.usercontent" src/` returns nothing — downloads go
      through the Drive API
- [ ] Clicking "Read PDF & continue" with no Drive link (or a missing title /
      department / adviser) shows a message naming what is missing
- [ ] Real text-based PDF → PROCESSING → READY TO REVIEW, on localhost **and**
      on the deployed URL (the Drive API key must allow both — `06` §0)
- [ ] A file shared as "Restricted" → NEEDS MANUAL ENTRY with the "Anyone with
      the link" message
- [ ] An abstract containing the word "background" mid-text is not cut short
- [ ] Abstract and keywords come from the actual PDF
- [ ] **Keyword chips contain only keywords** — no page 2–4 text bleeding in
- [ ] A PDF using `KEY WORDS:` with a space parses correctly
- [ ] Staff can edit the abstract and add/remove keyword chips
- [ ] "Confirm & Save" → toast → document with `status: "ARCHIVED"` → top of table
- [ ] Scanned/image-only PDF → NEEDS MANUAL ENTRY → "Save Manually" works and
      writes `status: "NEEDS_REVIEW"`
- [ ] Garbage link → specific error message, no crash
- [ ] Non-Drive URL is rejected before any download starts

## 5. Search (both roles)

- [ ] **[auto]** `grep -rn "firebase/" src/search.ts src/summary.ts src/extractPdf.ts`
      returns nothing — the pure modules must not import Firebase
- [ ] `Bio` surfaces **Biodiversity**, ~300ms after typing stops
- [ ] `diver` also surfaces it
- [ ] A single-character query does not search
- [ ] Empty query → all theses, newest first
- [ ] "Relevance: XX%" shows, and the top result shows the highest percentage
      (it is capped just under 100% by design — that is intentional)
- [ ] Department / Year / Status combine with the query and each other
- [ ] Active filters show as removable chips; "Clear filters" resets everything
- [ ] Students do not see the Status filter
- [ ] Results change as you type, and stop updating once you pause

## 6. Abstract preview

- [ ] Clicking (or tapping) a result title expands the full abstract under it
- [ ] The preview shows "Open in Drive" (green outline)
- [ ] "Open in Drive" opens in a new tab
- [ ] Clicking the title again collapses it
- [ ] "Open in Drive" on a seeded thesis whose link is still a placeholder does
      not crash the page (it just opens Drive's own not-found page)

## 7. Combined summary

- [ ] **[auto]** `grep -n "const extractive" src/components/CombinedSummaryPanel.tsx`
      returns nothing — the hardcoded mock summary is gone
- [ ] **[auto]** `grep -n "copied" src/components/CombinedSummaryPanel.tsx` returns
      nothing — the Copy button was removed with the old action bar
- [ ] "View Summary (N)" appears only when N ≥ 1, and N matches the ticked count
- [ ] Panel slides up on mobile, centred on desktop
- [ ] Sentences are **real sentences from the top results**, and they change when
      the query changes
- [ ] Every sentence is traceable to an abstract in the results
- [ ] Citation chips correspond to visible rank — tick #2 and #5, chips read
      `[2]` and `[5]`
- [ ] Tapping a chip closes the panel and scrolls to that result
- [ ] Query words are highlighted in ISU yellow
- [ ] Action bar has **Close only**
- [ ] Close returns to Search
- [ ] No network request fires when the panel opens

## 8. Design and responsive

- [ ] **iPhone with Dynamic Island (~48px top inset)** — logo and title fully
      visible below the notch
- [ ] **375px** — tabs scroll, long titles truncate, "View Summary (N)" is not
      cut off
- [ ] **768–1023px** — full title, visible Sign Out button
- [ ] **1366px+** — centred container, all navigation visible
- [ ] No breakpoint where content sits under the header
- [ ] Colours: green `#006439` primary · blue `#23305B` secondary · yellow
      `#F7D000` warning · red `#CD202B` error

## 9. Empty states and errors

- [ ] No search results → "No theses found / Try different keywords…"
- [ ] Empty database → sensible empty dashboard, no crash
- [ ] Dead Drive link → clear message
- [ ] Firestore unreachable → a visible error banner, not a blank app
- [ ] An empty archive and a failed load look **different** — empty shows the
      empty state, failed shows the error banner

## 10. Repository and deployed version

- [ ] **[auto]** Only one lockfile is committed
- [ ] **[auto]** `npm run build` passes with zero errors
- [ ] A fresh `git clone` → install → build succeeds — this is the check that
      proves the repo is reproducible for whoever grades it
- [ ] The deployed URL loads
- [ ] Login, search, register and summary all work on the deployed URL
- [ ] HTTPS padlock, no mixed-content warnings
- [ ] `docs/` is committed in the repo
- [ ] Latest commit is pushed to the remote

---

## Automated checks in one block

```bash
grep -rn "MOCK_ABSTRACT\|Math.random" src/            # expect: no output
grep -rn "page.reload\|alert(" src/                   # expect: no output
grep -rn "firebase/" src/search.ts src/summary.ts src/extractPdf.ts   # expect: no output
grep -rn "drive.usercontent" src/                   # expect: no output
grep -rn "REPLACE_ME" src/firebase.ts               # expect: no output (real config pasted)
grep -n "const extractive" src/components/CombinedSummaryPanel.tsx   # expect: no output
grep -n "copied" src/components/CombinedSummaryPanel.tsx             # expect: no output
ls package-lock.json pnpm-lock.yaml 2>/dev/null        # expect: exactly one
npm run build                                          # expect: 0 errors
```

**On Windows PowerShell there is no `grep`.** Use Git Bash for that block, or
translate each line:

| Instead of | In PowerShell use |
|---|---|
| `grep -rn "foo" src/` | `Get-ChildItem src -Recurse -Include *.ts,*.tsx \| Select-String -Pattern 'foo'` |
| `grep -n "foo" file.tsx` | `Select-String -Path file.tsx -Pattern 'foo'` |
| `ls a b 2>/dev/null` | `Get-ChildItem a, b -ErrorAction SilentlyContinue \| Select-Object -ExpandProperty Name` |

A *"grep is not recognized"* message is a shell problem, **not** a failed check.
Read the exit behaviour before assuming the code is broken.

---

## Sign-off

| | |
|---|---|
| QA run by | |
| Date | |
| Deployed URL tested | |
| Result | ☐ Passed — ready to present |

**Before you present:** make sure `docs/` is inside the repo and pushed, and that
you can explain your own section in one minute plus the other two sections in one
sentence each.
