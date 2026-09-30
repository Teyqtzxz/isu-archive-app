# 04 — Frontend: Module Split, Live Data, Theme, Responsive Header

**Status:** Part 2 (live data) ☑ DONE — 2026-09-30, verified by hand: live
load, department filter, save as ARCHIVED / NEEDS_REVIEW, Mark as Archived,
realtime update from the console, student view. Parts 3–4 (theme, header — C)
☑ DONE — merged in PR #9. A check on a real phone with a notch is still worth
doing before the demo.

### How the shipped Parts 3–4 differ from the sketches below

- **Tokens** live in `src/index.css`: the six ISU colours unchanged, plus a
  neutral grey scale, radii, shadows, focus ring, `--container` and `--gutter`,
  and the `--header-*` safe-area variables with `--header-h` at 56/60/64px.
- **The header is `position: sticky`, in normal flow**, not fixed. Content can
  therefore never sit under it at any breakpoint, and there is no
  `.main-content` top padding to keep in sync — one fewer place for the
  "hardcoded in two places" bug §4.2 warns about. Side padding and the notch
  inset still come from `--header-left/right/top`.
- Sign Out is a visible header button at ≥768px (`.header-signout`) and in the
  avatar menu below that — on the staff dashboard, student dashboard **and**
  the search screen (the step 03 gap is closed).
- Emoji icons were replaced by one stroke-icon set (`Icon` in `shared.tsx`).
- Status badges follow `09` §3: ARCHIVED green, NEEDS REVIEW yellow, DRAFT gray.
- The summary panel is a bottom sheet on phones and a centred 640px dialog from
  768px, and closes on Esc.
- The page title comes from `.figma/make/site.json` (`title`).
**Owner:** A (data) + C (CSS) · **Depends on:** 03 · **Next:** 05

### How the shipped Part 2 differs from the sketches below

- `saveThesis(t: NewThesis, status)` — `NewThesis` is a named type in
  `types.ts`. `deleteThesis` was not added: nothing calls it yet.
- `App.tsx` shows a thin banner: "Loading the thesis archive…" until the first
  snapshot, and a red error if the listener fails — so loading, failure and an
  empty archive all look different.
