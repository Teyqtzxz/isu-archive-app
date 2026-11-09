# Figma guide: from live screens to a clickable prototype

Read `README.md` first (the frame list, the made-up data set, the privacy
rules). This guide is the owner's click-by-click path. `CLICK-MAP.md` lists
every link to draw.

Figma menu names change over time. Where a name below differs on your
screen, look for the same idea nearby. The steps never depend on a paid
feature.

---

## 1. Set up the two Figma files

1. In Figma, create a **Design** file named **ISU E-Library – RAW captures (PRIVATE)**.
   - Captures land here exactly as imported, real text included.
   - **Never share this file.**
2. Create a second Design file named **ISU E-Library – Mockup**. This is the
   only file you will share.
3. In the **Mockup** file, make these pages (left panel → Pages → `+`):
   - `Cover`: title, team, date, one line *"Made from the live system;
     all data is made up."*
   - `Prototype – Desktop`: frames 01-27 and 30, 1440 wide.
   - `Prototype – Phone`: frames `29 Phone – …`, 390 wide.
   - `Dark mode`: frames `28 Dark – …`.
   - `Components`: header, toast, dialog components (§6).
4. **Frame names** are exactly as in README §1: `01 Sign in`,
   `12b Search results – Showing results for`, `29 Phone – 10 Student dashboard`, …
   Rename a frame by double-clicking its name in the Layers panel.
5. Lay the desktop frames out in rows by flow, left to right:
   - row 1 accounts: 01-09
   - row 2 student: 10-15
   - row 3 staff: 16-27 and 13b, 22b, 30

---

## 2. Capture tools and settings

- **html.to.design browser extension**, in **your own signed-in Chrome**.
  Do **not** use its "import from URL" option: it opens the page as a
  signed-out stranger and cannot see any screen behind sign-in.
  1. Install the html.to.design extension from the Chrome Web Store, and the
     html.to.design plugin in Figma.
  2. On the screen to capture, click the extension's icon and choose to
     capture the current page. Depending on the version, it either sends the
     capture to Figma or downloads a capture file. Follow its on-screen
     wording.
  3. In the **RAW** file, run the html.to.design plugin (Resources `Shift+I`
     → Plugins → html.to.design) and import the capture.
- **Screenshots as backup** (`Win+Shift+S`, or Snipping Tool with a 3 s
  delay for frame 18): **crop to the page**, never the address bar. Paste
  into the RAW file.
- **Desktop:** Chrome window wide enough for **1440** px. Check the imported
  frame's width (right panel, W). If it is not 1440, set W = 1440.
- **Phone:** DevTools (`F12`) → device toolbar (`Ctrl+Shift+M`) → Dimensions
  **Responsive**, width **390**, height **844** → reload → capture.
  - If the imported frame comes out 1440 wide, the extension ignored the
    emulated width. Use a screenshot of the 390 view instead.
- **Dark mode:** the moon button in any header (or Light / Dark / System in
  the staff Settings tab) switches the theme. The choice is remembered.
  **Switch back to light** after the dark captures.
- **Before every capture:** scroll to the top, close autocomplete lists you
  don't want, and wait for "Loading the e-library…" to go.

---

## 3. Capture day (run in this order)

Rules for the whole day (README §3):
- Never press Confirm & Save, Save Manually, Save changes, or the red Delete.
- Dialogs: capture, then **Cancel**. The red Sign Out is pressed only to
  switch test accounts.
- Use only your test accounts and the UP Open University sample PDFs, never
  "THESIS FINAL MANUSCRIPT.pdf".
- Before frames 05-09, **sign out of the e-library in every tab**. A signed-in
  tab makes the email link show "Sign out first" instead
  (`AuthActionScreen.tsx:259-280`).

### 3A. Account frames (signed out)

1. **01 Sign in.** Open https://isu-elibrary.web.app → capture.
2. **02 Create account.** Click **Create account**. Type the full name and
   the ISU username, and a sample password in both boxes so the checklist
   ticks.
   - Capture with the passwords hidden (dots).
   - **Q4 = no:** go back with **Sign in** and don't submit.
