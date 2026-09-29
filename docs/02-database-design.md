# 02 — Database Design (Cloud Firestore)

**Status:** ☐ TODO
**Owner:** A · **Depends on:** 01 · **Next:** 03

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Extend
> `src/types.ts` to the target schema, create `src/seed.ts`, and write down the
> Firestore schema. **Section 5 is already done — do not redo the status
> migration.** Do not start step 03."*

---

## 1. Task

Two collections, no subcollections, no relations beyond a user id reference.
Nothing to run in the console yet — step 03 creates the project. You are writing
the types and the seed script now so step 04 can wire them up.

**Files to create:** `src/seed.ts`
**Files to modify:** `src/types.ts`

`src/types.ts` **already exists** and already exports `STATUSES`, `ThesisStatus`,
`Thesis` and `isPending`. **Extend it to the target schema in §2 — do not
rewrite it from scratch**, or you will lose the `ExtractionState` lowercase
warning comment and every existing import.

Nothing in `src/App.tsx` needs changing. It is 87 lines of routing and state,
and the status migration it used to be responsible for already landed.

---

## 2. `src/types.ts`

Extend the file that is already there. These types are the contract for the whole
app.

**Keep as-is, do not touch:** `STATUSES`, `ThesisStatus`, `isPending`, and
`ExtractionState` with its lowercase warning comment. All four are already
shipped and already imported by six components.

**To change:** add `registeredBy` and `registeredAt` to `Thesis`, and replace
the current `dateAdded` field.

**One decision for you:** this spec puts `DEPARTMENTS` in `src/types.ts`, but
today it lives in `src/data.ts` and is imported by `RegisterForm.tsx`. Moving it
touches three files and is not required for anything else in this step. Either
move it and update all three imports, or leave it in `data.ts` and note the
deviation here. **Whichever you pick, do not leave two `DEPARTMENTS`
definitions** — two copies is how the filter values and the badge labels drift
apart.

```typescript
import type { Timestamp } from "firebase/firestore";

/** The only three legal values. Uppercase, always. */
export const STATUSES = ["ARCHIVED", "NEEDS_REVIEW", "DRAFT"] as const;
export type ThesisStatus = (typeof STATUSES)[number];

export interface Thesis {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  department: string;
  year: number;
  adviser: string;
  driveLink: string;
  status: ThesisStatus;
  registeredBy: string;
  registeredAt: Timestamp | string | null;
}

export type Role = "staff" | "student";
export type Screen =
  | "login"
  | "staff-dashboard"
  | "register"
  | "search"
  | "summary"
  | "student-dashboard";
export type StaffTab = "dashboard" | "register" | "search" | "settings";
export type ExtractionState = "idle" | "extracting" | "success" | "needs_review";

/** True for both statuses that mean "not finished". Use everywhere, so the
 *  dashboard stat, the table sort and the Status filter cannot disagree. */
export function isPending(t: { status: ThesisStatus }): boolean {
  return t.status === "NEEDS_REVIEW" || t.status === "DRAFT";
}

export const DEPARTMENTS = [
  "Biology", "Agriculture", "Computer Science", "Forestry",
  "Chemical Engineering", "Environmental Science", "Education",
  "Business Administration", "Civil Engineering", "Nursing",
] as const;
```

---

## 3. Collection `users/{uid}`

One document per signed-in user, keyed by Firebase Auth UID.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `email` | string | `staff.cas@isu.edu.ph` | full Google email |
| `displayName` | string | `"Maria Santos"` | from Google profile |
| `role` | string | `"STAFF"` | `"STAFF"` or `"STUDENT"` |
| `department` | string | `"CAS"` | staff only |
| `createdAt` | timestamp | — | first-created date |

On first login the app creates this document with `role: "STUDENT"`. An account
is **never** created as staff. Promotion happens by editing the document from the
console or with the helper below.

---

## 4. Collection `theses/{thesisId}`

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `title` | string | `"Biodiversity Assessment..."` | from PDF or manual |
| `abstract` | string | long text | auto-extracted by pdf.js (step 06) |
| `keywords` | array\<string\> | `["biodiversity", "Cagayan River"]` | auto-extracted, editable |
| `department` | string | `"Biology"` | must be one of `DEPARTMENTS` |
| `year` | number | `2024` | academic year |
| `adviser` | string | `"Dr. Maria Santos"` | |
| `driveLink` | string | `https://drive.google.com/...` | the share link staff pasted |
| `driveFileId` | string | `"1ABC..."` | parsed from `driveLink` |
| `status` | string | `"ARCHIVED"` | one of `STATUSES` || `registeredBy` | string | `"uid_of_staff"` | who saved it |
| `registeredAt` | timestamp | — | when saved |
| `extractedAt` | timestamp | — | when the PDF was read |