- `RegisterForm` (C's file) got the one change this step needs: it calls
  `onSave(thesis, status)` with `ARCHIVED` for "Confirm & Save" and
  `NEEDS_REVIEW` for "Save Manually", shows save errors, and disables the button
  while saving. The PDF mock is untouched — that is step 06.
- "Mark as Archived" appears on every pending row (`isPending`: NEEDS_REVIEW
  and DRAFT) in the staff dashboard.
- The staff dashboard filters to the signed-in user's department; with no
  department set it shows everything, and says so.

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. **Part 1 is
> already done — the module split shipped in commit `c5644d4`; do not redo it.**
> Implement Part 2 only: extend the existing `src/data.ts` (it already has the
> step 03 auth functions) to load theses from Firestore and save new ones, then
> wire it into `App.tsx`. Do not start step 05."*

Part 1 below is kept as a record of the module split. It is done.

---

# Part 1 — Split `App.tsx` into modules

## ✅ DONE — 2026-09-27, commit `c5644d4`

This part is **complete and merged into `main`. Do not redo it.** It was done as
a single pure-move commit so the diff reads as a move and nothing else.

What exists now:

| File | Lines | Was |
|------|-------|-----|
| `src/App.tsx` | 87 | 1333 — now state and screen routing only |
| `src/types.ts` | 19 | — |
| `src/data.ts` | 108 | — |
| `src/search.ts` | 103 | — |
| `src/components/shared.tsx` | 58 | — |
| `src/components/LoginScreen.tsx` | 105 | — |
| `src/components/StaffDashboard.tsx` | 192 | — |
| `src/components/RegisterForm.tsx` | 227 | — |
| `src/components/StudentDashboard.tsx` | 134 | — |
| `src/components/SearchScreen.tsx` | 244 | — |
| `src/components/CombinedSummaryPanel.tsx` | 98 | — |

Two deliberate differences from the target layout in §1.2:

- The shared file is `shared.tsx`, not `ui.tsx`.
- The summary screen is `CombinedSummaryPanel.tsx`, not `SummaryPanel.tsx`.
  Renaming it would collide with the file-ownership split in
  `10-group-work-split.md`, and the existing name is accurate.

Start this file at **Part 2**.

---

## 1.1 Why this was not optional cleanup

`src/App.tsx` was one 1,333-line file containing six screens, the search engine,
the extraction mock and every component. If three people edit it concurrently you
get conflicts on every commit and lost work.

Code was moved **verbatim** — no rename, restyle, improvement or fix — and that
was verified rather than assumed: a line-by-line comparison of the original
against all 11 new files reports **1191 code lines in, 1191 out**, with none
missing, none added, and none appearing more often than before. `tsc --noEmit`
is clean, `npm run build` passes, the bundle is the same 265.31 kB, all 12
modules resolve through Vite with no circular imports, and every screen renders.

## 1.2 Layout as it is now

```
src/
  types.ts  firebase.ts  data.ts  seed.ts  search.ts     ← exist
  summary.ts (step 07)  extractPdf.ts (step 06)            ← not yet
  App.tsx             ← screen state + routing ONLY
  components/
    LoginScreen.tsx  StaffDashboard.tsx  RegisterForm.tsx
    SearchScreen.tsx  StudentDashboard.tsx  CombinedSummaryPanel.tsx
    shared.tsx        ← ISUSeal, StatusBadge, DeptBadge, Toast, STATUS_LABELS
```

`App.tsx` renders screens with `{screen === "…" && <… />}` blocks, and the Register
form is a tab inside `StaffDashboard`, not its own screen. Keep that.

`shared.tsx` is **shared — nobody edits it** except C's safe-area additions, and
only additively. Ownership of every other file is in `10` §2.

---

# Part 2 — Live data

## 2.1 Screen state machine

`App.tsx` holds:

| State | Purpose |
|-------|---------|
| `screen` | which screen is shown |
| `role` | `null` until auth resolves, then `"staff"` / `"student"` |
| `theses: Thesis[]` | live data from Firestore |
| `searchInitialQuery` | query handed from a dashboard into the search screen |
| `summaryData` | the results the summary panel was opened for |
| `toast` | transient message |

Navigation:

```
Login
 ├─ STAFF   → Staff Dashboard (tabs: Dashboard / Register / Search / Settings)
 │            ├─ Register tab      → Register screen
 │            └─ Search tab        → Search screen
 └─ STUDENT → Student Dashboard (hero search) → Search screen

Search screen ─ tick results ─ "View Summary (N)" → Summary panel (slide-up) ─ Close → back
Any screen ─ Sign Out → Login (auth handles it, no extra code)
```

## 2.2 `src/data.ts` — the only module that talks to Firestore

No component may import `firebase/firestore` directly. That single rule is what
keeps the search and summary modules pure and testable.

```typescript
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { registeredAtISO, type Thesis, type ThesisStatus } from "./types";

/** Realtime. Every open dashboard updates the moment staff save a thesis. */
export function subscribeToTheses(
  onData: (theses: Thesis[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, "theses"),
    (snap) => {
      onData(
        snap.docs
          // "estimate": a just-saved doc's serverTimestamp() is still pending
          // locally; without this it reads as null and sorts to the bottom.
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }) as Thesis)
          .sort((a, b) => registeredAtISO(b).localeCompare(registeredAtISO(a))),
      );
    },
    (err) => onError?.(err),
  );
}

/** Status is passed in, never decided here. */
export async function saveThesis(
  t: Omit<Thesis, "id" | "status" | "registeredAt" | "registeredBy">,
  status: ThesisStatus,
): Promise<string> {
  const ref = await addDoc(collection(db, "theses"), {
    ...t,
    status,
    registeredBy: auth.currentUser?.uid ?? "",
    registeredAt: serverTimestamp(),
  });
  return ref.id;
}

/** The "Mark as Archived" action on a NEEDS_REVIEW row. */
export async function updateThesisStatus(id: string, status: ThesisStatus): Promise<void> {
  await updateDoc(doc(db, "theses", id), { status });
}

export async function deleteThesis(id: string): Promise<void> {
  await deleteDoc(doc(db, "theses", id));
}
```

**Never sort on `registeredAt` directly.** An earlier version of this snippet
did `(b.registeredAt ?? 0).valueOf() - …`. A Firestore `Timestamp.valueOf()`
returns a *string*, so the subtraction is `NaN` and the list comes out in
arbitrary order. `registeredAtISO()` handles all three shapes.

**Status review.** A `NEEDS_REVIEW` row in the staff dashboard table gets one
small "Mark as Archived" button (A owns `StaffDashboard`) that calls
`updateThesisStatus(id, "ARCHIVED")`. Without it a manually entered thesis can
never leave "Pending Review". The rules already allow staff updates.

## 2.3 Wire it into `App.tsx`

```typescript
const [theses, setTheses] = useState<Thesis[]>([]);
const [dataError, setDataError] = useState<string | null>(null);

useEffect(() => {
  if (!role) return;                      // do not subscribe before sign-in
  return subscribeToTheses(
    setTheses,
    (err) => setDataError(err.message),
  );
}, [role]);
```

Two details that matter:

- **Guard on `role`.** The rules deny all reads to signed-out users, so
  subscribing before auth resolves produces a permission error on every page load.
- **The `onSnapshot` return value is the unsubscribe function.** Returning it from
  the effect is the cleanup. Without it you leak a listener per role change.

Handle `dataError`: show a banner, not an empty screen. An empty thesis list and a
failed load look identical otherwise, and "no theses yet" is a misleading thing to
show a user who cannot sign in.

Students and staff both subscribe to the same collection. Staff additionally
filter by their own department in the UI — a client-side filter, not a different
query.

**Where the staff department comes from.** Extend `getRoleForUser` (step 03) to
return `{ role, department }` from `users/{uid}`, keep `department` in `App.tsx`
state, and pass it to `StaffDashboard` and `SearchScreen`. It is one of the exact
`DEPARTMENTS` strings (`02` §3). Replace the hardcoded "CAS Department Staff"
badge in `StaffDashboard` with it. Remove `SAMPLE_THESES` from `App.tsx`'s
initial state — start with `[]`.

---

# Part 3 — Theme

## 3.1 ISU colours — do not change these

From the ISU Corporate Visual Identity Manual:

| Token | Hex | Usage |
|-------|-----|-------|
| `--isu-green` | `#006439` | primary buttons, header bar, badges |
| `--isu-green-light` | `#F0F8F4` | card backgrounds |
| `--isu-yellow` | `#F7D000` | warnings, highlight bar |
| `--isu-yellow-light` | `#FFF8E1` | keyword highlight in summary |
| `--isu-red` | `#CD202B` | errors, remove chip |
| `--isu-blue` | `#23305B` | secondary/outline, titles, dept badges |

```css
:root {
  --isu-green: #006439;
  --isu-green-light: #F0F8F4;
  --isu-yellow: #F7D000;
  --isu-yellow-light: #FFF8E1;
  --isu-red: #CD202B;
  --isu-blue: #23305B;
}
```

The prototype already uses these values inline. Replace inline hex with the
variables as you go; do not do a repo-wide find-and-replace in this step.

---

# Part 4 — Responsive header

## 4.1 One header for every device

The design must survive a Dynamic Island, a punch-hole camera, no notch at all, a
tablet, and a 1440px desktop.

| Device | Behaviour |
|--------|-----------|
| < 640px | 56px + safe-area-top. Truncated title. Avatar only (tap → Sign Out). Tabs scroll horizontally. |
| 640–1023px | 60px + safe-area-top. Full title. Avatar + visible Sign Out. |
| 1024–1365px | 64px. Full title + breadcrumb (staff). |
| ≥ 1366px | 64px, centred container, max-width ~1400px. |

## 4.2 `index.css`

The header height lives in **one** variable. The header and the content padding
both read it, so they cannot drift apart:

```css
:root {
  --header-top: env(safe-area-inset-top, 0);
  --header-bottom: env(safe-area-inset-bottom, 0);
  --header-left: env(safe-area-inset-left, 0);
  --header-right: env(safe-area-inset-right, 0);

  --header-h: 56px;
}
@media (min-width: 640px)  { :root { --header-h: 60px; } }
@media (min-width: 1024px) { :root { --header-h: 64px; } }

.header-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--isu-green);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: calc(var(--header-h) + var(--header-top));
  padding-left: calc(16px + var(--header-left));
  padding-right: calc(16px + var(--header-right));
  padding-top: var(--header-top);
}

.signout-button { display: none; }
@media (min-width: 768px) { .signout-button { display: inline-flex; } }

.main-content {
  padding-top: calc(var(--header-h) + var(--header-top) + 16px);
  padding-bottom: calc(16px + var(--header-bottom));
  padding-left: calc(16px + var(--header-left));
  padding-right: calc(16px + var(--header-right));
}
```

Never hardcode a pixel height in both the header and the padding. That is how the
content ends up sliding under the bar at one specific breakpoint.

## 4.3 Header variants to check

- Staff: dashboard page, register page, search page (with tabs)
- Student: dashboard page, search page (no tabs)
- Summary: white header, green text, Close X

---

# Part 5 — PWA / offline (optional, do last)

Only if time allows. See `08-deployment.md` §4.

---

## 6. Verification

- [ ] `npm run build` passes
- [x] The split commit changed **no** behaviour — search results, ranking and every
      screen look identical before and after (Part 1, done)
- [x] No screen component remains inside `App.tsx` (Part 1, done)
- [ ] `grep -rn "firebase/firestore" src/components/` returns nothing
- [ ] Add a document in the Firestore console → it appears in the UI without a refresh
- [ ] Registering a thesis writes a document and shows a toast
- [ ] "Pending Review" goes up by 1 after a **Save Manually** (proves status is
      passed in, not hardcoded)
- [ ] "Mark as Archived" on that row brings it back down by 1
- [ ] A newly saved thesis appears at the **top** of the list immediately, not
      the bottom (proves the `serverTimestamps: "estimate"` sort)
- [ ] The staff badge shows the signed-in user's department, not "CAS"
- [ ] At 375×667 with a 48px top inset the header logo and title are fully visible
- [ ] At 768px the Sign Out button is visible; below 768px it is not
- [ ] At 1024px the content does not sit under the header
- [ ] Colours match the palette in §3.1

---

**Next:** `05-search-ranking.md` — debounce, filters and empty states.
