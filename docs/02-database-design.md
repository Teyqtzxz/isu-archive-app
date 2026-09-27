# 02 — Database Design (Cloud Firestore)

**Status:** ☐ DONE
**Owner:** A · **Depends on:** 01 · **Next:** 03

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Create the Firestore
> schema, write `src/types.ts` and `src/seed.ts`, and migrate the prototype's status
> values to the canonical uppercase enum. Do not start step 03."*

---

## 1. Task

Two collections, no subcollections, no relations beyond a user id reference.
Nothing to run in the console yet — step 03 creates the project. You are writing
the types and the seed script now so step 04 can wire them up.

**Files to create:** `src/types.ts`, `src/seed.ts`
**Files to modify:** `src/App.tsx` (status values only)

---

## 2. `src/types.ts`

Create it. These types are the contract for the whole app.

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

The prototype uses lowercase values that do **not** match the schema: its
`"pending"` means `DRAFT` here. Its badge maps are keyed on the lowercase strings,
so leaving this unmigrated means unstyled status badges.

Change these, in `src/App.tsx`:

| Location | From | To |
|----------|------|-----|
| `Thesis` status union (~line 18) | `"archived" \| "pending" \| "needs_review"` | import `ThesisStatus` from `./types` |
| `SAMPLE_THESES` entries (~33, 45, 57, 69, 81, 105) | `"archived"` | `"ARCHIVED"` |
| the one `"needs_review"` seed (~117) | `"needs_review"` | `"NEEDS_REVIEW"` |
| badge class map (~196, 198) | `archived` / `needs_review` | `ARCHIVED` / `NEEDS_REVIEW` / `DRAFT` |
| badge label map (~201, 203) | same | same |
| `stats.pending` filter (~352) | `t.status === "pending" \|\| t.status === "needs_review"` | `isPending(t)` |
| Status filter dropdown (~959, 962) | `["archived", "pending", "needs_review"]` | `STATUSES` from `./types` |
| save call (~560) | `status: "archived"` hardcoded | pass status in as a parameter — see step 04 |

Import `STATUSES`, `isPending` and `ThesisStatus` from `./types` rather than
re-declaring them. Delete the local `Thesis` interface from `App.tsx`.

Do this as **one commit**, separate from feature work. It touches many lines and is
much easier to review alone.

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

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `src/types.ts` exists and exports `STATUSES`, `ThesisStatus`, `Thesis`, `isPending`, `DEPARTMENTS`
- [ ] `grep -n '"archived"\|"pending"\|"needs_review"' src/App.tsx` returns **nothing** (excluding `ExtractionState`, whose `needs_review` is a UI state, not a thesis status)
- [ ] Every status badge still renders in its colour after the migration
- [ ] The Status filter dropdown lists exactly `ARCHIVED`, `NEEDS_REVIEW`, `DRAFT`
- [ ] `src/seed.ts` compiles

**Cannot be verified until step 03** (no Firebase project yet): that the seed
actually writes 20 documents, and that `setMyRole` promotes your account.

---

**Next:** `03-backend-firebase.md` — create the project, then wire auth and rules.
