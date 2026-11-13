# Wireframes: ISU Research Study E-Library (deliverable 3)

Low-fidelity, grayscale wireframes of every screen of the system. There is **one
wireframe for each frame of the clickable Figma prototype** (deliverable 4),
with the same number and name, so the two can be compared side by side.
They show layout, content and navigation only, not colours or styling. The
prototype shows those.

- **All wireframes in one file:** `ISU-E-Library-Wireframes.pdf` (cover page with
  the list, then one page per wireframe). Upload this to Drive.
- **One PNG per wireframe:** `NN-name.png` in this folder.
- Under every wireframe: **Clicks** (what each button or link opens, the same
  links as `docs/mockup/CLICK-MAP.md`) and **SRS** (the requirement IDs from
  the final SRS that the screen covers).
- Checked against the code on `main` at **761e35c** (errata up to **#91**:
  staff see every college). Where an older document disagrees, the code wins.
- Every name, title, email and number is the **made-up data set** of
  `docs/mockup/README.md` §2. There is no real study or person in them.
  Abstract text is drawn as grey lines, as usual in a wireframe.

## Legend

| In the wireframe | Means |
|---|---|
| Dark filled button | Main action (green in the real app) |
| White outlined button | Secondary action |
| Underlined bold text | Link |
| Dashed black outline button / black filled button | Delete or Sign Out (red in the real app) |
| Grey box with "ISU" | ISU seal |
| Grey lines | Body text (abstract) |
| Dark overlay over the page | Dialog (opens on top of the screen behind it) |
| Thick black border on a result | Ticked result |
| Striped box with a thick border | "Possible duplicate" warning (red in the real app) |
| `FROM PDF` / dashed `AUTO` tags | Filled from the PDF / keyword chosen automatically |

## Wireframe list

| # | Wireframe | File | SRS |
|---|---|---|---|
| 01 | Sign in | `01-sign-in.png` | FR-AUTH-01, 02, 08, 09, 13; AC-01, AC-02 |
| 02 | Create account | `02-create-account.png` | FR-AUTH-10, 12; AC-13 |
| 03 | Check your ISU inbox | `03-check-your-isu-inbox.png` | FR-AUTH-10; AC-13 |
| 04 | Email verified (Firebase page) | `04-email-verified-firebase-page.png` | FR-AUTH-10 |
| 05 | Forgot password | `05-forgot-password.png` | FR-AUTH-11, 13 |
| 06 | Forgot password – Check your ISU inbox | `06-forgot-password-check-your-isu-inbox.png` | FR-AUTH-11, 13; AC-16, AC-17 |
| 07 | Create a new password | `07-create-a-new-password.png` | FR-AUTH-10, 11; AC-16 |
| 08 | Password changed | `08-password-changed.png` | FR-AUTH-11 |
| 09 | This link no longer works | `09-this-link-no-longer-works.png` | FR-AUTH-11 |
| 10 | Student dashboard | `10-student-dashboard.png` | FR-STU-01, 02, 03, 05, 06; FR-AUTH-04, 06 |
| 11 | Search autocomplete | `11-search-autocomplete.png` | FR-SRCH-11; FR-STU-01 |
| 12 | Search results – Did you mean | `12-search-results-did-you-mean.png` | FR-SRCH-01, 02, 05, 08, 11, 12 |
| 12b | Search results – Showing results for | `12b-search-results-showing-results-for.png` | FR-SRCH-11, 12; AC-21 |
| 13 | Study Details (student) | `13-study-details-student.png` | FR-SRCH-08, 09, 12, 13, 14, 16; FR-SUM-01; AC-09 |
| 13b | Study Details (staff) | `13b-study-details-staff.png` | FR-SRCH-09, 13, 14, 15; FR-REG-10, 11 |
| 14 | Combined summary | `14-combined-summary.png` | FR-SUM-01 to 06; AC-11 |
| 15 | Citation row | `15-citation-row.png` | FR-SRCH-14 |
| 16 | Staff dashboard | `16-staff-dashboard.png` | FR-DASH-01, 02, 03, 06, 07 |
| 17 | Register – Choose PDF | `17-register-choose-pdf.png` | FR-REG-01, 02, 03; FR-PDF-01 |
| 18 | Register – Reading PDF | `18-register-reading-pdf.png` | FR-PDF-04 to 11; NFR-PERF-04 |
| 19 | Register – Check & save | `19-register-check-save.png` | FR-REG-04, 06, 07, 13, 14, 15; AC-05, AC-20, AC-22 |
| 20 | Register – Possible duplicate | `20-register-possible-duplicate.png` | FR-REG-06, 07, 08; AC-14 |
| 21 | Study posted! toast | `21-study-posted-toast.png` | FR-REG-09; FR-DASH-02, 03 |
| 22 | Edit study | `22-edit-study.png` | FR-REG-10, 12; AC-07 |
| 22b | Edit study – Check & save | `22b-edit-study-check-save.png` | FR-REG-10, 14, 15 |
| 23 | Delete this study? | `23-delete-this-study.png` | FR-REG-11; FR-SRCH-15; AC-07 |
| 24 | Statistics | `24-statistics.png` | FR-DASH-08; FR-REG-13 |
| 25 | Settings | `25-settings.png` | FR-DASH-05, 06; FR-AUTH-06; AC-15 |
| 26 | View all studies | `26-view-all-studies.png` | FR-SRCH-04, 05, 06 |
| 27 | Sign out? | `27-sign-out.png` | FR-AUTH-06 |
| 30 | Account menu (staff) | `30-account-menu-staff.png` | FR-DASH-05 |
| 29 | Phone 390 px: Sign in, Student dashboard, Search results, Study Details, Staff dashboard, Check & save | `29-01-…` to `29-19-…png` | AC-23 and the IDs of the matching desktop screen |

Prototype frame 28 (dark mode) has no wireframe: in grayscale it would look
the same as the light screens.

## Notes (what the code does)

- **Errata #91** (staff see every college): the staff dashboard counts "Total
  Studies", the Recent studies of every college, the "Research Staff" chip,
  Settings without a College row, staff Search starting on All Colleges and
  no "(mine)" mark in Statistics. The wireframes show this. The SRS rows
  FR-DASH-02, 03, 04, 05, 08 and FR-SRCH-06 still describe the
  older own-college behaviour until the owner edits them.
- **Edit study (22, 22b):** while a study is being edited **no tab is
  highlighted** (`StaffDashboard.tsx:141`, `!editing && activeTab === …`).
- **04:** the verification email opens Firebase's plain page, not an in-app
  screen (docs/17 §5).
- **15:** the citation is plain text. There is no copy button.

## How to change and rebuild

The wireframes are made from `src/wireframes.html` (plain HTML + one script
with the made-up data and one function per screen). Open it in a browser to
see every sheet, or add `?f=13` to the address to see one sheet.

To render the PNGs and the PDF again (needs Node 22+ and Chrome or Edge,
no packages):

```
node docs/wireframes/src/render.mjs
```
