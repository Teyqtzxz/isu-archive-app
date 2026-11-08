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
- [ ] Sign Out on mobile is the icon-only header button (tooltip and screen
      reader: "Sign out"); the avatar menu shows account info only (errata #70)
- [ ] **Profile cannot be loaded → student view, said out loud (errata #67).**
      Writes nothing. Sign in as staff, open DevTools → Network → **Offline**,
      then refresh. The student dashboard opens (never the staff one) with the
      **error** toast (red "!", × "Close message", stays 8 s) "Couldn't load
      your profile, so you're seeing the student view. Check your connection
      and sign in again.", the header shows your name
      (not blank) and the console has `[auth] could not read the user profile`.
      Switch back to **No throttling**: the studies load; on Search, "Read full
      study" opens a URL ending in `authuser=<your ISU email>`. Refresh → staff
      dashboard again
- [ ] Every Sign Out button first shows "Sign out?" with Cancel and Sign Out.
      Cancel, Escape and a click outside the box keep you signed in on the same
      screen; Sign Out goes to the login screen
- [ ] **Slow connection message (errata #73).** Writes nothing. A normal sign-in
      never shows it. Then in DevTools → Network add a custom throttling profile
      with a latency of 60000 ms (not **Offline**: Firebase then fails within
      5 s and shows "No connection"). Sign in, or refresh while signed in:
      after 15 s "This is taking longer than usual. Check your internet
      connection." appears, on the login card or under the seal. **Try again**
      reloads the page. Back to **No throttling** and it goes away when the wait
      ends; the sign-in itself is not cancelled
- [ ] Press Continue with Google and leave the popup open for 20 s: no message.
      Close it: no message
- [ ] A wrong password shows only "Email or password is incorrect."; wait 20 s:
      no message follows it

### 1b. Email + password login (`17`, errata #68)

Do `17` §6 steps 1–3 in the console first. Use a **new test ISU account**
made for this (e.g. a spare `@isu.edu.ph` address you can open the inbox of)
— never the owner's or a staff member's real account. Afterwards, the test
account can be deleted in the console (Authentication → Users, and its
`users/{uid}` document) by the owner.

- [ ] **[auto]** `node src/auth.check.ts` ends with "All passed."
- [ ] Login card: ISU username · Password with an eye button ·
      **Sign in** · "Forgot password?" and "Create account" · "or" ·
      **Continue with Google**. Light and dark both readable
- [ ] Every password box has its own eye: Sign in (1), Create account (2:
      Password and Confirm, each toggles only itself), new-password screen (2)
- [ ] Sign in with an empty form → "Please fill in your ISU email." and
      "Please type your password." under their own boxes. `juan@gmail.com` →
      "Use your ISU email address (@isu.edu.ph)." on leaving the box
- [ ] Wrong password for the test account → "Email or password is
      incorrect." A made-up `nobody.x@isu.edu.ph` → **the same words**
- [ ] **Create account** with the test account: `abcd1234` → "The password
      must have at least 8 characters, an uppercase letter, a lowercase
      letter, a number and a symbol." on leaving the box; Confirm different →
      "The passwords don't match." under Confirm, and **nothing is created**
      (Authentication → Users has no new row). The hint "Not your Gmail
      password." is under the box
- [ ] Create account and Create a new password show the **same live checklist**:
      At least 8 characters · An uppercase letter · A lowercase letter · A
      number · A symbol · Passwords match. Each line ticks as you type. A space
      ticks no symbol; an emoji ticks A symbol and counts as one character
- [ ] An **older password** that breaks the new rules still signs in (the rules
      are for new passwords only)
- [ ] Full name `maria` → "Type your full name, e.g. Juan Dela Cruz"
- [ ] Correct form → "Check your ISU inbox" with the address. **I've
      verified** before clicking the link → "Not verified yet. Open the link
      in your ISU inbox first." under the button. No dashboard, no data banner
- [ ] Double-click Create account / Send reset link / Resend: one email
      arrives, not two (buttons go grey while a request runs)
- [ ] "Didn't get it?" appears nowhere: not on Forgot password ② and not on
      Check your ISU inbox. The round badge and the short notice after Resend
      are still there
- [ ] Open the email (check Spam), click the link, come back, **I've
      verified** → student dashboard **without signing in again**, greeted by
      the full name. Console: Authentication → Users shows the account;
      Firestore `users/{uid}` has `role: "STUDENT"`
- [ ] Refresh → still signed in. Sign out → sign in with username only
      (`test.account`) + password → same dashboard
- [ ] Create account again with the same email → "This ISU email already has
      an account. Sign in, or use Forgot password? to set a password." under
      the ISU username box
- [ ] **Forgot password** → ① ISU username → ② "If an account exists for t•••@…"
      → email arrives → link (on localhost: Firebase's page; deployed:
      "Create a new password") → set a new one → old password fails, new
      one works. A made-up email shows the same step ② (no email arrives)
- [ ] Open an **older** reset link after a newer one was sent → "This link no
      longer works" → Send a new link opens Forgot password
- [ ] Five or more wrong passwords in a row → eventually "Too many attempts.
      Wait a few minutes and try again, or use Forgot password?"
- [ ] **Case A — Google first, then a password** (a test account that has
      only used Google): Forgot password → set a password → password sign-in
      and Continue with Google reach the **same** dashboard; the console
      shows **one** user row with both providers
- [ ] **Case B — password first, then Google** (the test account from
      Create account): sign out → **Continue with Google** with the same ISU
      address. Record in `17` §3 which happened:
      **B1** the dashboard opens and the old password now says "Email or
      password is incorrect." (Google replaced it; Forgot password? adds it
      back), or **B2** the notice "… already has an e-library password. Sign
      in with it once below to connect Google…" with a **Forgot password?**
      link (pre-fills the email) → sign in with the password → dashboard; then
      sign out and Continue with Google → straight in. Either way:
      **one** user row, one User UID, same role
- [ ] **Case C** — Create account with an address that has only used Google
      → the "already has an account" message; no second user row
- [ ] A STAFF test account signed in with a password gets the Staff Dashboard
      (promotion stays a console step, `03` §8)
- [ ] DevTools → Application → Local/Session Storage and Console: **no
      password** anywhere (only error codes such as `auth/invalid-credential`)

## 2. Roles and security

Run all seven rows below in the Firestore **Rules Playground**. The
`role: "STAFF"` row (a student promoting themselves) is the one that matters
most.

- [ ] Student writes to `theses` → **denied**
- [ ] Staff writes to `theses` → **allowed**
- [ ] Student **deletes** `theses/{id}` (Playground: delete, authenticated as a
      student's uid with an `@isu.edu.ph` email) → **denied**; the same as a
      staff uid → **allowed**
- [ ] Student **updates** `theses/{id}` → **denied** (edit/delete are staff-only
      in `firestore.rules`: `allow create, update, delete: if isStaff()`)
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
- [ ] **[auto]** `node src/stats.check.ts` ends with "All passed." "Added this
      month / this year" count in the viewer's **local** time, not UTC: a study
      posted 00:00–07:59 on the 1st (Philippine time) counts in the new month,
      and on 1 January in the new year (errata #67)
- [ ] "Added this month" equals the number of Recent studies cards (and
      Search results, newest first) whose "Posted" date is in this month;
      "Added this year" likewise for this year
- [ ] There is **no** "Pending review" card, bell, status filter or "Mark as
      Archived" button — the review step was removed (errata #50)
- [ ] Recent studies lists only the staff member's department, and the badge
      shows that department (not a hardcoded "CAS")
- [ ] Recent studies cards have **no** status badge (every study is posted;
      Search results have none either since errata #60)
- [ ] Cards are newest first — a just-saved study appears as the first card at
      once
- [ ] Recent studies uses the same cards in the same grid as the student
      "Recently added" (`RecentStudyCard`, errata #75): at most 6, 3 across from
      1024 px with the 300 px side panel (Register study, Search e-library)
      beside them, 2 across from 640 px with the panel below, and on phones one
      row that swipes sideways, where the last card can be fully reached
- [ ] Each Recent studies card shows, in this order: title; the author line
      (full names, at most 2, then "+N more", labelled "Author:" for one and
      "Authors:" for two or more, e.g. "Authors: Jan Rhyanne Acosta, Luigi
      Mindanao +1 more"); "Adviser: …"; department badge and academic year; up to 3 keyword
      chips; "Posted Oct 12, 2026". An older study with no authors has no author
      line (not "Not recorded"); a study with no keywords has no chip row;
      **View details** at the bottom
- [ ] At 1024 px wide (the narrowest cards, about 204 px), on a study in
      Business Administration, the longest department name: the year drops
      below the badge, and neither leaves the card
- [ ] **View details** on the 1st, 3rd and 6th Recent studies card (or Tab +
      Enter on it) opens Search with
      **that** study's Study Details expanded and scrolled into view below the
      search bar, briefly flashed yellow, with no search text and "All
      departments"
- [ ] **"View all studies"** (heading row of Recent studies, or Tab + Enter on
      it) opens Search on "All Departments" with every study, newest first:
      more than 6, other departments too, with or without a department set
      for the staff member (errata #74). The "N total" beside it still counts
      only the staff member's own department, so the list can be longer
- [ ] Staff whose department has no studies, in a library that has some: the
      button shows and works, and "No … studies yet" still shows. An empty
      e-library: no button
- [ ] After "View all studies", Back, then the Search tab or "Search
      e-library": each opens on the staff member's **own** department, so "All
      Departments" does not stick
- [ ] At 320 px wide the heading row of Recent studies wraps: the title and
      "N total" stay on one line, "View all studies" drops to its own line,
      nothing is cut off and the page does not scroll sideways. The student
      dashboard headings do not change
- [ ] **Statistics tab:** one bar per department (zeros included), the bars add
      up to the total, and the staff member's own department says "(mine)"
- [ ] Clicking a bar opens Search filtered to that department; clicking a
      keyword searches it (in the department picked in the keyword box)
- [ ] **[auto]** `node src/stats.check.ts` also covers the library charts
      (errata #76): year gaps kept as 0, the newest 12 years plus one
      "Before <year>" row that still add up to the total, the last 12 months
      in **local** time (00:30 on the 1st in Manila is the new month; January
      reaches back into last year; a 31st never skips a month), no or bad
      dates skipped, advisers merged and ties A–Z
- [ ] **Library charts (staff Statistics only)**, between the department
      cards and the Keyword model card: **Studies by year**, **Added per
      month** and **Top advisers**. Each counts the **whole** e-library, also
      for staff with a department (compare with the department bars' "N total")
- [ ] **Studies by year:** one column per Academic Year from the oldest to the
      newest, a year with no study shows **0**; with a study older than 12
      years (e.g. 1975) the first column is **"Before <year>"** and the columns
      still add up to the total
- [ ] **Added per month:** the last 12 months, oldest first, this month last,
      zeros shown, the year under the first month and under January; the note
      says it is when the study was posted, not its Academic Year. A study
      posted at 00:30 on the 1st (Philippine time) counts in the new month
- [ ] **Top advisers:** at most 8, most studies first, ties A–Z. "Dr. Maria
      Santos", "maria santos" and "Maria Santos, PhD" are one bar (the
      spelling used most is shown; on a tie the neatly typed one, so "Dr.
      Stone" beats "dr stone" and "DR. STONE"); "Jose Santos" is a separate bar; a long
      name wraps, never cut off
- [ ] Every column and bar shows its number without hovering. Nothing in the
      charts is a button: no pointer, no hover colour, nothing happens on
      click, and Tab skips them. A screen reader reads each chart as a table
- [ ] Empty e-library: each chart says "No studies yet." (no empty axes).
      Studies but none posted in the last 12 months: "No study was added in
      the last 12 months."
- [ ] Save or delete a study: the three charts change without a reload
- [ ] 320 px: 12 (or 13) columns fit with short labels ("’26", "<’15") and
      nothing overlaps; 640–1023 px the two column charts sit side by side;
      1024 px and wider they are stacked on the left, Top advisers on the
      right. Light and dark. The student dashboard has none of them
- [ ] Student dashboard: department chips show counts, and "E-Library at a
      glance" shows the same two cards
- [ ] Student dashboard "Recently added" uses the same card as the staff
      Recent studies (`RecentStudyCard`), so the details and their order match:
      title, "Author: …" /
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
      Search tab, "Search e-library", "View all studies", and each tab
      (Dashboard, Register, Statistics, Settings). Each opens at the **top** of
      the page. Back from Search (scrolled down) to either dashboard also opens
      at the top
- [ ] **…except opening a study:** with the dashboard scrolled down, "View
      details" still lands on that study (Study Details open,
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
- [ ] **[auto]** `node src/pdfText.check.ts` ends with "All passed." (how far the
      PDF is read, contents lines, scanned PDFs — errata #78; the progress line —
      errata #82)
- [ ] **[auto]** `node src/pdfDetails.check.ts` ends with "All passed." (the
      details read from the PDF, never guessed, never overwriting — errata #82)
- [ ] **PDF first (errata #82).** Register step 1 shows only "Choose PDF from
      this computer" and the Google Drive link; there is **no** Title, Authors,
      Department, Year completed or Adviser box on it. The steps read "Choose
      PDF → Reading → Check & save"
- [ ] While reading, the panel shows one line that changes: "Downloading 3.1 of
      11.6 MB…" (Drive) and "Reading page 5 (up to 40)…"
- [ ] **ISU thesis** (labelled block under ABSTRACT: Title, Program, Authors,
      Academic Year, Adviser) → Check & save has the title and authors from the
      block, the department from the Program line, **Year completed from the
      title page date** ("December 2024" → 2024, never from "AY 2024-2025"),
      the adviser exactly as printed with its degree (e.g. "…, DIT"; "Dr." is
      never added). Each filled box has **FROM PDF** in its label; a screen
      reader says it with the label ("Title, required, from PDF"); typing in a
      box removes its tag. The abstract starts with its first sentence — no
      "Title :", "Authors :" or adviser line in it
- [ ] **UP Open University thesis** (title page: programme, author, title in
      capitals, "Thesis Adviser:", adviser, date) → the same five details; a
      title printed only in capitals stays in capitals with the grey note "The
      title is printed in capital letters…"; when the page's running header
      prints the same title in normal letters (identical letters), that one is
      used; degrees after the student's name ("…, RN") are dropped
- [ ] **Never guessed:** a programme that is not one of the ten departments
      (e.g. "Master of Development Communication") leaves Department on
      "Select dept."; only "AY 2024-2025" printed leaves Year completed empty
      with the grey note naming the academic year; "Thesis Advisers:" with two
      names leaves Adviser empty with a note listing both
- [ ] A value read from the PDF that breaks a rule shows the normal message at
      once (e.g. an adviser "…, DVM" → "After a comma, only Jr., Sr., II, III or
      a degree can follow: …")
- [ ] **Never overwritten:** read a PDF, change the title, "← Change PDF",
      choose another PDF, "Read PDF & continue" → your title stays, with "The
      PDF shows a different title: “…”. Yours is kept."; the details still
      tagged FROM PDF take the new PDF's values (or go empty when it has none)
- [ ] A scanned PDF → NEEDS MANUAL ENTRY with every detail empty and nothing
      tagged; staff type everything, as before
- [ ] **Abstract past page 15** (errata #78): choose a thesis whose abstract
      starts after page 15 (e.g. a UP Open University thesis with front matter
      to page xvii, abstract on page 17) → while reading, the panel says
      "Reading page 17 (up to 40)…" → DETAILS FILLED IN with that abstract, not
      "Could not find an abstract or keywords in that PDF." Same with its Drive
      link (no PDF chosen)
- [ ] A thesis whose contents page lists "ABSTRACT x i" (xi printed with a
      space) → the abstract box holds the real abstract, not the contents page
- [ ] The abstract ends on its last sentence: no study title, page number or
      "Page 8" after it (e.g. a thesis whose page header is "Short Title   xiii")
- [ ] A keyword list printed over two lines gives every keyword, whole (e.g.
      "Theory of Reasoned" / "Action, …" → "Theory of Reasoned Action"), and the
      study title or "Chapter I" under the list is not a keyword;
      "self - efficacy" shows as "self-efficacy"
- [ ] A long thesis (2,000+ pages) with the abstract near page 12 fills in as
      fast as a short one; a thesis with no abstract at all still shows
      "Could not find an abstract or keywords in that PDF. Please type or paste
      the abstract."
- [ ] Clicking "Read PDF & continue" with no Drive link shows "Please paste the
      Google Drive link of the study PDF." (with a PDF chosen: "Paste the
      study's Google Drive link too. …") and the cursor goes there
- [ ] On Check & save, "Confirm & Save" / "Save Manually" with a detail missing
      shows a red message under **each** missing field (Title, Authors,
      Department, Year completed, Adviser, Abstract) and puts the cursor in the
      first one; nothing is saved. An adviser of only spaces counts as missing
- [ ] With a screen reader (or dev tools), a field with a message has
      `aria-invalid="true"` and `aria-describedby` pointing at that message
- [ ] No message appears while typing; a message appears on leaving a field
      with a bad value (e.g. Title `2024`), and clears as soon as it is fixed
- [ ] "Authors" is required: with no author, Save shows "Please add at least
      one author."
- [ ] Authors are added one at a time as chips, each chip can be removed, and
      adding the same name twice (any capitals) shows a grey "… is already in
      the list." and adds nothing
- [ ] Author `Dela Cruz` → "Type the author's full name, e.g. Juan Dela Cruz";
      `J. Dela Cruz` and `Dela Cruz, Juan` are added; `Juan 2` is refused
- [ ] Author `juan dela cruz` or `JUAN DELA CRUZ III` becomes `Juan Dela Cruz`
      / `Juan Dela Cruz III`; `Juan dela Cruz` stays as typed
- [ ] Adviser `Dr. Santos` → "Type the adviser's full name, e.g. Dr. Maria
      Santos"; `Asst. Prof. Maria Santos, PhD` is accepted; `Santos, Maria` →
      "After a comma, only Jr., Sr., II, III or a degree can follow: …";
      `Rosa B. Alcantara, DIT`, `…, MAN, RN`, `…, Ph. D.` (saved as PhD) and
      `Roberto Figueroa, Jr.` are accepted (errata #82)
- [ ] A name typed in the Authors box but not yet added still counts when you
      press Save, after the same checks
- [ ] Choosing a file that is not a PDF shows "That file is not a PDF." at once
      and the file is not taken
- [ ] **Year completed** (the label on Register and Edit since errata #82; the
      stored field is still `year`) is a text box (number keypad on a phone)
      that starts **empty** on a new study; letters are ignored, pasting "Year 2019" gives "2019", and it
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
- [ ] Staff can edit the abstract and **remove** keywords with × (errata #80):
      there is **no** "Add a keyword" box, no "+ Add" and no "Suggested
      keywords" box, on Register or on Edit study (details in §4d)
- [ ] An abstract under 50 words → "The abstract looks too short (N words). …"
      on leaving the box and on save; nothing is saved
- [ ] "Confirm & Save" → "Study posted!" toast (green tick, gone after 3 s)
      → document with `status: "POSTED"` → top of the list
- [ ] Scanned/image-only PDF → NEEDS MANUAL ENTRY → "Save Manually" with an
      **empty** abstract shows "Please fill in: Abstract" and saves nothing
- [ ] After typing the abstract, "Save Manually" writes `status: "POSTED"`
- [ ] **A click not aimed at Save posts nothing** (errata #72). In a short
      window (a laptop, 4 authors, a PDF with no keywords line), scroll to the
      bottom, click "Read PDF & continue" and leave the mouse there → the save
      step opens **at the top of the page**, with no visible scrolling, and
      "Confirm & Save" is not under the mouse. Click again without moving the
      mouse → nothing is posted
- [ ] The save step also opens at the top after a failed read ("Save
      Manually"), after Edit study → "Continue", after "Change PDF" → "Read
      PDF & continue" with the same PDF, and when a draft reopens on it after a
      reload
- [ ] Zoom the browser out until the whole save step fits in the window. Click
      Save within a second of the step opening → nothing happens and no message
      appears. Click it again after that second → the study is posted, once
- [ ] On a 1080p screen in full screen (F11), click "Read PDF & continue" and
      keep the mouse still. Wait 2 seconds and click twice → nothing is posted
- [ ] After the read, wheel to the end of the page with the mouse still → the
      mouse is not over Save. Move to Save and click → it posts on the first
      click
- [ ] **× and Undo follow the same 1-second guard** (errata #77, #80). Double-
      and triple-click "Read PDF & continue" with the mouse still → no keyword
      is added or removed and nothing is posted (0 of 24 runs at 1366×641,
      1366×768, 1366×800, 1920×947, 1920×1080 and a 390×844 phone)
- [ ] **Known limit, accepted (errata #80; it replaces the #77 one):** a
      single stray click or tap on the same spot **after** the first second.
      Measured in 48 such clicks or taps (at 1.2 s and 2 s, the 6 sizes above,
      4 authors with no printed keywords and 1 author with 4): **0 added** a
      keyword (before #80, with the suggestion chips: 10 of 48) and **2
      removed one**, both on the **390×844 phone** (1 author, 4 printed
      keywords), a stray **tap about 1.2 s after the step opened**, which
      Chrome moved from the gap in the keyword row onto the × of "Irrigation
      scheduling". **"Removed Irrigation scheduling. Undo"** was shown each
      time; 0 removed on desktop sizes; none posted the study. No further
      guard is used. Check: on a phone, tap "Read PDF & continue", wait about
      1 second and tap again on the same spot → at most one keyword is
      removed, the Undo line shows it, and Undo puts it back; nothing is
      posted
- [ ] Garbage link → specific error message, no crash
- [ ] Non-Drive URL is rejected before any download starts

## 4b. Edit and delete a study (staff)

- [ ] **Staff:** Study Details (Search → tap a title) shows **Edit** and
      **Delete** (red outline) next to "Open in Drive"; on a 360 px phone the
      three buttons wrap, nothing sticks out of the card
- [ ] **Student:** Study Details shows only "Read full study" and the
      view-only line — **no Edit, no Delete** (check on the student dashboard's
      "View details" too)
- [ ] **Edit** opens "Edit study" (heading and step 1) with the Drive link
      filled in; the PDF box says "(optional)" and the button says
      **"Continue"**. Check & save then shows every field filled in: title,
      authors (chips), department, Year completed, adviser
- [ ] **Edit without a PDF:** change the title → "Continue" goes straight to
      the save step (no "Reading PDF…", no Drive download — check the Network
      tab: no `googleapis.com/drive` request) with "Ready to save: Current
      abstract and keywords kept"; the abstract and keywords are the study's
- [ ] **Save changes** → toast **"Study updated"** (green tick, 3 s) → the search screen opens at
      that study with its Study Details expanded and the new title; the
      dashboards and Statistics show the change without a reload
- [ ] In the Firestore console the document has `updatedAt` (a timestamp) and
      `updatedBy` (your uid); `registeredAt`, `registeredBy` and `status` are
      unchanged, and the study keeps its place in the newest-first list
- [ ] **Edit with a PDF:** choose a PDF → the button says "Read PDF & continue"
      → PROCESSING → "Details filled in:" with the abstract read from that
      PDF; the study's title, department, year and adviser are **never
      replaced** (a grey note shows what the PDF prints instead), only an
      empty detail (e.g. no authors on an old record) is filled and tagged
      FROM PDF (errata #82); its printed keywords replace the saved ones **only if it prints
      some** — a PDF with no keywords line keeps the saved keywords (errata
      #80); nothing is added automatically; Save changes keeps them
- [ ] A PDF that cannot be read (scanned) in Edit → "Could not read the PDF."
      and the study's current abstract and keywords are **kept**, not blanked
- [ ] **Validation on edit:** clear the title → Save changes shows "Please
      fill in the title." under it; Year completed `201` → "Please type a 4-digit
      year, e.g. 2019."; adviser `Dr. Santos` → the adviser message; an
      abstract cut to under 50 words → "The abstract looks too short…" on Save
      changes; nothing is saved while a message shows
- [ ] A study saved before the name checks with an author like `Dela Cruz`:
      Save changes shows "Fix “Dela Cruz”: remove it and add it again. …"; remove
      the chip, add `Juan Dela Cruz`, and it saves
- [ ] Values are cleaned on loading: a title saved with double spaces or an
      author saved as `juan dela cruz` shows as `Juan Dela Cruz` in the form
- [ ] **Cancel** (step 1) and **Change PDF → Cancel** return to the search
      screen at that study with **nothing** changed; clicking a staff tab while
      editing also leaves without saving
- [ ] **Delete** → a dialog: "Delete this study?", the study's title in bold,
      "This removes it from the e-library for everyone and cannot be undone.
      The PDF stays in Google Drive.", **Cancel** (focused — Enter cancels) and
      **Delete** (red)
- [ ] **Cancel**, **Escape** and a click on the dark backdrop each close the
      dialog and the study is still there
- [ ] **Delete** → toast **"Study deleted"** (green tick, 3 s); the study disappears from the
      search results, the staff "Recent studies", the student "Recently added"
      (open a student window side by side: it goes there too without a
      reload), the dashboard counts and the Statistics bars/keywords
- [ ] The PDF is still in Google Drive after the delete
- [ ] Sign out still asks "Sign out?" exactly as before (same dialog component)
- [ ] A refused write shows a clear message, never a blank page: open a study
      as staff, then in the Firebase console change your `users/{uid}` role to
      `STUDENT` (do not reload). **Delete** → **error** toast (red "!", ×,
      8 s) "You do not have permission to delete the study. Only Research
      Department staff can edit or delete studies." and the study stays;
      **Edit → Save changes** → the same kind of
      message in the red box, the form stays open. Set the role back to `STAFF`
      afterwards. (Offline is not a failure: Firestore queues the write and
      sends it when the connection returns.)
- [ ] **Toast kinds (errata #81).** Success (green tick) goes after 3 s;
      notice (amber "!", something was dropped) after 6 s; error (red "!",
      with × "Close message") after 8 s. Keep the mouse on a toast, or Tab to
      the × of an error: it stays; move away and it waits its full time again.
      A tap on a phone does not hold it. × closes an error at once. A screen
      reader reads errors at once (`role="alert"`), the others politely
      (`role="status"`). "Sign-out failed. Try again." is an error too

## 4c. Similarity — originality check and similar studies (`14`)

- [ ] **[auto]** `node src/similarity.check.ts` ends with "All passed."
      (identical ≈ 100%, unrelated 0%, partial in between, case/punctuation
      ignored, empty abstract safe, never matches itself, shared terms)
- [ ] **Register a copy:** Register → type a new title, an author, department,
      adviser and a Drive link → Read PDF & continue (Drive refuses → manual
      entry) → paste the abstract of an existing study. A red **"Possible
      duplicate — this study may already be registered"** box lists that study
      (title, year, **"Abstract 100% similar"**, "Shared key terms") — also
      with **no keywords** added and **Save Manually is greyed out**
      with "Tick “I checked — register anyway” above to save."
- [ ] Tick **"I checked — register anyway"** → the save button works. Untick
      → greyed out again. (Cancel without saving if this is only a test.)
- [ ] **Show details** opens the match's authors, adviser, department,
      keywords and abstract **inside the box**; **Hide details** closes it; the
      form keeps everything typed. **Open in Drive** opens the PDF in a new
      tab with `authuser=` in the link
- [ ] Change the abstract to something unrelated → the warning disappears and
      the button is enabled without ticking; at most **3** matches ever show
- [ ] A partial copy (half the abstract, or the same title and keywords with
      another abstract) shows the yellow **"Very similar study found"** box, no
      checkbox; a 30–49% match shows the green **"Related studies"** box
- [ ] **Edit study:** Edit a study that has a copy → Continue → the copy is
      listed, the study itself **never** is. A study with no copy shows no box
- [ ] **Study Details (staff and student):** a study with copies shows
      **"Similar studies"** under the abstract — at most 3, each with title,
      year, "% similar" and "Shared key terms"; a study with nothing ≥ 15%
      (e.g. my.Eskwela) shows **no** section
- [ ] Tap a similar study → its Study Details opens, scrolls into view and
      flashes. With a search word or department filter that hides it, the
      search box and filters are cleared first so it can be shown
- [ ] Dark mode: the three boxes, the chips and the links are readable in
      Light and Dark; `grep -nE "#[0-9a-fA-F]{3,6}" src/App.css src/components/*.tsx`
      prints nothing
- [ ] Search results, ranking and relevance % are exactly as before

## 4d. Keyword model — automatic keywords, × and Undo, accuracy card (`15`)

- [ ] **[auto]** `node src/keywordModel.check.ts` ends with "All passed."
      (label normalisation, learned vs extracted, the P ≥ 0.9 + 5-evidence
      guard, each word once per study, near-copies counted once, the
      30-study rule, at most 3 learned of 6, the automatic count and fill-up
      order (errata #79), removed keywords, junk phrases (also a vague word at
      the end), three-word terms, no duplicates, validation
      rules, Edit exclusion, no leakage in leave-one-out, empty library, Undo
      putting a keyword back in its place (errata #80))
- [ ] **[auto]** `node src/pdfText.check.ts`: a "Keywords:" line in a typed
      abstract is moved out and read like a PDF's (errata #80);
      `node src/draft.check.ts`: a draft with text in the old keyword box still
      loads, that text dropped
- [ ] **[auto]** `node src/similarity.check.ts`: `possibleDuplicates` gives the
      same lists as comparing every pair (errata #77)
- [ ] **Register, new study (errata #77):** fill in a study → Read PDF &
      continue → keywords are **added automatically**, once: the PDF's own
      keywords first, then up to **5** more, never past **8** in all (0
      printed → 5 added, 3 → 5, 4 → 4, 7 → 1, 8 or more → 0). Each added one
      has a small **AUTO** tag and a dashed edge, and a note says "Keywords
      marked auto were chosen automatically. Remove any that do not fit."
- [ ] **No manual way to add (errata #80):** no "Add a keyword" box, no
      "+ Add", no "Suggested keywords" box, on Register and on Edit study
- [ ] Remove an auto keyword with its × (after the first second) → it is
      gone, **"Removed *keyword*. Undo"** shows under the list, and it is
      **never added again by itself**: not after editing the abstract, not
      after "Change PDF" → Read PDF & continue with the same PDF, not after
      a reload (the draft keeps the tags and the removed list), not after
      reading another PDF
- [ ] **Undo** → the keyword is back **in the same place**, with its AUTO tag
      if it had one; the line goes. A second × replaces the line (only the
      latest can be undone). Without Undo the line goes after **8 seconds**;
      with the mouse on it, or keyboard focus on Undo, it stays, and goes
      8 seconds after leaving
- [ ] **Double-click on ×** → only that keyword goes (the next one slides
      under the mouse; × ignores clicks for 0.5 s after a removal or Undo); a
      normal second click after that removes the next one
- [ ] **Edit study** removes only: the saved keywords each have ×, Undo
      works, nothing is ever added (not from a typed abstract, not from a
      pasted Keywords line, which stays in the abstract)
- [ ] **A failed read ("Save Manually"), or a read with no abstract**
      (2022 CLARO-AZUCENA): the line under Keywords says "No keywords yet.
      They are added automatically from the abstract when you leave the
      abstract box (50 words or more)." Type under 50 words and leave the box
      → nothing; type or paste the full abstract and leave the box (click
      elsewhere or Tab) → keywords are added **once** with AUTO tags, by the
      same rules (keywords the read found first, up to 5, never past 8,
      learned ones from 30 studies). Change the abstract and leave again →
      nothing added or removed; F5 → nothing added a second time
- [ ] **Typed abstract, then straight to Save:** type the abstract and press
      Save at once → not posted; keywords appear and **"Keywords were added.
      Check them, then click Save."** shows under Save; press Save again →
      posted once with those keywords. Same with Tab to Save and Enter
- [ ] **Pasted "Keywords:" line:** paste an abstract ending with
      "Keywords: drip irrigation; hybrid corn, and Isabela farms." and leave
      the box → that line leaves the abstract, the three are listed first
      without AUTO, then the automatic ones. Remove one, paste the line again
      → it is not added back
- [ ] The e-library still loading → nothing is added until it arrives, then
      once; the e-library failing to load → the abstract phrases are added
      once
- [ ] **Learned keywords only from 30 studies with keywords** (near-copies
      counted once): below that only abstract phrases are added; from 30 a
      learned one can be added (headless Chrome, typed abstract: 29 studies →
      no "aquaculture", 30 → "aquaculture" first)
- [ ] Junk phrases are not added: "Nurses should", "participants
      reported", "providing quality", "documents internally", "specific
      plastic", "case suite" (`docs/15` §3). "perceived behavioral control"
      comes as one keyword, not two halves
- [ ] **Review round 2:** terms with a verb form survive — "monitoring
      system", "real-time monitoring", "automated attendance system",
      "reduced tillage", "improved varieties"; a three-word term seen only
      once is not added ("measure water temperature" gives "water
      temperature"; "system sends SMS", "helps fish farmers" never appear);
      "water quality monitoring system" gives "water quality" and "monitoring
      system"
- [ ] No two automatic keywords overlap: with "nurse-patient interaction"
      added, "patient interaction" is not; nothing inside a printed keyword is
      added (printed "Marine Plastic Pollution" → no "plastic pollution");
      never both "quality care" and "care quality"
- [ ] **Errata #79 (fill the room):** the phrases that appear at least twice
      in the title plus abstract ("fish farmer" and "fish farmers" count
      together) are added first, then the room is filled with the next
      suggestions in their usual order, so a study with no printed keywords
      gets **5** unless its abstract has fewer phrases. An abstract with no
      repeated phrase still gets its once-seen phrases. Learned keywords (30+
      studies) are not counted
- [ ] No added phrase ends in a vague word ("producing various", "…
      several", "… specific")
- [ ] **[auto]** the 14 made-up capstone abstracts in `keywordModel.check.ts`
      give all their must-have terms and none of their junk; 5 automatic
      keywords each, those seen twice before any seen once, no overlap
- [ ] An abstract about a topic no stored study has → phrases only, no
      learned keyword
- [ ] Keyboard: Tab reaches each ×; a screen reader reads "Remove keyword …,
      added automatically" on an auto keyword; Enter removes it and focus
      moves to the × now in its place (to **Undo** when the list is empty);
      the Undo line is read out ("Removed …. Undo", a polite live region);
      Enter on Undo puts it back and focuses its ×. Leaving the abstract box
      with a typed abstract is read out ("5 keywords were added from the
      abstract: …")
- [ ] **Statistics tab (staff):** a **"Keyword model"** card under the
      library charts: training studies, known keywords, "Testing the
      model…" then "*N* studies tested, *M* copies hidden", Model vs
      Baseline for the three measures, and **"Fewer than 30 studies with
      keywords — not reliable yet."** while under 30. With near-copies it says
      "*M* near-copies counted with their originals". The test still measures
      the learned model below 30 (the 30 rule is for the Register form only).
      Students never see it
- [ ] Dark mode: keywords, the AUTO tag, the Undo line, the note under Save
      and the card readable in Light and Dark
- [ ] Nothing is saved by ×, Undo, the automatic keywords or the card
      (Firestore console: no change until Confirm & Save / Save changes)

## 4e. Unsaved draft, remembered tab and "Leave site?" (errata #71)

Drafts live in **sessionStorage** (this browser tab only, gone when it
closes), never localStorage or Firestore. Open DevTools → Application →
Session Storage to watch `isu-draft:new`, `isu-draft:edit:<id>` and
`isu-staff-view`. Never press the final Save while testing on real data.

- [ ] **[auto]** `node src/draft.check.ts` ends with "All passed." (round
      trip, bad JSON / wrong shape / old or future version / another uid /
      another study ignored, unknown department → blank, "changed or not",
      staff tab, storage blocked → no draft and no error)
- [ ] **Register, reload:** paste a Drive link (or, on Check & save, type a
      title and an author) → F5 → the Register tab reopens with everything
      typed and **"We restored your unsaved study. Discard draft"** above the
      steps
- [ ] **Discard draft** → a blank form, the notice gone, `isu-draft:new`
      removed
- [ ] **PDF chosen but not read:** choose a PDF, do not continue → F5 → the
      notice adds **"Choose the PDF again (name.pdf): a browser cannot keep
      a chosen file after a reload."**; the PDF button says "Choose PDF from
      this computer" (nothing pretends the file is there)
- [ ] **Save step, reload:** Read PDF & continue → edit the abstract → F5 →
      the save step reopens with the abstract, keywords and (manual entry)
      the read error; no PDF is needed to save. After a good read,
      Change PDF → Continue with no PDF keeps the abstract (no Drive read).
      The **FROM PDF** tags come back on the details not changed since the
      read (errata #82)
- [ ] **A draft from before errata #82** (details typed on the old step 1)
      still restores: it opens on step 1 with "Choose the PDF again"; after
      the read the typed title, year … are kept (no tag) and only the empty
      details are filled from the PDF. One saved on the old save step opens on
      Check & save as before, nothing tagged
- [ ] **A draft from before errata #80** (text typed in the old "Add a
      keyword" box) still restores: its keywords stay, the typed text is gone
      (it was never added); a draft whose only change was that text is
      cleared
- [ ] **"I checked — register anyway"** is never restored: after a reload a
      possible duplicate asks for the tick again
- [ ] **Save waits for the studies:** reload on the save step → while
      "Loading the e-library…" shows, the save button is disabled with
      **"Loading the e-library to check for duplicates…"** under it; once
      loaded the originality check and automatic keywords appear as before
      and the button works. If the e-library fails to load, the button stays
      disabled and says **"Could not load the e-library. Check your
      connection and reload the page."**
- [ ] **Cleared:** Back to dashboard, Cancel (Edit), Discard and a successful
      save each remove the draft (the next visit to Register is blank, no
      notice). Switching tabs inside the app **keeps** it
- [ ] **Edit study, reload:** Study Details → Edit → change the title → F5 →
      the edit form for that study reopens with the change and the notice
- [ ] Edit draft for a study **someone else saved since** → the draft is
      dropped with the **notice** toast (amber "!", stays 6 s) "This study
      was changed since your unsaved edits, so they were discarded. Please
      edit it again."; a study **deleted since** → dashboard + the notice
      "That study is no longer in the e-library, so your unsaved changes were
      discarded."
- [ ] **Sign out** → every `isu-draft:*` key and `isu-staff-view` removed;
      a draft stored under **another account's uid** is never shown (and is
      removed)
- [ ] **Tab remembered (staff):** Dashboard, Register, Search, Statistics and
      Settings each come back after F5 (Search opens with an empty query).
      **Students:** a reload still opens the student dashboard
- [ ] **"Leave site?":** with something typed, closing or reloading the tab
      shows the browser's own prompt; not on an untouched form, not after
      Discard, Back / Cancel or saving
- [ ] **Storage blocked** (Chrome → site settings → cookies and site data
      blocked): the form works exactly as before, just nothing is restored

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
      studies" cards alike, matching the Author/Authors row in Study Details
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

## 5b. Smart search box — autocomplete and "Did you mean" (`16`)

- [ ] **[auto]** `node src/levenshtein.check.ts`, `node src/trie.check.ts`
      and `node src/smartSearch.check.ts` each end with "All passed." (the
      last also prints the 300-study timing)
- [ ] **Search screen (staff Search tab and student):** type `irr` → a list
      under the box: **irrigation** (Keyword · N studies), **irrigate**
      (Abstract). Nothing shows for 1 letter, for `zzz`, or after a space
- [ ] **"ma"** → **machine** (more studies) above **management**; words
      found only in abstracts (*many*, *massive*) are last
- [ ] ↓ highlights the first row, ↓ / ↑ move and wrap around, **Enter**
      picks it: the box reads `irrigation ` (with a space), the list closes,
      the cursor stays in the box. **Tab** on a highlighted row does the same
- [ ] Type `Rice  fa` → the first row is **rice farming**; pick it → the box
      reads `rice farming `. Type `Rice  fa` again and pick **farming** →
      `Rice  farming ` (the first word kept exactly as typed)
- [ ] The list closes on **Esc**, on clicking outside the box, after a pick
      and on the clear (✕) button; it never opens while the box is empty
- [ ] `acos` → **acosta** (Author); `pag` → **pagulayan** (Adviser); `dr` never
      offers "dr"; `th` never offers "the"
- [ ] **Corrects itself** (All Departments, All Years): search
      `machne lerning` → results appear **at once**, the result line says
      **9 results for "machine learning"**, highlights mark *machine* /
      *learning*, and above the results: "Showing results for **machine
      learning**" and a small link *Search instead for "machne lerning"*.
      The box still reads `machne lerning`
- [ ] Click *Search instead for "machne lerning"* → "0 results for
      "machne lerning"", no note, no button. Type the same words again → it
      corrects itself again (the link only holds for that one query)
- [ ] Search `irigation` (corrects itself), tick a result, **View Summary**
      → the panel says *for "irrigation"*, with *irrigation* highlighted
- [ ] **Button only** (never searched by itself): `moistrue` (2 edits) →
      "0 results" and **"Did you mean: moisture?"**; `yeld` (4 letters) →
      "Did you mean: **yield**?"; `rice irigation` → results through "rice"
      **and** "Did you mean: rice **irrigation**?". Click a button → the box
      reads the correction, results appear, the line is gone (never a second
      correction)
- [ ] **Filters:** Year = 2018, search `irigation` → it does **not**
      correct itself (irrigation finds nothing in 2018): "0 results" and the
      button only
- [ ] **Nothing shown** for `GIS`, `IoT`, `ICT` (3-letter acronyms are never
      changed), `eskwela` (a correct rare word), `2024`, `the`, `of`, `Rice`,
      `Dr. Villanueva`, `the 2024 eskwela`
- [ ] The box text is never changed unless a row or the button is clicked
- [ ] **Student dashboard:** `pag` → the list under the hero box; ↓ + Enter
      fills `pagulayan ` **without** searching; a second Enter opens the
      Search screen. The Search screen opens with the list **closed**
- [ ] **Phone (360px):** the list fits inside the screen (no sideways
      scroll), each row is easy to tap, and a tap fills the box. The "Did
      you mean" line and the "Showing results for / Search instead for" note
      wrap instead of overflowing
- [ ] **Dark and Light:** the list, the highlighted row, the bold words and
      the "Search instead" link are readable in both
- [ ] **Input method** (optional; Windows Japanese IME or a phone keyboard
      that underlines words): while a word is still underlined, Enter only
      confirms it — it does not pick a row or search
- [ ] Screen reader / DevTools: the box has `role="combobox"` and
      `aria-expanded` true only while the list shows; ↓ sets
      `aria-activedescendant` to the highlighted row
- [ ] Nothing is saved (Firestore console: no change)

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
- [ ] **360px** — seal, title (ellipsis), theme toggle, icon-only Sign Out and
      avatar fit with no sideways scroll
- [ ] **768–1023px** — full title, visible Sign Out button with its words
- [ ] **1366px+** — centred container, all navigation visible
- [ ] No breakpoint where content sits under the header
- [ ] Colours: green `#006439` primary · blue `#23305B` secondary · yellow
      `#F7D000` warning · red `#CD202B` error

## 8b. Dark mode

- [ ] **[auto]** `node src/theme.check.ts` → All passed (choice rules, the two
      dark blocks identical, every dark text pair ≥ 4.5:1)
- [ ] **[auto]** `grep -nE "#[0-9a-fA-F]{3,6}" src/App.css src/components/*.tsx`
      prints nothing
- [ ] **Light looks exactly as before**: compare each screen with `main`
- [ ] The moon/sun button is in every header (staff, student, search) and in
      the top-right corner of the login screen; one click flips Light ↔ Dark,
      and the icon changes (moon in light, sun in dark)
- [ ] Staff Settings → Theme shows Light / Dark / System; the choice and the
      header button always agree. Students have only the header button (Light ↔
      Dark): no System choice since errata #70
- [ ] Keyboard: Tab reaches the picker, arrow keys move between the three
      options, the focus ring is visible
- [ ] **System follows the device**: choose System, then switch Windows
      (Settings → Personalisation → Colours → Light/Dark) or DevTools →
      Rendering → *prefers-color-scheme*; the app changes at once, no reload
- [ ] **Remembered**: choose Dark, reload → still dark; close and reopen the
      tab → still dark. Another browser/device keeps its own choice
- [ ] **No white flash** on reload in dark (watch the very first frame)
- [ ] Storage blocked (Chrome → site settings → block cookies and site data
      for localhost): the toggle still works for the visit, no error
- [ ] Every screen in dark, readable, nothing white left: login (and its
      error box), staff dashboard, Register (all steps, PDF reading, success
      and "type it yourself" bars, field errors, keyword chips, the
      department select), Edit study, Statistics bars and keyword chips,
      Settings, student dashboard (hero, chips, cards, at a glance), Search
      (filters, active chips, result cards, highlights, ticked card, Study
      Details, Edit/Delete), the summary panel (highlights, citations,
      References, key terms), the Delete and Sign out dialogs, toasts (all
      three kinds: the green tick, amber "!" and red "!" marks are clear on
      the toast, and an error's × is visible, with a ring when Tab reaches it)
- [ ] Native controls match: select lists, checkboxes, scrollbars, the
      browser's autofill and spell-check menus are dark too

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
- [ ] https://isu-elibrary.web.app loads (errata #83; `08` §4)
- [ ] `curl -I` on `/`, `/?mode=resetPassword` and one `/assets/` file shows
      `no-cache`, `no-cache`, `public, max-age=31536000, immutable` (`08` §4)
- [ ] On the live site: sign in with password **and** with Google (no
      `auth/unauthorized-domain`), Search, Read full study, Register with a
      Drive link (the details are read; no 403 in the console), then leave
      without saving, or save a test study and delete it
- [ ] Summary of ticked results works on the live site
- [ ] Forgot password on the live site → the email opens our "Create a new
      password" page on isu-elibrary.web.app (`17` §6 step 7)
- [ ] Refresh with F5 on the live site → no 404, still signed in
- [ ] HTTPS padlock, no mixed-content warnings
- [ ] `docs/` is committed in the repo
- [ ] Latest commit is pushed to the remote

---

## Automated checks in one block

```bash
grep -rn "MOCK_ABSTRACT\|Math.random" src/            # expect: no output
grep -rn "page.reload\|alert(" src/                   # expect: no output
grep -rn "firebase/" src/search.ts src/summary.ts src/extractPdf.ts src/validation.ts src/similarity.ts src/keywordModel.ts src/levenshtein.ts src/trie.ts src/smartSearch.ts src/draft.ts   # expect: no output
node src/validation.check.ts                           # expect: All passed.
node src/citation.check.ts                             # expect: All passed.
node src/snippet.check.ts                              # expect: All passed.
node src/search.check.ts                               # expect: All passed.
node src/theme.check.ts                                # expect: All passed.
node src/similarity.check.ts                           # expect: All passed.
node src/keywordModel.check.ts                         # expect: All passed.
node src/levenshtein.check.ts                          # expect: All passed.
node src/trie.check.ts                                 # expect: All passed.
node src/smartSearch.check.ts                          # expect: All passed.
node src/stats.check.ts                                # expect: All passed.
node src/draft.check.ts                                # expect: All passed.
grep -nE "#[0-9a-fA-F]{3,6}" src/App.css src/components/*.tsx   # expect: no output
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
