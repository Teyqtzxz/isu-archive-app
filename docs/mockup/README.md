# Mockup: clickable Figma prototype of the whole system

**Deliverable 4.** A clickable Figma Design prototype of the ISU Research Study
E-Library, made from the **real live screens** (https://isu-elibrary.web.app),
with every real title, name, abstract, email and number replaced by the
**made-up data set** below.

- Code baseline: main 35322b0 (= a7d5ed9 code + docs/uml). Code is frozen; if
  this guide and the code disagree, the code wins.
- The owner does all Figma work. These files only guide it:
  - `README.md` (this file): what the mockup is, the frame list, the made-up
    data set, the privacy rules and the before-sharing checklist.
  - `FIGMA-GUIDE.md`: click-by-click steps (capturing, importing, replacing
    text, components, prototype links, overlays, flows, sharing).
  - `CLICK-MAP.md`: one tick box per prototype link, taken from the code.
- The earlier AI-generated Figma design does **not** match the system and is
  **not** this mockup.

> **⚠ OWNER TO CONFIRM (2 open answers, both handled below):**
> - **Q3: STAFF test account's college.** ~~This guide assumes **CCSICT**
>   ("CCSICT Staff").~~ **Since errata #91 staff see every college**: use the
>   texts marked **[no college]** in this file, with the chip "Research Staff"
>   (not "No college set"), stat card "Total Studies" and no Settings College row.
> - **Q4: an ISU address with no account yet.** If **yes**, frames 02 → 03 →
>   04 come from a real Create account. If **no**, see the fallback in
>   FIGMA-GUIDE.md §3 (frame 03 from a still-unverified test account, or
>   rebuilt).

---

## 1. Frame list

Frame names in Figma are exactly the **Name** column (for example
`01 Sign in`). **Acc.** = which test account the capture is made with.

| Frame | Name | Acc. | Source in the code | How it is made |
|---|---|---|---|---|
| 01 | Sign in | — | `src/components/LoginScreen.tsx:183-267` | capture |
| 02 | Create account | — | `LoginScreen.tsx:269-311` | capture (not submitted, unless Q4 = yes) |
| 03 | Check your ISU inbox | new address | `VerifyEmailScreen.tsx:97-138`; routed at `App.tsx:130-138` | capture |
| 04 | Email verified (Firebase page) | new address | Firebase's plain page; `docs/17-email-login.md:284-285, 409-414` | capture of Firebase's page + caption |
| 05 | Forgot password | — | `ForgotPassword.tsx:114-118, 147-166`; heading `LoginScreen.tsx:151` | capture (not sent) |
| 06 | Forgot password – Check your ISU inbox | STUDENT | `ForgotPassword.tsx:119-131, 168-180` | capture (1 sign-in link email) |
| 07 | Create a new password | STUDENT | `AuthActionScreen.tsx:200-241` | capture |
| 08 | Password changed | STUDENT | `AuthActionScreen.tsx:286-289` | capture (STUDENT test password really changes) |
| 09 | This link no longer works | STUDENT | `AuthActionScreen.tsx:170, 282-284`; text `src/auth.ts:50` | capture (variant b: used Forgot password link) |
| 10 | Student dashboard | STUDENT | `StudentDashboard.tsx:54-180`; glance `:140-149` | capture |
| 11 | Search autocomplete | STUDENT | `SmartSearchInput.tsx:112-131` | capture |
| 12 | Search results – Did you mean | STUDENT | `SearchScreen.tsx:329-334` | capture |
| 12b | Search results – Showing results for | STUDENT | `SearchScreen.tsx:313-327` | capture |
| 13 | Study Details (student) | STUDENT | `SearchScreen.tsx:420-505` (student buttons `:445-453`) | capture |
| 13b | Study Details (staff) | STAFF | `SearchScreen.tsx:426-444` | capture |
| 14 | Combined summary | STUDENT | `SearchScreen.tsx:304-310`; `CombinedSummaryPanel.tsx:36-125` | capture (overlay) |
| 15 | Citation row | STUDENT | `SearchScreen.tsx:458-461` | crop of 13 |
| 16 | Staff dashboard | STAFF | `StaffDashboard.tsx:100-243` | capture |
| 17 | Register – Choose PDF | STAFF | `RegisterForm.tsx:808-885, 1177-1182` | capture |
| 18 | Register – Reading PDF | STAFF | `RegisterForm.tsx:889-904` | screenshot or rebuild |
| 19 | Register – Check & save | STAFF | `RegisterForm.tsx:907-1172` | capture |
| 20 | Register – Possible duplicate | STAFF | `RegisterForm.tsx:38, 1089-1146` | capture, tick set **in Figma** |
| 21 | Study posted! toast | — | `App.tsx:259-262`; `shared.tsx:206-259`; `toast.ts:23` | **rebuilt** (needs a real save) |
| 22 | Edit study | STAFF | `StaffDashboard.tsx:159-165`; `RegisterForm.tsx:810-815, 1180` | capture |
| 22b | Edit study – Check & save | STAFF | `RegisterForm.tsx:920, 925, 1159` | capture |
| 23 | Delete this study? | STAFF | `App.tsx:448-458`; `ConfirmDialog.tsx:34-48` | capture (overlay), then Cancel |
| 24 | Statistics | STAFF | `StaffDashboard.tsx:260-272` | capture |
| 25 | Settings | STAFF | `StaffDashboard.tsx:274-305` | capture |
| 26 | View all studies | STAFF | `StaffDashboard.tsx:208-213`; `SearchScreen.tsx:301` | capture |
| 27 | Sign out? | either | `SignOutDialog.tsx`; `App.tsx:444-446` | capture (overlay), then Cancel |
| 28 | Dark mode: 01, 10, 13, 16, 24 | both | `ThemeToggle.tsx:39-48` | capture, named `28 Dark – 01 Sign in`, `28 Dark – 10 Student dashboard`, `28 Dark – 13 Study Details`, `28 Dark – 16 Staff dashboard`, `28 Dark – 24 Statistics` |
| 29 | Phone 390: 01, 10, 12, 13, 16, 19 | both | same components, phone CSS | capture, named `29 Phone – 01 Sign in`, `29 Phone – 10 Student dashboard`, `29 Phone – 12 Search results`, `29 Phone – 13 Study Details`, `29 Phone – 16 Staff dashboard`, `29 Phone – 19 Check & save` |
| 30 | Account menu (staff) | STAFF | `StaffDashboard.tsx:115-137` | capture (overlay) |

**Notes on what the code does (checked, keep these in mind):**

- **Frame 04.** On the live site the verification email opens **Firebase's
  plain page**, not our "Email verified" screen, because Google blocks the
  action URL change. Frame 04 shows that Firebase page, with the caption:
  *"the email link opens Firebase's page (action URL cannot be changed, docs/17 §5)"*.
  Our in-app "Email verified" screen is **not** in the mockup.
- **Frame 09** is the variant you get from a **used Forgot password link**:
  heading "This link no longer works", text from `src/auth.ts:50`, button
  **Send a new link**, which opens Forgot password (`App.tsx:321`). The
  variant for a used verification link is not reachable on the live site.
- **Frame 15** is part of Study Details. The citation is plain text; there is
  **no copy button**.
- **Frame 21.** The toast appears over the **staff Dashboard tab**, because
  saving goes back to it (`StaffDashboard.tsx:254`). It is green with a tick,
  has no ×, and stays 3 s (`toast.ts:23`).
- **The staff Search tab** opens the same Search screen, titled "Search
  E-Library", on All Colleges (errata #91; before it, filtered to the staff
  member's own college). In the prototype it links to 26 (see
  CLICK-MAP).