3. **03 Check your ISU inbox.**
   - **Q4 = yes:** submit **Create account** with the new ISU address →
     capture.
   - **Q4 = no, but you have a test account that was never verified:** sign
     in with it → capture.
   - **Q4 = no and no such account:** rebuild 03 in Figma. Duplicate frame
     06 (same card, same envelope badge) and change the texts to the code's:
     - heading "Check your ISU inbox"
     - "We sent a verification link to **juan.delacruz@isu.edu.ph**. Open it
       and click the link, then come back and tap **I've verified**."
     - primary button "I've verified", secondary "Resend email", link "Use a
       different account" (`VerifyEmailScreen.tsx:98-137`).
4. **04 Email verified (Firebase page).** Q4 = yes only.
   1. Open the verification email in your inbox, then open its link **as
      it is** (no edited link). It opens **Firebase's own page**.
   2. Capture the page only.
   3. Note whether the page shows a button, and what it says; CLICK-MAP needs it.
   4. Go back to the e-library tab and press **I've verified**. This reaches
      the student dashboard and creates the new account's STUDENT profile.
   5. In Figma add the caption *"the email link opens Firebase's page (action
      URL cannot be changed, docs/17 §5)"*.
   - **Q4 = no:** there is no way to get this page without a new account.
     Leave 04 out, put the caption on the 03 → 10 link in the click map, and
     say so in the hand-in.
5. Sign out (header **Sign Out**, then the red **Sign Out** in the dialog:
   this only ends your test session). Make sure every tab is signed out.
6. **05 Forgot password.** On Sign in click **Forgot password?** and type the
   **STUDENT test** username → capture. **Don't send yet.**
7. **06 Check your ISU inbox (reset).** Press **Send reset link** → capture.
   - This uses **1 of the 5** sign-in-link emails today.
   - **Don't press Resend link.**
8. **07 Create a new password.** In the same Chrome, open the email "Sign in
   to ISU Research Study E-Library" and click its link.
   - The app removes the link from the address bar at once (`App.tsx:98`).
   - The page shows the form for your STUDENT test email → capture.
   - If it asks "Confirm your ISU email" first, type the STUDENT username →
     Continue.
9. **08 Password changed.** Type a new password that ticks every line, in
   both boxes → **Save password** → capture.
   - **Write the new password down.** Only the STUDENT test account changes.
   - Sign in with it later.
10. **09 This link no longer works.** Still signed out, in the same Chrome,
    open the **same** email link again.
    1. It shows "Confirm your ISU email": type the STUDENT username →
       **Continue**.
    2. "Create a new password" opens. Type the **same new password as in
       step 9** in both boxes → **Save password**.
    3. The link is already used, so Firebase refuses it and nothing changes.
       Typing the same password means nothing would differ even if it didn't.
    4. You see "This link no longer works" with **Send a new link** →
       capture. **Don't press Send a new link**: it would only open Forgot
       password, but don't send anything from there.

### 3B. Student frames (sign in with the STUDENT test account)

The capture uses the **real** library, so search with **real words** from
the real studies. All of it is replaced later (§5).

11. **10 Student dashboard.** Sign in → scroll to the top → capture. The page
    is long; the import keeps the full height.
12. **11 Search autocomplete.** In the big search box type the first 3
    letters of a word that appears in real titles, so the list opens →
    capture. Don't press Enter.
13. **12b Showing results for.**
    1. Click **Search** with any word to reach the Search screen.
    2. Type a real word of **5+ letters with one letter missing**, a word that
       as typed finds nothing.
    3. Wait for "Searching…" to go → capture.
    - Rule: `smartSearch.ts:405-439`. The search corrects itself only when
      the typed words find **0** results, every fix is **exactly 1** edit on
      a word of 5+ letters, and the fix finds something.
14. **12 Did you mean.** Type a real word with **two letters swapped** (2
    edits) → capture the "Did you mean: …?" button.
    - If you get "Showing results for" instead, swap two letters farther
      apart.
