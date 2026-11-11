# Click map: every prototype link, taken from the code

**Format:** `frame → "element (exact label)" → target → link type → source file:line`

- **Link types:** **Navigate** (Navigate to) · **Open overlay** · **Close
  overlay** · **Back** · **After delay**. Figma steps are in FIGMA-GUIDE.md §8.
- Source paths are under `src/` (`components/…` unless shown). Code baseline:
  main 35322b0.
- **"shortcut"**: the real app shows a variant (another filter or list); the
  prototype reuses the nearest frame.
- **"no link"**: the real control leaves the system (Google, Drive, a file
  chooser), sends an email, or shows a state the mockup does not have.
- **Header links** (theme, Sign Out, avatar, staff tabs) are the same in
  every frame that uses the header. Draw them once on the header component
  (FIGMA-GUIDE §6, §8.7) and tick them once here.

---

## 1. Account flows (start: `01 Sign in`, flow **Student flow**)

### 01 → 02 → 03 → 04 (→ 03 → 10)

- [ ] 01 → "Create account" → 02 · Navigate · `LoginScreen.tsx:244-246`
- [ ] 01 → "Sign in" → 10 · Navigate · `LoginScreen.tsx:235-237`; routing `App.tsx:147-166` (a STAFF account goes to 16; the staff flow starts at 16 instead)
- [ ] 01 → "Continue with Google" → no link (Google popup) · `LoginScreen.tsx:252-265`
- [ ] 01 → moon button (top right) → `28 Dark – 01 Sign in` · Navigate · `LoginScreen.tsx:159`, `ThemeToggle.tsx:39-48`
- [ ] 02 → "Create account" (submit) → 03 · Navigate · `LoginScreen.tsx:300-302`; routing `App.tsx:130-138`
- [ ] 02 → "Sign in" (under "Already have an account?") → 01 · Navigate · `LoginScreen.tsx:304-309`
- [ ] 03 → help text "We sent a verification link to …" → 04 · Navigate (stands for opening the email) · `VerifyEmailScreen.tsx:99-102`
- [ ] 03 → "I've verified" → 10 · Navigate · `VerifyEmailScreen.tsx:122-125, 53-54`; `App.tsx:390, 165`
- [ ] 03 → "Resend email" → no link (sends an email) · `VerifyEmailScreen.tsx:128-130`
- [ ] 03 → "Use a different account" → 01 · Navigate · `VerifyEmailScreen.tsx:133-138`; `App.tsx:110-112`
- [ ] 04 → the Firebase page's button if it has one, otherwise the whole frame → 03 · Navigate (back to the e-library tab; then "I've verified") · `docs/17-email-login.md:284-285`; `App.tsx:130-138`

**Q4 = no and 04 not captured:** skip the two 03 → 04 and 04 → 03 lines.

### 01 → 05 → 06 → 07 → 08 → 01

- [ ] 01 → "Forgot password?" → 05 · Navigate · `LoginScreen.tsx:241-243`
- [ ] 05 → "Send reset link" → 06 · Navigate · `ForgotPassword.tsx:155-157, 93-95`
- [ ] 05 → "← Back to sign in" → 01 · Navigate · `LoginScreen.tsx:313-319`
- [ ] 06 → help text "If an account exists for j•••@isu.edu.ph …" → 07 · Navigate (stands for opening the email) · `ForgotPassword.tsx:125-127`; `App.tsx:357-360`
- [ ] 06 → "Use a different email" → 05 · Navigate · `ForgotPassword.tsx:173-178`
- [ ] 06 → "Resend link" → no link (uses one of the 5 daily emails) · `ForgotPassword.tsx:170-172`
- [ ] 06 → "← Back to sign in" → 01 · Navigate · `LoginScreen.tsx:313-319`
- [ ] 07 → "Save password" → 08 · Navigate · `AuthActionScreen.tsx:232-234, 124-131`
- [ ] 07 → "Cancel" → 01 · Navigate · `AuthActionScreen.tsx:236-238`; `App.tsx:313-323`
- [ ] 08 → "Sign in" → 01 · Navigate · `AuthActionScreen.tsx:286-289`; `App.tsx:313-323`

### 09 (used Forgot password link)

On the live site you only reach 09 by opening a used email link, so it gets
its own optional flow start **"Used email link"** (FIGMA-GUIDE §8.8).

- [ ] 09 → "Send a new link" → 05 · Navigate · `AuthActionScreen.tsx:282-284`; `App.tsx:321, 384`

---

## 2. Student flow (signed in as STUDENT)

### 10 Student dashboard