### Status flow

A pasted-but-unsaved thesis lives only in the form and is **never written to
Firestore**. The status is decided by which button the staff member pressed:

| Status | Set when |
|--------|----------|
| `ARCHIVED` | PDF read successfully, staff pressed "Confirm & Save" |
| `NEEDS_REVIEW` | staff pressed "Save Manually" (PDF unreadable or scanned) |
| `DRAFT` | staff saved a partial record |

`department`, `year` and `status` are used as filter values, so their strings
must be identical everywhere. Always read them from `DEPARTMENTS` / `STATUSES`
rather than retyping them.

---

## 5. Migrate the prototype's status values

## ✅ DONE — 2026-09-27

Shipped in the commit titled *"Refactor: migrate thesis status enum to
uppercase, add PR guide"*. (`git log --oneline`. A commit cannot record its own
hash, so it is named by subject — grep for it.)

The **code** half of this section is complete and merged. Do not redo it.

The prototype used lowercase values that did **not** match the schema: its
`"pending"` means `DRAFT` here. Its badge maps were keyed on the lowercase
strings, so leaving this unmigrated would have meant unstyled status badges.

What was changed, in the post-split layout:

| Location | From | To |
|----------|------|-----|
| `src/types.ts` | `"archived" \| "pending" \| "needs_review"` | `STATUSES` const + `ThesisStatus` type |
| `src/data.ts` — 6 seeds | `"archived"` | `"ARCHIVED"` |
| `src/data.ts` — 1 seed | `"pending"` | `"DRAFT"` |
| `src/data.ts` — 1 seed | `"needs_review"` | `"NEEDS_REVIEW"` |
| `shared.tsx` — badge class map | `archived` / `pending` / `needs_review` | `ARCHIVED` / `DRAFT` / `NEEDS_REVIEW` |
| `shared.tsx` — badge label map | two separate inline maps | one exported `STATUS_LABELS`, shared with the filter pills |
| `StaffDashboard.tsx` — `stats.pending` | `t.status === "pending" \|\| t.status === "needs_review"` | `isPending(t)` from `./types` |
| `SearchScreen.tsx` — status filter pills | hardcoded `["archived", "pending", "needs_review"]` | `STATUSES` from `./types` |
| `RegisterForm.tsx` — save call | `status: "archived"` hardcoded | `status: "ARCHIVED"` (still hardcoded — see below) |

`STATUSES`, `isPending` and `ThesisStatus` are imported from `../types` rather
than re-declared. `src/types.ts` now holds the one `Thesis` interface.

### Two decisions worth knowing

1. **The status filter pills used to build their own label** with
   `s.charAt(0).toUpperCase() + s.slice(1)`. On `"ARCHIVED"` that yields
   `"ARCHIVED"` — all caps, a visible regression. They now read `STATUS_LABELS`,
   the same map the badge uses, so the two can never drift apart again.
2. **`ExtractionState` was left lowercase.** It is `"idle" | "extracting" |
   "success" | "needs_review"` and is UI workflow state, not stored data — a
   different thing that happens to share a word with `NEEDS_REVIEW`. There is a
   comment on it in `types.ts` saying so, because uppercasing it "for
   consistency" is an obvious and wrong cleanup.

### Still outstanding

- **`RegisterForm` still hardcodes `"ARCHIVED"` on save.** The review step is
  supposed to choose `ARCHIVED` on "Confirm & Save" and `NEEDS_REVIEW` on
  "Save Manually". Passing the status in as a parameter is **step 04 work**, not
  part of this migration.
- **CSS class names were not renamed.** `DRAFT` still maps to `.status-pending`
  in `App.css` so that no CSS changed. Only the enum keys moved. Person C may
  rename the class in their styling pass; it is cosmetic.

---

## 6. `src/seed.ts`