15. **13 Study Details (student).** Search a common real word that finds at
    least 2 studies.
    1. **Tick the check boxes of the first 2 results.** Safe: it only selects
       them for the summary. **View Summary (2)** appears.
    2. Click the first result's **title**; its Study Details opens below it.
    3. Capture. Frame 13 is also the page behind the summary overlay.
16. **15 Citation row.** In Figma, crop a copy of 13 to the **Citation** line
    (no extra capture needed).
17. **14 Combined summary.** Click **View Summary (2)** → capture the panel.
    Then **Close**.

### 3C. Staff frames (sign out, sign in with the STAFF test account)

18. **16 Staff dashboard** → capture.
19. **30 Account menu.** Click the round avatar (initials, top right) →
    capture with the menu open → click elsewhere to close.
20. **24 Statistics** tab → capture. **25 Settings** tab → capture.
21. **26 View all studies.** Dashboard tab → **View all studies** → capture.
22. **13b Study Details (staff).** On that list click a title → capture
    (Open in Drive / Edit / Delete).
23. **23 Delete this study?** Click **Delete** → capture → **Cancel**.
24. **22 Edit study.** Click **Edit** → capture.
25. **22b Edit – Check & save.** With **no PDF chosen**, click **Continue**
    → capture ("Ready to save:", **Save changes**). Then **Change PDF** →
    **Cancel**. Nothing is saved.
26. **27 Sign out?** Click **Sign Out** in the header → capture →
    **Cancel**.
27. **17 Register – Choose PDF.**
    1. Click the **Register** tab → **Choose PDF from this computer**.
    2. Pick a UP Open University sample that is **already in the library**,
       so the duplicate check fires on 19/20.
    3. Paste that study's Drive link (copy it from its Study Details → Open
       in Drive) → capture.
28. **18 Register – Reading PDF.** The reading takes only 1-2 seconds.
    1. Set DevTools → Performance → CPU **6× slowdown** (or the slowest
       offered).
    2. Start Snipping Tool with a **3 s delay**, then click **Read PDF &
       continue**. Crop to the page.
    - If you miss it, rebuild 18 (§7).
29. **19 Register – Check & save.** When the details appear → capture the
    whole page.
    - The **Possible duplicate** box is at the bottom, and Confirm & Save is
      disabled until it is ticked (`RegisterForm.tsx:1156, 1170-1172`).
    - **Do not tick it and do not click near the bottom.**
30. **20 Possible duplicate.** Click **Show details** on the match (safe: it
    only opens text) → capture again.
31. Leave: **Change PDF** (top) → **Back to dashboard**. This also clears the
    unsaved draft (`RegisterForm.tsx:258-262`). Switch CPU throttling off.

### 3D. Dark mode and phone

32. **28 Dark:** click the moon button, then re-capture 01 (signed out), 10
    (STUDENT), 13 (STUDENT), 16 and 24 (STAFF). Switch back to light.
33. **29 Phone 390:** with the device toolbar at 390, capture 01, 10, 12, 13
    (STUDENT) and 16, 19 (STAFF; repeat steps 27-29 and leave as in step 31).

---

## 4. From RAW to Mockup

1. In the RAW file, select a captured frame → `Ctrl+C`. In the Mockup file,
   on the right page → `Ctrl+V`.
2. Rename it (README §1 names).
3. Imported pages can be very tall (10, 13, 19, 24). Leave the full height;
   §8.6 makes them scroll.
4. **Overlays** (14, 23, 27, 30): the capture contains the dim page behind
   the dialog. Keep **only the dialog box** as the overlay frame:
   1. Select the dialog box group → Frame selection (`Ctrl+Alt+G`).
   2. Name it `23 Delete this study?`. The page behind it comes from the
      frame that opens it.
   - Do the same for 14 (summary sheet), 27 (Sign out?) and 30 (account menu).

---

## 5. Replace every real text and number

Do this **in the Mockup file**, frame by frame, with README §2 open.

