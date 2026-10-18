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
      toast "Couldn't load your profile, so you're seeing the student view.
      Check your connection and sign in again.", the header shows your name
      (not blank) and the console has `[auth] could not read the user profile`.
      Switch back to **No throttling**: the studies load; on Search, "Read full
      study" opens a URL ending in `authuser=<your ISU email>`. Refresh → staff
      dashboard again
- [ ] Every Sign Out button first shows "Sign out?" with Cancel and Sign Out.
      Cancel, Escape and a click outside the box keep you signed in on the same
      screen; Sign Out goes to the login screen

### 1b. Email + password login (`17`, errata #68)

Do `17` §6 steps 1–3 in the console first. Use a **new test ISU account**
made for this (e.g. a spare `@isu.edu.ph` address you can open the inbox of)
— never the owner's or a staff member's real account. Afterwards, the test
account can be deleted in the console (Authentication → Users, and its
`users/{uid}` document) by the owner.

- [ ] **[auto]** `node src/auth.check.ts` ends with "All passed."
- [ ] Login card: Email or ISU username · Password with an eye button ·
      **Sign in** · "Forgot password?" and "Create account" · "or" ·
      **Continue with Google**. Light and dark both readable
- [ ] Every password box has its own eye: Sign in (1), Create account (2:
      Password and Confirm, each toggles only itself), new-password screen (2)
- [ ] Sign in with an empty form → "Please fill in your ISU email." and
      "Please type your password." under their own boxes. `juan@gmail.com` →
      "Use your ISU email address (@isu.edu.ph)." on leaving the box
- [ ] Wrong password for the test account → "Email or password is
      incorrect." A made-up `nobody.x@isu.edu.ph` → **the same words**
- [ ] **Create account** with the test account: a 7-character password →
      "The password must be at least 8 characters." on leaving the box;
      Confirm different → "The passwords don't match." under Confirm, and
      **nothing is created** (Authentication → Users has no new row). The
      hint "At least 8 characters. Not your Gmail password." is under the box
- [ ] Full name `maria` → "Type your full name, e.g. Juan Dela Cruz"
- [ ] Correct form → "Check your ISU inbox" with the address. **I've
      verified** before clicking the link → "Not verified yet. Open the link
      in your ISU inbox first." under the button. No dashboard, no data banner
- [ ] Double-click Create account / Send reset link / Resend: one email
      arrives, not two (buttons go grey while a request runs)
- [ ] Open the email (check Spam), click the link, come back, **I've
      verified** → student dashboard **without signing in again**, greeted by
      the full name. Console: Authentication → Users shows the account;
      Firestore `users/{uid}` has `role: "STUDENT"`
- [ ] Refresh → still signed in. Sign out → sign in with username only
      (`test.account`) + password → same dashboard
- [ ] Create account again with the same email → "This ISU email already has
      an account. Sign in, or use Forgot password? to set a password." under
      the email box
- [ ] **Forgot password** → ① email → ② "If an account exists for t•••@…"
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
- [ ] "Added this month" equals the number of Recent studies rows (and
      Search results, newest first) whose "Posted" date is in this month;
      "Added this year" likewise for this year
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

## 4b. Edit and delete a study (staff)

- [ ] **Staff:** Study Details (Search → tap a title) shows **Edit** and
      **Delete** (red outline) next to "Open in Drive"; on a 360 px phone the
      three buttons wrap, nothing sticks out of the card
- [ ] **Student:** Study Details shows only "Read full study" and the
      view-only line — **no Edit, no Delete** (check on the student dashboard's
      "View details" too)
- [ ] **Edit** opens "Edit study" (heading and step 1) with every field filled
      in: title, authors (chips), department, Academic Year, adviser, Drive
      link; the PDF box says "(optional)" and the button says **"Continue"**
- [ ] **Edit without a PDF:** change the title → "Continue" goes straight to
      the save step (no "Reading PDF…", no Drive download — check the Network
      tab: no `googleapis.com/drive` request) with "Ready to save: Current
      abstract and keywords kept"; the abstract and keywords are the study's
- [ ] **Save changes** → toast **"Study updated"** → the search screen opens at
      that study with its Study Details expanded and the new title; the
      dashboards and Statistics show the change without a reload
- [ ] In the Firestore console the document has `updatedAt` (a timestamp) and
      `updatedBy` (your uid); `registeredAt`, `registeredBy` and `status` are
      unchanged, and the study keeps its place in the newest-first list
- [ ] **Edit with a PDF:** choose a PDF → the button says "Read PDF & continue"
      → PROCESSING → "Details filled in:" with the abstract and keywords read
      from that PDF; Save changes keeps them
- [ ] A PDF that cannot be read (scanned) in Edit → "Could not read the PDF."
      and the study's current abstract and keywords are **kept**, not blanked
- [ ] **Validation on edit:** clear the title → "Continue" shows "Please fill
      in the title." under it; Academic Year `201` → "Please type a 4-digit
      year, e.g. 2019."; adviser `Dr. Santos` → the adviser message; an
      abstract cut to under 50 words → "The abstract looks too short…" on Save
      changes; nothing is saved while a message shows
- [ ] A study saved before the name checks with an author like `Dela Cruz`:
      "Continue" shows "Fix “Dela Cruz”: remove it and add it again. …"; remove
      the chip, add `Juan Dela Cruz`, and it saves
- [ ] Values are cleaned on loading: a title saved with double spaces or an
      author saved as `juan dela cruz` shows as `Juan Dela Cruz` in the form