- [ ] 10 → the big search box → 11 · Navigate (stands for typing) · `StudentDashboard.tsx:98-112`
- [ ] 10 → "Search" → 13 · Navigate, shortcut · `StudentDashboard.tsx:113-115, 47-52`; `App.tsx:333-340`
- [ ] 10 → chip "Recent" → 13 · Navigate, shortcut (real: every study, newest first) · `StudentDashboard.tsx:127-129`
- [ ] 10 → a college chip, e.g. "CCSICT 1" → 13 · Navigate, shortcut (real: filtered to that college) · `StudentDashboard.tsx:130-136`
- [ ] 10 → E-Library at a glance bar, e.g. "CCSICT" → 13 · Navigate, shortcut (real: filtered to that college) · `StudentDashboard.tsx:144-148`; `DepartmentStats.tsx:41-55`
- [ ] 10 → E-Library at a glance keyword chip, e.g. "rice farming" → 13 · Navigate, shortcut (real: searches that keyword) · `StudentDashboard.tsx:147`; `DepartmentStats.tsx:83-87`
- [ ] 10 → "View all" → 13 · Navigate, shortcut (real: every study, newest first) · `StudentDashboard.tsx:155-158`
- [ ] 10 → "View details" on the S1 card → 13 · Navigate · `shared.tsx:190-194`; `App.tsx:345-351`
- [ ] 10 → avatar "JD" → no link (student menu not in the frame list; it shows name, email and "Student · read-only access") · `StudentDashboard.tsx:69-85`
- [ ] 10 → header moon button → `28 Dark – 10 Student dashboard` · Navigate · `StudentDashboard.tsx:64`; `ThemeToggle.tsx:39-48`
- [ ] 10 → header "Sign Out" → 27 · Open overlay · `StudentDashboard.tsx:65-68`; `App.tsx:300-302`

### 11 Search autocomplete

- [ ] 11 → suggestion "rice" → 13 · Navigate (stands for picking it and pressing Search) · `SmartSearchInput.tsx:113-129, 56-59`; `StudentDashboard.tsx:113`

### Search screen (12, 12b, 13, 15)