1. **Text:** double-click a text layer → select all (`Ctrl+A`) → type the
   made-up text. For long abstracts, paste the README text.
2. **Find and replace:** `Ctrl+F` in the Mockup file finds a word on every
   page.
   - Use it for repeated items: a real surname, the real email, a real
     keyword, the real count "NN studies".
   - Replace each with the made-up value. Where your Figma version can't
     replace, use it to find, then edit.
3. **Numbers too:** counts, percentages, years, dates, "N results for",
   "N total", chip counts, chart values and labels, keyword model numbers.
   - **Charts:** change the number labels; then resize each bar or column
     so its length matches the new number (longest = the largest value).
4. **Cards:** where the live page has more cards than §2.4 needs, delete the
   extra cards. Where it has fewer, duplicate a card (`Ctrl+D`) and refill
   it.
5. **Long or short text:** text boxes may need **Auto height** (right panel
   → Text → resizing) so a longer made-up title does not overlap.
6. **Avatars and emails:** JD / MD, the two made-up emails, the masked
   j•••@isu.edu.ph.
7. **Drive link and file name:**
   `https://drive.google.com/file/d/SAMPLE-FILE-ID/view` and `sample-study.pdf`.
8. Tick the frame's row in README §3.1 when done.

---

## 6. Components (Components page)

1. **Headers.**
   1. In frame 10 select the green header → **Create component**
      (`Ctrl+Alt+K`) → name `Header / Student`.
   2. Do the same from 16 → `Header / Staff` (with the tab bar).
   3. From 12 → `Header / Search`.
   4. Move the main components to the Components page (right-click → Move
      to page).
   5. In every other frame of the same kind, delete the imported header and
      drag in an **instance** at the same place (X = 0, Y = 0).
   - Headers then change in one place, and links drawn on the component
     (Sign Out, theme, avatar) work in every frame (§8.7).
2. **Toast `Toast / Success`.** Build it (no capture exists):
   - Auto layout, horizontal, gap **10**, padding **12 / 18**, corner radius
     **10**, fill **#151A18** (dark mode **#2B3632**).
   - Shadow: soft drop shadow.
   - Icon: 18 × 18 circle, fill **#006439** (dark **#0F7A4A**), white tick.
   - Text: "Study posted!", 14 px, weight 500, white.
   - Source: `src/App.css` `.isu-toast` lines 1902-1929, `src/index.css`
     lines 98-104, `toast.ts:23`.
   - Placed **centered, 24 px above the bottom** of the visible screen.
3. **Dialog** (optional): make the cleaned 27 dialog a component
   `Dialog / Confirm` and reuse it for 23 by changing the texts.

---

## 7. Rebuilt and edited frames

- **21 Study posted!**
  1. Duplicate frame 16 → name `21 Study posted! toast`.
  2. Change the stat cards, "N total" and the first card to the
     after-posting values (README §2.4, frame 21 row; S8 first).
  3. Place a `Toast / Success` instance centered near the bottom of the
     visible screen.
  4. If 16 scrolls, set the toast's position to **Fixed** in the Prototype
     tab's scroll settings, so it stays on screen.
- **20 Possible duplicate.** In frame 20 set the check box of "I checked —
  register anyway" to **ticked** (draw a tick in the box, fill it green like
  other ticked boxes). Restyle **Confirm & Save** as enabled:
  - Copy the enabled look from 22b's **Save changes**, the same button style
    (`btn-submit--save`).
  - Change only the text back to "Confirm & Save".
- **18 Reading PDF** (only if no screenshot):
  1. Duplicate 17 and delete the form card and the "Read PDF & continue"
     button.
  2. Add a centered panel: a spinner ring with a file icon, "Reading PDF and
     filling in details...", "From this computer", "Reading page 5 (up to
     40)…", and a thin progress bar (`RegisterForm.tsx:889-904`).
  3. Set step 2 "Reading" as the active step.
- **04 caption.** A text box above or under the Firebase page:
  *"the email link opens Firebase's page (action URL cannot be changed,
  docs/17 §5)"*. Style it grey, 14 px, and keep it outside the clickable
  area.

