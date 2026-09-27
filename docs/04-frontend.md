# 04 — Frontend: Module Split, Live Data, Theme, Responsive Header

**Status:** ☐ DONE
**Owner:** A (data) + C (CSS) · **Depends on:** 03 · **Next:** 05

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file in two parts.
> Part 1: split `src/App.tsx` into the target module layout, moving code without
> changing behaviour. Part 2: create `src/data.ts` to load theses from Firestore
> and save new ones. Do not start step 05."*

This file is bigger than the others because it contains a **refactor that must
happen before three people work in parallel.** Do Part 1 even if you are working
alone.

---

# Part 1 — Split `App.tsx` into modules

## 1.1 Why this is not optional cleanup

`src/App.tsx` is one ~1,270-line file containing six screens, the search engine,
the extraction mock and every component. If three people edit it concurrently you
will get conflicts on every commit and lost work.

Move code **verbatim**. Do not rename, restyle, "improve", or fix anything while
moving — that makes the diff unreviewable. This commit should be a pure move.

## 1.2 Target layout

```
src/
  types.ts            ← create (step 02)
  firebase.ts         ← create (step 03)
  data.ts             ← create (§3.2 below)
  seed.ts             ← create (step 02)
  search.ts           ← create (step 05)
  summary.ts          ← create (step 07)
  extractPdf.ts       ← create (step 06)
  App.tsx             ← screen state machine + routing ONLY
  components/
    LoginScreen.tsx  StaffDashboard.tsx  RegisterForm.tsx
    SearchScreen.tsx  StudentDashboard.tsx  SummaryPanel.tsx
    ui.tsx            ← ISUSeal, StatusBadge, DeptBadge, Toast
```

Move each existing component to its own file. `App.tsx` keeps the `Screen` state
machine, the auth effect, the `theses` state, the toast, and the navigation map.

```typescript
switch (screen) {
  case "login":            return <LoginScreen onSignedIn={…} />;
  case "staff-dashboard":  return <StaffDashboard … />;
  case "register":         return <RegisterForm … />;
  case "search":           return <SearchScreen … />;
  case "summary":          return <SummaryPanel … />;
  case "student-dashboard":return <StudentDashboard … />;
}
```

`ui.tsx` is **shared — nobody edits it** except C's safe-area additions. It is the
one file that is allowed to be touched by more than one person, and only additively.

## 1.3 Commit it separately

```
refactor: split App.tsx into per-screen modules (no behaviour change)
```

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
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Thesis, ThesisStatus } from "./types";

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
          .map((d) => ({ id: d.id, ...d.data() }) as Thesis)
          .sort((a, b) => (b.registeredAt ?? 0).valueOf() - (a.registeredAt ?? 0).valueOf()),
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

export async function deleteThesis(id: string): Promise<void> {
  await deleteDoc(doc(db, "theses", id));
}
```

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
- [ ] The split commit changed **no** behaviour — search results, ranking and every
      screen look identical before and after
- [ ] No screen component remains inside `App.tsx`
- [ ] `grep -rn "firebase/firestore" src/components/` returns nothing
- [ ] Add a document in the Firestore console → it appears in the UI without a refresh
- [ ] Registering a thesis writes a document and shows a toast
- [ ] "Pending Review" goes up by 1 after a **Save Manually** (proves status is
      passed in, not hardcoded)
- [ ] At 375×667 with a 48px top inset the header logo and title are fully visible
- [ ] At 768px the Sign Out button is visible; below 768px it is not
- [ ] At 1024px the content does not sit under the header
- [ ] Colours match the palette in §3.1

---

**Next:** `05-search-ranking.md` — debounce, filters, and the "Why this rank?" panel.
