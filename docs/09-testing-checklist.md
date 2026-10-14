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
- [ ] Every Sign Out button first shows "Sign out?" with Cancel and Sign Out.
      Cancel, Escape and a click outside the box keep you signed in on the same
      screen; Sign Out goes to the login screen

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
- [ ] STAFF sees Dashboard / Register / Search / Statistics / Settings + their department badge
- [ ] Student default filter is "All Departments"; staff default is their department

## 3. Staff dashboard

- [ ] Stats count real data: Department Studies / Added this month / Added this year
- [ ] There is **no** "Pending review" card, bell, status filter or "Mark as
      Archived" button — the review step was removed (errata #50)
- [ ] Recent studies lists only the staff member's department, and the badge
      shows that department (not a hardcoded "CAS")
- [ ] Recent studies rows have **no** status badge (every study is posted;
      Search results have none either since errata #60)
- [ ] Rows are newest first — a just-saved study appears at the top at once
- [ ] Each Recent studies row shows, in this order: title; the author line
      (full names, at most 2, then "+N more", labelled "Author:" for one and
      "Authors:" for two or more, e.g. "Authors: Jan Rhyanne Acosta, Luigi
      Mindanao +1 more"); "Adviser: …"; department badge and academic year; up to 3 keyword
      chips; "Posted Oct 12, 2026". An older study with no authors has no author
      line (not "Not recorded"); a study with no keywords has no chip row
- [ ] Clicking a Recent studies row (or Tab + Enter on it) opens Search with
      **that** study's Study Details expanded and scrolled into view below the
      search bar, briefly flashed yellow, with no search text and "All
      departments"
- [ ] **Statistics tab:** one bar per department (zeros included), the bars add
      up to the total, and the staff member's own department says "(mine)"
- [ ] Clicking a bar opens Search filtered to that department; clicking a
      keyword searches it (in the department picked in the keyword box)
- [ ] Student dashboard: department chips show counts, and "E-Library at a
      glance" shows the same two cards
- [ ] Student dashboard "Recently added" cards show the same details as the
      staff Recent studies rows, in the same order: title, "Author: …" /
      "Authors: …" (at most 2, "+N more"), "Adviser: …", department badge + year, up to 3 keyword chips,
      "Posted Oct 12, 2026" — the same date as "Date Posted" in Study Details
      (which spells the month out: "October 12, 2026")
- [ ] **"View details"** opens Search at **that** study: its Study Details are
      already expanded and scrolled into view (not hidden under the search bar),
      the card flashes yellow, and the search box is empty — try it on the 3rd
      or 6th card, and on two studies whose titles start with the same words.
      The phone keyboard does not pop up
- [ ] After "View details", Back, then "View all" or a department chip: the
      list opens at the top with nothing expanded or flashing
- [ ] **Scroll position — every move starts at the top.** Scroll the dashboard
      down first each time, then: student — Search button, "View all", a
      department chip, a bar or keyword in "E-Library at a glance"; staff — the
      Search tab, "Search e-library", and each tab (Dashboard, Register,
      Statistics, Settings). Each opens at the **top** of the page. Back from
      Search (scrolled down) to either dashboard also opens at the top
- [ ] **…except opening a study:** with the dashboard scrolled down, "View
      details" / a staff row still lands on that study (Study Details open,
      just below the search bar), and on Search a summary citation still
      scrolls to its study
- [ ] On a phone (360 px wide): a long title stops after 3 lines, long author
      names and advisers after 2 lines, a long keyword chip ends with "…", and
      the cards still swipe sideways with no part of the page scrolling sideways
- [ ] An empty database shows an empty state, not a crash

## 4. Register thesis (PDF auto-fill)

- [ ] **[auto]** `grep -rn "MOCK_ABSTRACT\|Math.random" src/` returns nothing
- [ ] **[auto]** `grep -rn "drive.usercontent" src/` returns nothing — downloads go
      through the Drive API
- [ ] **[auto]** `node src/validation.check.ts` ends with "All passed."
- [ ] Clicking "Read PDF & continue" with an empty form shows a red message
      under **each** missing field (Drive link, Title, Authors, Department,
      Adviser) and puts the cursor in the first one. An adviser of only spaces
      counts as missing
- [ ] With a screen reader (or dev tools), a field with a message has
      `aria-invalid="true"` and `aria-describedby` pointing at that message
- [ ] No message appears while typing; a message appears on leaving a field
      with a bad value (e.g. Title `2024`), and clears as soon as it is fixed
- [ ] "Authors" is required: with no author, "Read PDF & continue" shows
      "Please add at least one author."
- [ ] Authors are added one at a time as chips, each chip can be removed, and
      adding the same name twice (any capitals) shows a grey "… is already in
      the list." and adds nothing
- [ ] Author `Dela Cruz` → "Type the author's full name, e.g. Juan Dela Cruz";
      `J. Dela Cruz` and `Dela Cruz, Juan` are added; `Juan 2` is refused
- [ ] Author `juan dela cruz` or `JUAN DELA CRUZ III` becomes `Juan Dela Cruz`
      / `Juan Dela Cruz III`; `Juan dela Cruz` stays as typed
- [ ] Adviser `Dr. Santos` → "Type the adviser's full name, e.g. Dr. Maria
      Santos"; `Asst. Prof. Maria Santos, PhD` is accepted; `Santos, Maria` →
      "After a comma, only a degree can follow: …"
- [ ] A name typed in the Authors box but not yet added still counts when you
      press "Read PDF & continue", after the same checks
- [ ] Choosing a file that is not a PDF shows "That file is not a PDF." at once
      and the file is not taken
- [ ] Academic Year is a text box (number keypad on a phone) that starts at
      this year; letters are ignored, pasting "Year 2019" gives "2019", and it
      takes at most 4 digits. `201` → "Please type a 4-digit year, e.g. 2019.";
      next year → "The year can't be later than …"; `1998` is saved as 1998
- [ ] Real text-based PDF → PROCESSING → DETAILS FILLED IN, on localhost **and**
      on the deployed URL (the Drive API key must allow both — `06` §0)
- [ ] A view-only study file (ISU → Viewer, download limited to Editors), no PDF
      chosen → NEEDS MANUAL ENTRY with
      "This file is protected, so it can't be read from Google Drive. Choose the
      PDF from this computer instead."
- [ ] The same study with its PDF chosen from this computer → DETAILS FILLED IN
      with the abstract and keywords; the Drive link is still saved
- [ ] The form shows "Choose PDF from this computer" first; the Drive link hint
      says to share it as Isabela State University → Viewer with download
      limited to Editors
- [ ] An abstract containing the word "background" mid-text is not cut short
- [ ] Abstract and keywords come from the actual PDF
- [ ] **Keyword chips contain only keywords** — no page 2–4 text bleeding in
- [ ] A PDF using `KEY WORDS:` with a space parses correctly
- [ ] Staff can edit the abstract and add/remove keyword chips
- [ ] Keywords: `rice, soil` adds two chips; `2024` → "A keyword must contain
      a word, not only numbers or symbols."; Add is disabled at 10 keywords
- [ ] A keyword typed but not added is saved with the study
- [ ] An abstract under 50 words → "The abstract looks too short (N words). …"
      on leaving the box and on save; nothing is saved
- [ ] "Confirm & Save" → "Study posted!" toast → document with `status: "POSTED"`
      → top of the list
- [ ] Scanned/image-only PDF → NEEDS MANUAL ENTRY → "Save Manually" with an
      **empty** abstract shows "Please fill in: Abstract" and saves nothing
- [ ] After typing the abstract, "Save Manually" writes `status: "POSTED"`
- [ ] Garbage link → specific error message, no crash
- [ ] Non-Drive URL is rejected before any download starts

## 5. Search (both roles)

- [ ] **[auto]** `grep -rn "firebase/" src/search.ts src/summary.ts src/extractPdf.ts`
      returns nothing — the pure modules must not import Firebase
- [ ] `Bio` surfaces **Biodiversity**, ~300ms after typing stops
- [ ] `diver` also surfaces it
- [ ] A single-character query does not search
- [ ] A query of only symbols (`!!!`) shows all studies, with no error; on the
      student dashboard, Search does nothing
- [ ] Neither search box takes more than 100 characters
- [ ] Empty query → all theses, newest first
- [ ] "Relevance: XX%" shows, and the top result shows the highest percentage
      (it is capped just under 100% by design — that is intentional)
- [ ] Department / Year combine with the query and each other
- [ ] Active filters show as removable chips; "Clear filters" resets everything
- [ ] Nobody sees a Status filter (removed 2026-10-12)
- [ ] Results change as you type, and stop updating once you pause
- [ ] Each result card shows, in this order: rank number and title (relevance %
      on the right while searching); "Author: <name>" or "Authors: <names>" (full
      names, at most 2, then "+N more"); department badge, year and "Adviser: <name>"; while searching, one
      abstract snippet; up to 4 keyword chips. There is **no** green "Posted"
      chip (every study is posted)
- [ ] A study with one author reads "Author: …"; two or more read "Authors: …"
      — here, on the student "Recently added" cards and on the staff "Recent
      studies" rows alike, matching the Author/Authors row in Study Details
- [ ] An older study saved without authors has **no** author line (not an empty
      gap, not "Author:" alone, not "Not recorded")
- [ ] Search `flood` (any word in an abstract): each result shows **one** short
      line from its abstract, the sentence with the most query words, with
      those words highlighted in ISU yellow — the same highlight as the combined
      summary. A long sentence is cut with "…" at the cut end(s), never mid-word
- [ ] Search `learn`: results whose abstract says "learning" show a snippet,
      with the whole word **learning** highlighted — the same results and
      snippets as searching `learning`. `Bio` highlights all of "Biodiversity"
- [ ] Search `a flood`: "flood" is highlighted, the word "a" is **not** (in
      the snippets and in the combined summary)
- [ ] A result found only through its title or keywords (no query word in the
      abstract) shows **no** snippet
- [ ] Empty search box (newest-first list) → **no** snippets anywhere
- [ ] **[auto]** `node src/snippet.check.ts` ends with "All passed."
- [ ] **[auto]** `node src/search.check.ts` ends with "All passed." (field
      weights, authors/adviser, year, ñ, the must-survive rules, and the
      combined summary unchanged — `05` §3a)
- [ ] Search an author's surname (e.g. `Acosta`): their study is found, and the
      surname is highlighted in the "Author(s):" line. The label "Authors" and
      "+N more" are never highlighted (try `auth` or `more`)
- [ ] Search an adviser's surname (e.g. `Stone`): their studies are found, with
      the surname highlighted after "Adviser:". `Dr. Stone` puts Stone's studies
      first (others that only match "dr" in the abstract come far below)
- [ ] Search `PhD` or `Engr`: studies are **not** found just because the
      adviser has that title or degree
- [ ] Search a year, e.g. `2024`: every study whose Academic Year is 2024 is
      listed, even if no text says "2024". `202` does **not** list them by year
- [ ] Search a word that is in one study's **title** and only in another
      study's abstract: the title one ranks higher
- [ ] Search `niño` (or a word with é/á): it finds studies containing that whole
      word, and it is highlighted whole. It no longer finds studies through
      "ni…" words
- [ ] Search `Dr. Stone`: on Stone's studies only **Stone** is highlighted; on
      Dr. Santos's (or any other) study, "Dr" is **not** highlighted after
      "Adviser:". Same for `Engr`, `Prof`, `PhD`, `MSc` … — titles and degrees
      are never highlighted in the author or adviser lines (they may still be in
      the abstract snippet, where they are ordinary words)
- [ ] Empty search box: author and adviser lines show with **no** highlight
- [ ] Tick 2–3 results after searching an author's name and open the combined
      summary: it quotes the same sentences as before this change (the name
      does not make every sentence "match")
- [ ] **360px phone width:** a study with 3+ long author names, a long adviser
      name (e.g. "Dr. Maria Concepcion Santos-Villanueva, PhD") and a long
      snippet wraps inside its card — no sideways scrolling, nothing cut off at
      the right edge
- [ ] The checkbox, the Study Details panel (tap the title), citation-chip and
      "View details" jumps (scroll + yellow flash) work exactly as before

## 6. Abstract preview

- [ ] Clicking (or tapping) a result title expands the full abstract under it
- [ ] Above the abstract, "Study Details" shows, in this order: **Citation**,
      Authors, Adviser, Department, Date Posted and Keywords
- [ ] The first row, **Citation**, is in APA 7 format, e.g. `Acosta, J. R., &
      Mindanao, L. (2026). *Title* [Unpublished research study]. Isabela State
      University – Echague Campus.` — title in italics and exactly as typed, year =
      Academic Year, wrapped lines indented (hanging indent)
- [ ] There is **no Academic Year row** (the year is in the citation); Authors
      still shows the full names
- [ ] Multi-word surnames and suffixes: a study by "Juan Dela Cruz" and
      "Jose Rizal Jr." reads `Dela Cruz, J., & Rizal, J., Jr. (…)`
- [ ] An older study saved without authors shows "Not recorded" for Citation and
      for Authors, and **does** show the Academic Year row, after Department
- [ ] **[auto]** `node src/citation.check.ts` ends with "All passed."
- [ ] **Staff:** the preview shows "Open in Drive" (green outline)
- [ ] **Staff:** "Open in Drive" opens in a new tab
- [ ] **Student:** the preview shows **"Read full study"** (no "Open in Drive")
      and the muted line "View only: download and printing are turned off."
- [ ] **Student:** "Read full study" opens the PDF in Google's viewer in a new
      tab, with **no Download / Print** buttons (test as a student or in an
      Incognito window — the owner always sees Download)
- [ ] A **non-ISU** Google account (or signed out) opening the link is asked to
      sign in or request access
- [ ] **Two Google accounts in one browser** (a personal Gmail signed in first,
      the ISU account second; sign in to the e-library with the ISU one):
      "Read full study" opens with the **e-library account** (check the avatar
      in Drive's top-right corner) — no "You need access", no Download / Print.
      The link in the new tab contains `authuser=`; staff "Open in Drive" does too
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
- [ ] Each sentence ends with an APA in-text citation before its period:
      `(Acosta, 2026)`, `(Acosta & Mindanao, 2026)`, and `(Acosta et al., 2026)`
      for a study with 3+ authors — no `[n]` numbers anywhere in the panel
- [ ] Tapping a citation closes the panel and scrolls to that study
- [ ] "References" lists every ticked study as a full APA 7 reference,
      alphabetical by first author
- [ ] Query words are highlighted in ISU yellow — the whole word that starts
      with one (`learn` marks "learning"); one-letter words like "a" are not
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
grep -rn "firebase/" src/search.ts src/summary.ts src/extractPdf.ts src/validation.ts   # expect: no output
node src/validation.check.ts                           # expect: All passed.
node src/citation.check.ts                             # expect: All passed.
node src/snippet.check.ts                              # expect: All passed.
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