---

## 8. Prototype tab: draw the links

Switch the right panel to **Prototype**. Work through `CLICK-MAP.md` line by
line and tick each box.

1. **Navigate.** Select the element (button, link, card) → drag the blue `+`
   handle onto the target frame.
   - Interaction: **On click**, action **Navigate to**, Animation
     **Instant** (or Dissolve 200 ms).
   - Draw the link on the **smallest** element that matches the label, never
     on the whole frame (except where CLICK-MAP says "whole frame").
2. **Open overlay** (14, 23, 27, 30): action **Open overlay**, target the
   dialog frame.
   - In the overlay settings: position **Center** (30: **Manual**, under
     the avatar, top right).
   - Tick **Close when clicking outside**.
   - Tick **Add background behind overlay**, black, about 40 %.
3. **Close overlay:** on the overlay's **Cancel**, **×** and **Close**,
   action **Close overlay**.
   - For an overlay button that goes somewhere (summary citation chip,
     Delete, the account menu's Settings): **Navigate to** the target. A
     navigation closes the overlay.
4. **After delay:**
   - Select frame **18** (nothing inside), add an interaction: trigger
     **After delay** **1500 ms**, action **Navigate to** **19**.
   - The same on **21**: **After delay** **3000 ms** → **16** (the toast's
     3 s, `toast.ts:23`).
5. **Back:** the arrow at the top left of the Search screen (12, 12b, 13,
   13b, 26) → action **Back** goes to the previous frame, as the app does.
   - CLICK-MAP gives the fixed target for each flow too, in case Back lands
     somewhere odd. Use **Navigate to** that frame if it does.
6. **Scrolling for long pages** (10, 12-13b, 16, 19-20, 22b, 24, 26):
   1. Select the frame and note its full height.
   2. Set the frame height to the screen (**1024** desktop, **844** phone).
   3. Turn on **Clip content**.
   4. In Prototype → **Scroll behavior** → Overflow: **Vertical**.
7. **Sticky header:** select the header instance → Prototype → Scroll
   behavior → Position: **Fixed** (sticky).
   - Links on a header instance: draw them once on the main component's
     button only if the target is the same everywhere: Sign Out → 27,
     avatar → 30.
   - Otherwise draw them in each frame.
8. **Flow starting points.** Select frame **01** → Prototype → **Flow
   starting point** `+` → name **Student flow**. Select **16** → `+` → name
   **Staff flow**.
   - Optional:
     - `Used email link` on `09 This link no longer works`
     - `Phone flow` on `29 Phone – 01 Sign in`
     - `Phone staff flow` on `29 Phone – 16 Staff dashboard`
     - `Dark flow` on `28 Dark – 01 Sign in`
9. **Device:** Prototype tab with nothing selected → Device **None**
   (desktop, 1440) for the desktop page; **iPhone** about 390 wide for the
   phone page. Background: light grey.
10. **Links that leave the system** (Read full study, Open in Drive,
    Continue with Google): no link. The real ones open Google pages that are
    not part of the mockup and must not point at real files. CLICK-MAP marks
    them "no link".

---

## 9. Test, then share

1. Press **Present** (▶ top right). Pick **Student flow** in the flow list,
   then click through every CLICK-MAP line for that flow. Repeat for **Staff
   flow**.
2. `R` restarts the flow. Fix any link that goes to the wrong frame.
3. Do the **before-sharing checklist** (README §3.1) on the Mockup file.
4. **Share the prototype only:** in Present view → **Share prototype** (or
   Share → Prototype tab in the editor).
   - Link access: **Anyone with the link → can view**, or only your
     professor's email.
   - Untick "show comments" if offered.
   - **Never** share the RAW file, and never give "can edit".
5. Copy the link and open it in a private window to check what a viewer sees
   (both flows start).
6. Hand in: the prototype link, the two flow names, and a note on frame 04
   (Firebase page caption; Q4 = no → 04 not captured).