```typescript
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Thesis, ThesisStatus } from "./types";

/** The prototype's 8 sample theses, converted to the real schema. */
const THESES_TO_SEED: Array<Omit<Thesis, "id" | "registeredAt">> = [
  {
    title: "Biodiversity Assessment of Macro-invertebrates in Cagayan River Tributaries",
    abstract: "…copy the real abstract from the prototype's SAMPLE_THESES…",
    keywords: ["biodiversity", "macroinvertebrates", "Cagayan River", "water quality"],
    department: "Biology", year: 2024, adviser: "Dr. Maria Santos",
    driveLink: "https://drive.google.com/file/d/REPLACE/view",
    status: "ARCHIVED", registeredBy: "", driveFileId: "",
  },
  // …7 more, same shape
];

export async function seedTheses(): Promise<number> {
  let n = 0;
  for (const t of THESES_TO_SEED) {
    await addDoc(collection(db, "theses"), {
      ...t,
      status: t.status satisfies ThesisStatus,
      registeredAt: serverTimestamp(),
    });
    n++;
  }
  return n;
}

export type AccountRole = "STAFF" | "STUDENT";

export async function setMyRole(
  uid: string,
  role: AccountRole,
  department = "",
): Promise<void> {
  await setDoc(doc(db, "users", uid), { role, department }, { merge: true });
}
```

Replace the placeholder abstracts with the real text from the prototype's
`SAMPLE_THESES`, and add **more than 8** — aim for 20. Eight records makes the
search look unconvincing and there is little to rank against.

Use `serverTimestamp()`, not `new Date()`, so every document shares the server's
clock. "This Month" counts and newest-first sorting are only correct if client
clocks are not trusted.

---

## 7. Queries the app will need

| Query | Firestore call |
|-------|----------------|
| Load all theses (realtime) | `collection(db, "theses")` + `onSnapshot` |
| Register a thesis | `addDoc(collection(db, "theses"), …)` |
| Get a user's role on login | `getDoc(doc(db, "users", uid))` |
| Create own profile | `setDoc(doc(db, "users", uid), {…}, { merge: true })` |

All filtering happens **client-side in the browser** — that is the design, not an
oversight. Search, department, year and status filters all run over the in-memory
array. The dataset is hundreds of documents, so this is instant and free.

You should not need any composite index. If Firestore ever demands one, add it
then.

---

## 8. Sample document

```json
{
  "title": "Biodiversity Assessment of Macro-invertebrates in Cagayan River",
  "abstract": "This study assessed the biodiversity of macro-invertebrates…",
  "keywords": ["biodiversity", "macroinvertebrates", "Cagayan River", "water quality"],
  "department": "Biology",
  "year": 2024,
  "adviser": "Dr. Maria Santos",
  "driveLink": "https://drive.google.com/file/d/1ABC…/view",
  "status": "ARCHIVED",
  "registeredBy": "staffUid123",
  "registeredAt": "2026-01-10T08:00:00.000Z"
}
```

---

## 9. Verification

Done as of the enum migration (`02` §5):

- [x] `npm run build` passes with zero TypeScript errors
- [x] `src/types.ts` exports `STATUSES`, `ThesisStatus`, `Thesis` and `isPending`
- [x] No lowercase status value survives anywhere in `src/`, and the only
      remaining `needs_review` is inside `ExtractionState` — a UI workflow state,
      not a thesis status

  Check it yourself. **Note this must be case-sensitive** — PowerShell's
  `-Pattern` is not, and a case-insensitive search reports `"ARCHIVED"` as a
  hit and looks like a failure:

  ```powershell
  # Windows / PowerShell
  Select-String -Path (Get-ChildItem src -Recurse -Include *.ts,*.tsx).FullName `
    -Pattern '"archived"|"pending"|"needs_review"' -CaseSensitive
  ```

  ```bash
  # macOS / Linux — grep is already case-sensitive
  grep -rn '"archived"\|"pending"\|"needs_review"' src/
  ```

  Expected result: only the `ExtractionState` declaration in `src/types.ts` and
  its four use sites in `RegisterForm.tsx`. Anything else is a bug.
- [x] Every status badge still renders in its colour (the class map is keyed on
      the uppercase values, and each badge still emits a `status-*` modifier)
- [x] The staff status filter offers exactly three pills, labelled
      `Archived`, `Needs Review`, `Draft` — one per `STATUSES` entry
- [x] The "Pending Review" dashboard stat still counts 2, i.e. `isPending`
      matches the same two theses the old string comparison did

Still to check once this step's remaining work is done:

- [ ] `src/seed.ts` compiles
- [ ] `src/data.ts` exports `DEPARTMENTS` and `ADVISERS` (it holds them today;
      step 03 may move them, so confirm before relying on the import)

**Cannot be verified until step 03** (no Firebase project yet): that the seed
actually writes 20 documents, and that `setMyRole` promotes your account.

---

**Next:** `03-backend-firebase.md` — create the project, then wire auth and rules.