- [ ] 13 → search box → 12b · Navigate (stands for typing "irrigaton") · `SearchScreen.tsx:236-247`
- [ ] 12b → search box → 12 · Navigate (stands for typing "raeding comprehension") · `SearchScreen.tsx:236-247`
- [ ] 12 → search box → 13 · Navigate (stands for typing "rice") · `SearchScreen.tsx:236-247`
- [ ] 12b → "Search instead for “irrigaton”" → no link (as-typed search finds nothing; no frame) · `SearchScreen.tsx:320-325`
- [ ] 12 → "Did you mean: reading comprehension?" → no link (the corrected results are not a frame) · `SearchScreen.tsx:330-334`
- [ ] 12, 12b, 13 → back arrow (top left) → 10 · Back · `SearchScreen.tsx:220-222`; `App.tsx:430`
- [ ] 12, 12b, 13 → header "Sign Out" → 27 · Open overlay · `SearchScreen.tsx:229-232`; `App.tsx:300-302`
- [ ] 13 → header moon button → `28 Dark – 13 Study Details` · Navigate · `SearchScreen.tsx:228`
- [ ] 13 → "View Summary (2)" → 14 · Open overlay · `SearchScreen.tsx:304-310`; `App.tsx:353-355, 435-442`
- [ ] 13 → Study Details "Citation" row → 15 · Navigate (zoom of the row) · `SearchScreen.tsx:458-461`
- [ ] 15 → whole frame → 13 · Back
- [ ] 13 → "Read full study" → no link (opens the real PDF in Google Drive) · `SearchScreen.tsx:447-450`
- [ ] 13 → similar study title (S2) → no link (S2's details are not a frame) · `SearchScreen.tsx:495`

### 14 Combined summary (overlay over 13)

- [ ] 14 → "×" (Close summary) → close · Close overlay · `CombinedSummaryPanel.tsx:53`
- [ ] 14 → "Close" → close · Close overlay · `CombinedSummaryPanel.tsx:119-123`
- [ ] 14 → click outside (backdrop) → close · Close overlay (overlay setting "Close when clicking outside") · `CombinedSummaryPanel.tsx:37`
- [ ] 14 → citation chip "(Bautista & Villanueva, 2025)" → 13 · Navigate (closes and jumps to S1) · `CombinedSummaryPanel.tsx:78-82`; `App.tsx:440`
- [ ] 14 → citation chip "(Galang, 2024)" → 13 · Navigate, shortcut (real: jumps to S2 and flashes it) · `CombinedSummaryPanel.tsx:78-82`; `App.tsx:440`

---

## 3. Staff flow (start: `16 Staff dashboard`, flow **Staff flow**)

### Staff header (draw once on `Header / Staff`; used by 16, 17, 19, 20, 21, 22, 22b, 24, 25)

- [ ] tab "Dashboard" → 16 · Navigate · `StaffDashboard.tsx:142-152`; `App.tsx:400`
- [ ] tab "Register" → 17 · Navigate · `StaffDashboard.tsx:142-152`
- [ ] tab "Search" → 26 · Navigate, shortcut (real: the Search screen on All Colleges, the same as 26; errata #91) · `StaffDashboard.tsx:145`; `App.tsx:405`; `SearchScreen.tsx:61`
- [ ] tab "Statistics" → 24 · Navigate · `StaffDashboard.tsx:142-152`
- [ ] tab "Settings" → 25 · Navigate · `StaffDashboard.tsx:142-152`
- [ ] avatar "MD" → 30 · Open overlay (Manual position, under the avatar) · `StaffDashboard.tsx:115-123`
- [ ] header "Sign Out" → 27 · Open overlay · `StaffDashboard.tsx:111-114`; `App.tsx:300-302`
- [ ] header moon button → `28 Dark – 16 Staff dashboard` (on 24: `28 Dark – 24 Statistics`) · Navigate · `StaffDashboard.tsx:110`

### 16 Staff dashboard

- [ ] 16 → "View all studies" → 26 · Navigate · `StaffDashboard.tsx:208-213`; `App.tsx:405`
- [ ] 16 → "Register study" → 17 · Navigate · `StaffDashboard.tsx:231-234`
- [ ] 16 → "Search e-library" → 26 · Navigate, shortcut (as the Search tab) · `StaffDashboard.tsx:235-238`
- [ ] 16 → "View details" on the S1 card → 13b · Navigate · `shared.tsx:190-194`; `App.tsx:406, 345-351`

### 30 Account menu (overlay)

- [ ] 30 → "Settings" → 25 · Navigate · `StaffDashboard.tsx:131-134`
- [ ] 30 → click outside → close · Close overlay · `StaffDashboard.tsx:77-84`

### 26 View all studies, 13b Study Details (staff)

- [ ] 26 → S1 title → 13b · Navigate · `SearchScreen.tsx:378-383`
- [ ] 26, 13b → back arrow → 16 · Back · `SearchScreen.tsx:220-222`; `App.tsx:430`
- [ ] 26, 13b → header "Sign Out" → 27 · Open overlay · `SearchScreen.tsx:229-232`
- [ ] 13b → "Edit" → 22 · Navigate · `SearchScreen.tsx:432-437`; `App.tsx:265-268, 428`
- [ ] 13b → "Delete" → 23 · Open overlay · `SearchScreen.tsx:438-443`; `App.tsx:429, 448-458`
- [ ] 13b → "Open in Drive" → no link (real Drive file) · `SearchScreen.tsx:428-431`

### 23 Delete this study? (overlay over 13b)

- [ ] 23 → "Cancel" → close · Close overlay · `ConfirmDialog.tsx:44`; `App.tsx:83`
- [ ] 23 → click outside → close · Close overlay · `ConfirmDialog.tsx:36`
- [ ] 23 → "Delete" (red) → 26 · Navigate · `ConfirmDialog.tsx:45`; `App.tsx:290-297` (real: toast "Study deleted" and S1 leaves the list; optional: point to a copy of 26 without S1)

### Edit: 22 → 22b

- [ ] 22 → "Cancel" → 13b · Navigate · `RegisterForm.tsx:767-773, 258-262`; `App.tsx:271-275`
- [ ] 22 → "Continue" → 22b · Navigate · `RegisterForm.tsx:1177-1181, 602-607`
- [ ] 22b → "Change PDF" → 22 · Navigate · `RegisterForm.tsx:767-773, 680-686`
- [ ] 22b → "Save changes" → 13b · Navigate · `RegisterForm.tsx:1155-1160`; `App.tsx:279-286` (real: toast "Study updated"; not rebuilt)

### Register: 17 → 18 → 19 → 20 → 21

- [ ] 17 → "Back to dashboard" → 16 · Navigate · `RegisterForm.tsx:767-773`; `StaffDashboard.tsx:253`
- [ ] 17 → "Read PDF & continue" → 18 · Navigate · `RegisterForm.tsx:1177-1181, 594-660`
- [ ] 17 → "Choose a different PDF" / "Paste" → no link (file chooser / clipboard) · `RegisterForm.tsx:824-828, 865-876`
- [ ] 18 → (frame) → 19 · After delay 1500 ms · `RegisterForm.tsx:622-657`
- [ ] 19 → "Change PDF" → 17 · Navigate · `RegisterForm.tsx:767-773, 680-686`
- [ ] 19 → check box "I checked — register anyway" → 20 · Navigate · `RegisterForm.tsx:1137-1143`
- [ ] 19 → "Show details" (on the S1 match) → 20 · Navigate, shortcut (20 has the details open) · `RegisterForm.tsx:1108-1110`
- [ ] 19 → "Confirm & Save" → no link (disabled until the box is ticked) · `RegisterForm.tsx:1155-1157, 1170-1172`
- [ ] 20 → "Hide details" → 19 · Navigate · `RegisterForm.tsx:1108-1110`
- [ ] 20 → "Change PDF" → 17 · Navigate · `RegisterForm.tsx:767-773`
- [ ] 20 → "Confirm & Save" → 21 · Navigate · `RegisterForm.tsx:1155-1160, 688-743`; `StaffDashboard.tsx:254`; `App.tsx:259-262`
- [ ] 21 → (frame) → 16 · After delay 3000 ms · `toast.ts:23`; `shared.tsx:223-227`

### 24 Statistics

- [ ] 24 → "Studies by college" bar "CCSICT" → 26 · Navigate, shortcut (real: Search filtered to CCSICT) · `DepartmentStats.tsx:41-55`; `StaffDashboard.tsx:265`
- [ ] 24 → "Top keywords" chip, e.g. "irrigation" → 26 · Navigate, shortcut (real: searches that keyword) · `DepartmentStats.tsx:83-87`; `StaffDashboard.tsx:266`

### 25 Settings

- [ ] 25 → Theme "Dark" → `28 Dark – 16 Staff dashboard` · Navigate, shortcut (real: the whole app turns dark and stays on Settings) · `StaffDashboard.tsx:293-299`; `ThemeToggle.tsx:53-68`
- [ ] 25 → "Sign Out" (red, bottom) → 27 · Open overlay · `StaffDashboard.tsx:300-303`; `App.tsx:300-302`

### 27 Sign out? (overlay, both flows)

- [ ] 27 → "Cancel" → close · Close overlay · `ConfirmDialog.tsx:44`; `App.tsx:74`
- [ ] 27 → click outside → close · Close overlay · `ConfirmDialog.tsx:36`
- [ ] 27 → "Sign Out" (red) → 01 · Navigate · `ConfirmDialog.tsx:45`; `SignOutDialog.tsx:7-12`; `App.tsx:305-308, 110-112`

---

## 4. Theme (dark frames)

- [ ] `28 Dark – 01 Sign in` → sun button → 01 · Navigate · `ThemeToggle.tsx:39-48`
- [ ] `28 Dark – 10 Student dashboard` → sun button → 10 · Navigate · `ThemeToggle.tsx:39-48`
- [ ] `28 Dark – 13 Study Details` → sun button → 13 · Navigate · `ThemeToggle.tsx:39-48`
- [ ] `28 Dark – 16 Staff dashboard` → sun button → 16 · Navigate · `ThemeToggle.tsx:39-48`
- [ ] `28 Dark – 24 Statistics` → sun button → 24 · Navigate · `ThemeToggle.tsx:39-48`
- [ ] `28 Dark – 01 Sign in` → "Sign in" → `28 Dark – 10 Student dashboard` · Navigate · `LoginScreen.tsx:235-237`
- [ ] `28 Dark – 10 Student dashboard` → "View details" (S1) → `28 Dark – 13 Study Details` · Navigate · `shared.tsx:190-194`

---

## 5. Phone frames (optional flow **Phone flow**)

- [ ] `29 Phone – 01 Sign in` → "Sign in" → `29 Phone – 10 Student dashboard` · Navigate · `LoginScreen.tsx:235-237`
- [ ] `29 Phone – 10 Student dashboard` → "Search" → `29 Phone – 12 Search results` · Navigate · `StudentDashboard.tsx:113-115`
- [ ] `29 Phone – 10 Student dashboard` → "View details" (S1) → `29 Phone – 13 Study Details` · Navigate · `shared.tsx:190-194`
- [ ] `29 Phone – 12 Search results`, `29 Phone – 13 Study Details` → back arrow → `29 Phone – 10 Student dashboard` · Back · `SearchScreen.tsx:220-222`
- [ ] `29 Phone – 16 Staff dashboard` → tab "Register" → `29 Phone – 19 Check & save` · Navigate, shortcut (17-18 not drawn at phone width) · `StaffDashboard.tsx:142-152`
- [ ] `29 Phone – 19 Check & save` → "Change PDF" → `29 Phone – 16 Staff dashboard` · Navigate, shortcut · `RegisterForm.tsx:767-773`

---

## 6. Count

- 111 tick boxes. Every frame in README §1 has a way in (a link or a flow start) and a way out, except 04 when Q4 = no.
- Flow starts:
  - **Student flow** (01) and **Staff flow** (16) are required.
  - Optional: **Used email link** (09), **Phone flow** (`29 Phone – 01 Sign in`), **Phone staff flow** (`29 Phone – 16 Staff dashboard`), **Dark flow** (`28 Dark – 01 Sign in`).