- **Wording kept exactly as the code has it (code frozen):**
  - The Sign out? dialog says "…sign in with your ISU Google account again…"
    (`SignOutDialog.tsx:10`), even for password users.
  - "I checked — register anyway" uses an em dash.

---

## 2. Made-up data set (use it in every frame, the same way everywhere)

### 2.1 Accounts

| | Name | Email | Masked email (frame 06) | Avatar |
|---|---|---|---|---|
| STUDENT | Juan Dela Cruz | juan.delacruz@isu.edu.ph | j•••@isu.edu.ph | JD |
| STAFF | Maria Dela Cruz | maria.delacruz@isu.edu.ph | — | MD |

- **New account for 02-04:** Juan Dela Cruz again (same made-up person).
- **STAFF label (errata #91):** chip and account menu **"Research Staff"**,
  stat card **"Total Studies"**; Settings rows Name, Email, Role, Theme (no
  College row). The old CCSICT / "No college set" texts no longer exist.
- "Juan Dela Cruz" is the app's own placeholder (`shared.tsx:298`,
  `LoginScreen.tsx:276`). None of these are real accounts.

### 2.2 Studies

The library holds **S1-S7**. **S8** is the new study being registered in
frames 17-21. Every name below is made up.

| | College (code) | Year | Title | Authors | Adviser(s) | Keywords | Date Posted |
|---|---|---|---|---|---|---|---|
| S1 | CCSICT | 2025 | A Mobile Application for Monitoring Rice Field Water Levels Using Low-Cost Sensors | Carlo M. Bautista; Andrea L. Villanueva | Dr. Ramon T. Agustin | mobile application, water level monitoring, rice farming, IoT sensors | October 3, 2026 |
| S2 | CA | 2024 | Growth Performance of Lowland Rice Varieties Under Alternate Wetting and Drying Irrigation | Maria Teresa D. Galang | Prof. Elena S. Domingo | alternate wetting and drying, lowland rice, irrigation, yield | September 15, 2026 |
| S3 | CED | 2025 | Effects of Gamified Quizzes on the Reading Comprehension of Grade 7 Learners | Joanna P. Ramos; Kevin A. Tolentino; Lea C. Mercado | Dr. Cecilia R. Navarro | gamification, reading comprehension, grade 7 learners, formative assessment | November 2, 2026 |
| S4 | CON | 2023 | Knowledge and Practices of Mothers on the Home Care of Children with Dengue Fever | Patricia G. Soriano | Dr. Liza M. Fernandez | dengue, home care, maternal knowledge, community health | August 20, 2026 |
| S5 | CBAPA | 2024 | Digital Payment Adoption Among Micro Retailers in a Rural Municipality | Mark Anthony R. Pascual; Shiela B. Ocampo | Dr. Victor J. Lazaro | digital payments, micro retailers, technology adoption, rural economy | October 21, 2026 |
| S6 | COE | 2023 | Design and Evaluation of a Solar-Powered Dryer for Corn Kernels | Jerome D. Castillo | Engr. Noel P. Santiago and Engr. Rina F. Aquino | solar dryer, corn drying, renewable energy, post-harvest | July 8, 2026 |
| S7 | IOF | 2025 | Growth of Nile Tilapia Fed with Fermented Azolla Meal | Daniel V. Mendoza | Dr. Grace A. Cabrera | Nile tilapia, azolla, fish feed, aquaculture | November 5, 2026 |
| S8 | CCSICT | 2026 | A Low-Cost Sensor-Based Mobile App for Monitoring Water Levels in Rice Fields | Nicole F. Reyes; Paolo J. Dizon | Dr. Ramon T. Agustin | from PDF: water level monitoring, mobile application · **auto:** rice fields, sensor network | — |