- [ ] **Cancel** (step 1) and **Edit details → Cancel** return to the search
      screen at that study with **nothing** changed; clicking a staff tab while
      editing also leaves without saving
- [ ] **Delete** → a dialog: "Delete this study?", the study's title in bold,
      "This removes it from the e-library for everyone and cannot be undone.
      The PDF stays in Google Drive.", **Cancel** (focused — Enter cancels) and
      **Delete** (red)
- [ ] **Cancel**, **Escape** and a click on the dark backdrop each close the
      dialog and the study is still there
- [ ] **Delete** → toast **"Study deleted"**; the study disappears from the
      search results, the staff "Recent studies", the student "Recently added"
      (open a student window side by side: it goes there too without a
      reload), the dashboard counts and the Statistics bars/keywords
- [ ] The PDF is still in Google Drive after the delete
- [ ] Sign out still asks "Sign out?" exactly as before (same dialog component)
- [ ] A refused write shows a clear message, never a blank page: open a study
      as staff, then in the Firebase console change your `users/{uid}` role to
      `STUDENT` (do not reload). **Delete** → toast "You do not have permission
      to delete the study. Only Research Department staff can edit or delete
      studies." and the study stays; **Edit → Save changes** → the same kind of
      message in the red box, the form stays open. Set the role back to `STAFF`
      afterwards. (Offline is not a failure: Firestore queues the write and
      sends it when the connection returns.)

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

## 4d. Keyword model — suggested keywords and accuracy card (`15`)

- [ ] **[auto]** `node src/keywordModel.check.ts` ends with "All passed."
      (label normalisation, learned vs extracted, the P ≥ 0.9 + 5-evidence
      guard, no duplicates, validation rules, phrase rules, Edit exclusion,
      no leakage in leave-one-out, empty library)
- [ ] **Register:** fill in a study → Read PDF & continue → a **"Suggested
      keywords"** box above Keywords, at most **6** chips, each saying
      "learned from N studies" or "from this abstract". Nothing is added
      until a chip is clicked
- [ ] Click a chip → it moves into Keywords exactly as if typed; the chip
      disappears and another may take its place. A keyword already in the
      list (any capitals or plural) is never suggested
- [ ] At **10** keywords every chip is greyed out ("Up to 10 keywords can
      be added.")
- [ ] **Edit study** on a study with copies (e.g. "thesis sample 2"): remove
      one of its keywords → it comes back as a chip "learned from **2**
      studies" (its copies — the study itself is never counted)
- [ ] An abstract about a topic no stored study has → phrases only, no
      "learned" chip
- [ ] **Statistics tab (staff):** a **"Keyword model"** card under the
      department charts: training studies, known keywords, "Testing the
      model…" then "*N* studies tested, *M* copies hidden", Model vs
      Baseline for the three measures, and **"Fewer than 30 studies with
      keywords — not reliable yet."** while under 30. Students never see it
- [ ] Dark mode: chips and the card readable in Light and Dark
- [ ] Nothing is saved by the suggestions or the card (Firestore console:
      no change until Confirm & Save / Save changes)

## 4e. Unsaved draft, remembered tab and "Leave site?" (errata #71)

Drafts live in **sessionStorage** (this browser tab only, gone when it
closes), never localStorage or Firestore. Open DevTools → Application →
Session Storage to watch `isu-draft:new`, `isu-draft:edit:<id>` and
`isu-staff-view`. Never press the final Save while testing on real data.

- [ ] **[auto]** `node src/draft.check.ts` ends with "All passed." (round
      trip, bad JSON / wrong shape / old or future version / another uid /
      another study ignored, unknown department → blank, "changed or not",
      staff tab, storage blocked → no draft and no error)
- [ ] **Register, reload:** type a title (and an author) → F5 → the Register
      tab reopens with everything typed and **"We restored your unsaved
      study. Discard draft"** above the steps
- [ ] **Discard draft** → a blank form, the notice gone, `isu-draft:new`
      removed
- [ ] **PDF chosen but not read:** choose a PDF, do not continue → F5 → the
      notice adds **"Choose the PDF again (name.pdf): a browser cannot keep
      a chosen file after a reload."**; the PDF button says "Choose PDF from
      this computer" (nothing pretends the file is there)
- [ ] **Save step, reload:** Read PDF & continue → edit the abstract → F5 →
      the save step reopens with the abstract, keywords and (manual entry)
      the read error; no PDF is needed to save. After a good read,
      Edit details → Continue with no PDF keeps the abstract (no Drive read)
- [ ] **"I checked — register anyway"** is never restored: after a reload a
      possible duplicate asks for the tick again
- [ ] **Save waits for the studies:** reload on the save step → while
      "Loading the e-library…" shows, the save button is disabled with
      **"Loading the e-library to check for duplicates…"** under it; once
      loaded the originality check and suggested keywords appear as before
      and the button works. If the e-library fails to load, the button stays
      disabled and says **"Could not load the e-library. Check your
      connection and reload the page."**
- [ ] **Cleared:** Back to dashboard, Cancel (Edit), Discard and a successful
      save each remove the draft (the next visit to Register is blank, no
      notice). Switching tabs inside the app **keeps** it
- [ ] **Edit study, reload:** Study Details → Edit → change the title → F5 →
      the edit form for that study reopens with the change and the notice
- [ ] Edit draft for a study **someone else saved since** → the draft is
      dropped with the toast "This study was changed since your unsaved
      edits, so they were discarded. Please edit it again."; a study
      **deleted since** → dashboard + "That study is no longer in the
      e-library, so your unsaved changes were discarded."
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
      References, key terms), the Delete and Sign out dialogs, toasts
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