**Label rules:**
- S6 has two advisers, so its label is **"Advisers"** (`validation.ts:217`).
  All the others use "Adviser".
- One author → "Author: …". Two or more → "Authors: …", showing at most 2
  names, then "+1 more" (S3 on cards: "Authors: Joanna P. Ramos, Kevin A.
  Tolentino +1 more").
- Study Details lists every author, separated by "; ".
- College badges show the code (CCSICT). The Study Details "College" row
  shows the full name:
  - CA: College of Agriculture
  - CAS: College of Arts and Sciences
  - CBAPA: College of Business, Accountancy and Public Administration
  - CCJE: College of Criminal Justice Education
  - CCSICT: College of Computing Studies, Information and Communication Technology
  - CED: College of Education
  - COE: College of Engineering
  - COM: College of Medicine and Allied Health Professions
  - CON: College of Nursing
  - CGS: Central Graduate School
  - IOF: Institute of Fisheries
  - SVM: School of Veterinary Medicine
- Cards on dashboards show "Posted Oct 3, 2026" (short month). Study Details
  shows "October 3, 2026".

### 2.3 Abstracts (made up)

- **S1.** Farmers in irrigated lowland areas often check field water levels by walking every paddy, which takes time and misses sudden changes. This study developed a mobile application that reads low-cost ultrasonic sensors placed in rice fields and shows the water level of each paddy on a phone. The system sends an alert when the water falls below a level set by the farmer. Field testing in three paddies over four weeks showed readings within two centimeters of manual measurement, and farmers rated the application as easy to use.
- **S2.** Alternate wetting and drying is a water-saving irrigation practice for lowland rice. This study compared the growth and yield of three lowland rice varieties grown under alternate wetting and drying and under continuous flooding. Plant height, number of tillers and grain yield were recorded over one wet season. Alternate wetting and drying used less irrigation water while the yield of two varieties did not differ significantly from continuous flooding.
- **S3.** Reading comprehension remains a concern among junior high school learners. This study measured the effect of short gamified quizzes, given at the end of each reading lesson, on the reading comprehension of Grade 7 learners. A pretest and posttest design with a control group was used over eight weeks. Learners who took the gamified quizzes gained significantly higher posttest scores and reported more interest in the reading lessons.
- **S4.** Dengue fever remains common among children in rural communities. This study described the knowledge and home care practices of mothers whose children had dengue fever. A survey questionnaire was answered by one hundred mothers from four barangays. Most mothers knew the warning signs of dengue, but fewer practiced proper fluid intake monitoring, so the study recommends community health sessions on home care.
- **S5.** Digital payments are spreading among small businesses, but adoption in rural areas is uneven. This study examined the factors that influence the adoption of digital payment services among micro retailers in a rural municipality. Data from one hundred twenty retailers were analyzed using the technology acceptance model. Perceived usefulness and the availability of mobile signal were the strongest factors in adoption.
- **S6.** Sun drying of corn kernels on roads is slow and exposes the grains to dirt and rain. This study designed and evaluated a solar-powered dryer with a fan driven by a small solar panel. Drying tests compared the dryer with open sun drying using the same amount of corn. The dryer reduced the moisture content to the safe storage level two hours faster than open sun drying and kept the kernels clean.
- **S7.** Feed is the largest cost in tilapia farming. This study tested fermented azolla meal as a partial replacement for commercial feed for Nile tilapia. Fish were fed diets with zero, twenty-five and fifty percent fermented azolla meal for sixty days. Fish fed twenty-five percent azolla meal grew as well as the control group at a lower feed cost.
- **S8.** Checking water levels in rice fields by hand takes time for farmers. This study built a low-cost mobile app that uses water level sensors in rice fields and shows the level of each paddy on the farmer's phone. The app warns the farmer when the water level drops below a chosen level. Testing in rice fields showed sensor readings close to manual measurements, and farmers found the app easy to use.

### 2.4 Numbers that follow from this set

Replace **every** real number with these, so all frames agree.

| Where | Made-up value |
|---|---|
| Search screen count pill | **7 studies** |
| College chips (frame 10) | CA 1, CAS 0, CBAPA 1, CCJE 0, CCSICT 1, CED 1, COE 1, COM 0, CON 1, CGS 0, IOF 1, SVM 0 |
| Studies by college bars (10, 24) | the same counts; meta "7 total" |
| Top keywords (10, 24) | one chip per keyword of S1-S7, each with count **1** (show as many chips as the capture has room for) |
| Recently added (10) | S7, S3, S5, S1, S2, S4 (newest first, 6 cards) |
| Staff dashboard (16), every college (errata #91) | Total Studies **7**, Added this month **2**, Added this year **7**; "7 total"; cards: S7, S3, S5, S1, S2, S4 |
| Frame 21 (after S8 is posted) | Total Studies **8**, Added this month **3**, Added this year **8**; "8 total"; cards S8, S7, S3, S5, S1, S2 |
| View all studies (26) | "7 studies, newest first": S7, S3, S5, S1, S2, S4, S6 (no relevance %) |
| Statistics (24): Studies by year | 2023: 2, 2024: 2, 2025: 3 (meta "Academic Year") |
| Statistics (24): Added per month | Jul 2026: 1, Aug: 1, Sep: 1, Oct: 2, Nov: 2 |
| Statistics (24): Top advisers | each adviser of S1-S7 with **1** |
| Statistics (24): Keyword model | **7** training studies, **28** known keywords, keep the warning "Fewer than 30 studies with keywords — not reliable yet."; "7 studies tested, 0 copies hidden"; At least one correct keyword: Model 29%, Baseline 14%; Precision: Model 7%, Baseline 4%; Recall: Model 7%, Baseline 4% |
| Frame 11: type **"ric"** | suggestion 1: **rice** · Title · 2 studies; suggestion 2: **rice farming** · Keyword · 1 study |
| Frame 12: type **"raeding comprehension"** (two letters swapped = 2 edits, so only a button) | "Did you mean: **reading** comprehension?"; "1 result for “raeding comprehension”"; result 1 = S3, **100%** |
| Frame 12b: type **"irrigaton"** (1 letter missing) | "Showing results for **irrigation**"; "Search instead for “irrigaton”"; "1 result for “irrigation”"; result 1 = S2, **100%** |
| Frame 13 (student) | query **"rice"** → "2 results for “rice”": S1 100%, S2 64%; **both ticked**, so **View Summary (2)** shows; S1's Study Details open. Similar studies: S2, "2024 · 21% similar", shared key terms: rice, water |
| Frame 13b (staff) | "7 studies, newest first" list (from 26) with S1's Study Details open (Open in Drive / Edit / Delete); similar studies as in 13; nothing ticked |
| Frame 14 | over frame 13: "Summary of 2 Results" for “rice” |
| Frame 14 summary text | "This study developed a mobile application that reads low-cost ultrasonic sensors placed in **rice** fields and shows the water level of each paddy on a phone (Bautista & Villanueva, 2025). Alternate wetting and drying is a water-saving irrigation practice for lowland **rice** (Galang, 2024)." |
| Frame 14 References | "Bautista, C. M., & Villanueva, A. L. (2025). *A Mobile Application for Monitoring Rice Field Water Levels Using Low-Cost Sensors* [Unpublished research study]. Isabela State University – Echague Campus." · "Galang, M. T. D. (2024). *Growth Performance of Lowland Rice Varieties Under Alternate Wetting and Drying Irrigation* [Unpublished research study]. Isabela State University – Echague Campus." |
| Frame 14 Key Terms | mobile application, water level monitoring, rice farming, IoT sensors, alternate wetting and drying, lowland rice, irrigation, yield |
| Frame 15 Citation (S1) | "Bautista, C. M., & Villanueva, A. L. (2025). *A Mobile Application for Monitoring Rice Field Water Levels Using Low-Cost Sensors* [Unpublished research study]. Isabela State University – Echague Campus." |
| Frame 17 Drive link box | `https://drive.google.com/file/d/SAMPLE-FILE-ID/view` |
| Frame 17 chosen file chip | `sample-study.pdf` |
| Frame 18 progress line | "Reading page 5 (up to 40)…" · "From this computer" |
| Frame 19 | S8's details, every field with the **from PDF** tag; keywords "water level monitoring", "mobile application", then "rice fields" **auto** and "sensor network" **auto**; abstract word count "**71 words**" |
| Frame 20 | heading "Possible duplicate — this study may already be registered"; match = S1, "2025 · 86% similar overall"; shared key terms: water, level, rice, sensor; "I checked — register anyway" **ticked** (set in Figma); Confirm & Save **enabled** |
| Frame 22 / 22b | editing S1 (22b: "Ready to save:", "Current details, abstract and keywords kept — edit if needed", **Save changes**) |
| Frame 23 | "Delete this study?", bold line = S1's title |
| Staff Today date (16) | the capture day as shown (a date is not private) |

---

## 3. Privacy rules

1. **The RAW captures file stays private.** Import every capture into a
   separate Figma file named **"ISU E-Library – RAW captures (PRIVATE)"**.
   Never share it, never invite anyone to it. Copy only cleaned frames into
   the shareable file **"ISU E-Library – Mockup"**. Version history and
   undo keep old text, so the raw file must never be the shared one.
2. **The captures come from the REAL live library.** Search frames therefore
   use words that exist in the real studies at capture time. Afterwards,
   **every** real text **and number** is replaced with the made-up set:
   - titles, author and adviser names, abstracts, snippets, keywords
   - counts, percentages, citations, years, dates
   - emails, the masked email, initials in the avatar
   - Drive links, file names
3. **Never** use "THESIS FINAL MANUSCRIPT.pdf" for any capture. Use only the
   UP Open University sample PDFs.
4. **Email frames (03, 04, 06-09) only with the owner's own test accounts.**
   The address bar is never captured: html.to.design captures only the page.
   For screenshots, crop to the page. A sign-in link or `oobCode` must never
   appear in any frame, file, chat or commit.
5. **Five sign-in link emails per day** for the whole project (free plan). The
   plan uses **one** (frame 06). Do not press Resend link; past the limit,
   Forgot password sends Firebase's plain reset email instead.
6. **Nothing real is saved, edited or deleted:**
   - Never press **Confirm & Save**, **Save Manually**, **Save changes** or
     **Delete** (red, in the dialog).
   - Dialogs are captured, then **Cancel**. The red **Sign Out** in the
     Sign out? dialog is pressed only to end your own test session when
     switching accounts, never while capturing frame 27.
   - Leave Register and Edit with **Change PDF → Back to dashboard** or
     **Cancel**.
   - The duplicate tick is set in Figma, not in the live app.
7. **The only real changes allowed:**
   - The STUDENT test account's password (frame 08).
   - If Q4 = yes: one new STUDENT account from Create account (frames 02-04).
     It gets a STUDENT profile when it first reaches the dashboard.
8. No real name, email, link or thesis text goes into this repository.

### 3.1 Before-sharing checklist (tick every row in the **Mockup** file, not the RAW file)

For each frame, check that nothing real is left. **"Generic"** = no study text
at all; then check only the email, initials and dates.

| Frame | Check before sharing |
|---|---|
| 01, 02, 05 | [ ] typed username/name are the made-up ones (or empty) · [ ] no password visible (dots only) · [ ] footer year fine |
| 03 | [ ] email = juan.delacruz@isu.edu.ph · [ ] no countdown text needs hiding (it may show "Resend email (NNs)": fine) |
| 04 | [ ] Firebase page shows no real email · [ ] no address bar, no `oobCode`, no project URL · [ ] caption added |
| 06 | [ ] masked email = j•••@isu.edu.ph |
| 07 | [ ] "For **juan.delacruz@isu.edu.ph**" · [ ] password boxes show dots only |
| 08, 09 | [ ] generic text only · [ ] no address bar |
| 10 | [ ] avatar JD · [ ] every card = S1-S7 · [ ] chip counts and bars = §2.4 · [ ] top keywords = made-up · [ ] "Posted …" dates = §2.2 |
| 11 | [ ] typed "ric" and both suggestions = §2.4 |
| 12, 12b | [ ] typed words, correction, result count, %, title, authors, adviser, snippet, keywords = §2.4 · [ ] count pill "7 studies" |
| 13, 13b, 15 | [ ] citation, authors, adviser(s), college, Date Posted, keywords, abstract, similar studies = S1 · [ ] other result cards on the page = made-up |
| 14 | [ ] heading, query, summary sentences, citation chips, references, key terms = §2.4 · [ ] the page behind the dim = made-up |
| 16, 21 | [ ] name Maria Dela Cruz · [ ] avatar MD · [ ] college label (Q3) · [ ] stat numbers and cards = §2.4 |
| 17 | [ ] Drive link = SAMPLE-FILE-ID · [ ] file chip = sample-study.pdf |
| 18 | [ ] progress text = §2.4 · [ ] no real file name |
| 19, 20 | [ ] every field = S8 · [ ] keywords and auto tags = §2.4 · [ ] abstract = S8 · [ ] duplicate match = S1 · [ ] % and shared terms = §2.4 · [ ] "Show details" text (if open) = S1 |
| 22, 22b | [ ] Drive link = SAMPLE-FILE-ID · [ ] every field = S1 |
| 23 | [ ] bold line = S1 title · [ ] page behind = made-up |
| 24 | [ ] every bar, column, label, adviser name, keyword and model number = §2.4 |
| 25, 30 | [ ] name, email, college (Q3) = made-up |
| 26 | [ ] 7 cards in the order of §2.4 · [ ] "7 studies, newest first" |
| 27 | [ ] the page behind the dim = made-up |
| 28 (dark), 29 (phone) | [ ] the same checks as the frame they copy |
| Whole file | [ ] RAW file not shared · [ ] search the Mockup file (Ctrl+F) for "@isu.edu.ph", "drive.google", "oobCode", "apiKey", and for each real surname you remember: nothing real is found · [ ] the prototype link is "can view" only |
