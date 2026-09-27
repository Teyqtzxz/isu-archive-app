# 03 — Backend: Firebase Setup, Auth, Roles, Security Rules

**Status:** ☐ DONE
**Owner:** A · **Depends on:** 02 · **Next:** 04

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Set up Firebase:
> config file, real Google sign-in with the `@isu.edu.ph` check, role routing,
> session restore, sign out on every screen. Write the security rules file to
> `firestore.rules` — do not paste anything into the console. Do not start step 04."*

---

## 1. Manual setup — you must do this first

The AI cannot do any of §1. Do these in the Firebase console, in order.

1. https://console.firebase.google.com → **Add project**
   - Name: `isu-thesis-archive`
   - Disable Google Analytics
2. **Add a Web App** (`</>` icon) — name `isu-archive-web`
3. Copy the `firebaseConfig` object. You will paste it into `src/firebase.ts`.
4. **Authentication → Sign-in method → Google → Enable**
5. **Firestore Database → Create** — Production mode, nearest region
   (`asia-southeast1`)
6. **Authentication → Settings → Authorized domains → Add domain**, and add:
   - `isu-thesis-archive.web.app`
   - `isu-thesis-archive.firebaseapp.com`
   - `localhost` is already there by default

### Why step 6 is not optional

Firebase only accepts sign-in from allowlisted origins. A deployed `.web.app` URL
is not on the list until you add it, and the symptom is
`auth/unauthorized-domain` — the live app appears completely broken while
`localhost` still works. Add the domains now, before you ever deploy.

> The `apiKey` in the config is **public by design** for web apps. It is not a
> secret. The real protection is the security rules in §6.

---

## 2. Install

```bash
npm install firebase
```

---

## 3. `src/firebase.ts`

Create it, with your pasted config:

```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "…",
  authDomain: "isu-thesis-archive.firebaseapp.com",
  projectId: "isu-thesis-archive",
  storageBucket: "isu-thesis-archive.appspot.com",
  messagingSenderId: "…",
  appId: "…",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Commit this file. The apiKey is public, so this is safe.

---

## 4. Real Google sign-in

`LoginScreen` currently shows two buttons (`Staff` / `Student`) that just set a
role in state. Replace them with one real sign-in button.

**In `src/data.ts`** (the only module allowed to import Firestore):

```typescript
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import type { AccountRole } from "./types";

const ISU_DOMAIN = "@isu.edu.ph";

/** Resolve the account to a role, creating a STUDENT profile on first login. */
export async function getRoleForUser(uid: string): Promise<AccountRole> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().role === "STAFF" ? "STAFF" : "STUDENT";
  }
  await setDoc(
    ref,
    { role: "STUDENT", department: "", createdAt: serverTimestamp() },
    { merge: true },
  );
  return "STUDENT";
}

export async function signInWithGoogle(): Promise<AccountRole> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  if (!user.email?.toLowerCase().endsWith(ISU_DOMAIN)) {
    await signOut(auth);
    throw new Error("Please sign in with your ISU Google account (@isu.edu.ph).");
  }

  const role = await getRoleForUser(user.uid);
  await setDoc(
    doc(db, "users", user.uid),
    { email: user.email, displayName: user.displayName ?? "" },
    { merge: true },
  );
  return role;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
```

`prompt: "select_account"` matters for testing: without it Google silently reuses
the last signed-in account, so switching between your staff and student test
accounts appears not to work.

**In `LoginScreen.tsx`** — one button, and surface the error:

```typescript
const [error, setError] = useState("");
const [busy, setBusy] = useState(false);

async function handleSignIn() {
  setError("");
  setBusy(true);
  try {
    const role = await signInWithGoogle();
    onSignedIn(role);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Sign-in failed. Try again.");
  } finally {
    setBusy(false);
  }
}
```

Do not use `alert()`. Render the message on the screen.

### 4a. Mobile fallback: use a redirect if popups are blocked

`signInWithPopup` opens a new window. iOS Safari and some mobile browsers block
it, and the user gets a dead button with no error. If you hit this during testing,
switch to the redirect flow:

```typescript
import { signInWithRedirect, getRedirectResult } from "firebase/auth";

// call instead of signInWithPopup
await signInWithRedirect(auth, provider);
```

Then on app boot, before `onAuthStateChanged`:

```typescript
const result = await getRedirectResult(auth).catch(() => null);
```

`signInWithRedirect` reloads the page, so it is a bigger change than the popup —
only do it if you have confirmed the popup is actually blocked on your target
devices.

---

## 5. Session restore and role routing

**In `App.tsx`:**

```typescript
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { getRoleForUser } from "./data";

useEffect(() => {
  const unsub = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setRole(null);
      setScreen("login");
      return;
    }
    try {
      const r = await getRoleForUser(user.uid);
      setRole(r === "STAFF" ? "staff" : "student");
      setScreen(r === "STAFF" ? "staff-dashboard" : "student-dashboard");
    } catch {
      // Firestore unreachable — fall back to the least-privileged view
      setRole("student");
      setScreen("student-dashboard");
    }
  });
  return unsub;
}, []);
```

The `return unsub` is the cleanup. Without it you leak a listener on every render
and the app re-runs the callback repeatedly.

Defaulting to `"student"` when the lookup fails is deliberate: if the role cannot
be confirmed, show the read-only view. Never default to staff.

---

## 6. Sign out — must work on every screen

`signOut(auth)` makes `onAuthStateChanged` fire with `null`, which sets
`screen = "login"` automatically. There is no other teardown needed.

Remove the prototype's fake logout / `page.reload()` logic.

Wire it at:

- **Mobile (< 768px):** avatar tap → dropdown → "Sign Out"
- **Tablet/desktop (≥ 768px):** the visible "Sign Out" button in the header
- **Staff dashboard, register screen, search screen, summary panel, student
  dashboard** — all five

---

## 7. `firestore.rules` — write this file

Create `firestore.rules` in the project root, and paste the same content into
Firestore → Rules.

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function isStaff() {
      return signedIn()
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'STAFF';
    }

    match /users/{uid} {
      allow read: if signedIn();

      // Create only your own profile, and only as a STUDENT.
      allow create: if request.auth.uid == uid
                    && request.resource.data.role == 'STUDENT';

      // Update your own profile, but the role may never change.
      allow update: if request.auth.uid == uid
                    && request.resource.data.role == resource.data.role;

      allow delete: if false;
    }

    match /theses/{thesisId} {
      allow read: if signedIn();                          // staff AND students
      allow create, update, delete: if isStaff();        // staff only
    }
  }
}
```

### The two lines that matter most

`allow update: if request.auth.uid == uid && request.resource.data.role == resource.data.role;`

Without the `role` comparison, a signed-in STUDENT can open the Firestore console
and set `role: "STAFF"` on their own document. From that moment `isStaff()`
returns true and they can write to `theses`. The app never does this — but rules
are the security boundary, and anyone can call Firestore directly.

`resource` is the stored document; `request.resource` is the incoming write.
Comparing them is what makes `role` immutable.

The matching `create` rule pins new accounts to `STUDENT`, so a crafted request
cannot create a document that is already staff.

### What these rules guarantee

- Nothing is readable without signing in.
- Students can search and view abstracts, and nothing else.
- Only `STAFF` can register, edit or delete a thesis.
- A user can edit their own name and department, never their own role.

---

## 8. Making someone STAFF

There is no admin UI. To promote a tester, from the console or via `setMyRole()`
in `src/seed.ts`:

```typescript
await setMyRole("<their uid>", "STAFF", "CAS");
```

You can read a uid from Authentication → Users.

**You will need at least two accounts** to test roles properly. Google sign-in
uses one account per browser profile, so use a normal window for one account and
an incognito window for the other. A private window in Chrome, Edge and Firefox
are separate profiles from each other.

---

## 9. Verification

Run the **Rules Playground** (Firestore → Rules → Playground). All four, not just
the first two:

| Simulation | Expected |
|------------|----------|
| Student writes to `theses` | **denied** |
| Staff writes to `theses` | **allowed** |
| Student updates own doc, `role` unchanged | **allowed** |
| Student updates own doc, `role: "STAFF"` | **denied** |

Row 4 is the one that proves the escalation hole is closed.

Then in the app:

- [ ] `npm run build` passes
- [ ] Login screen shows one Google button, no role picker
- [ ] Signing in with a non-ISU account is rejected with a visible message
- [ ] Signing in with an ISU account lands on the correct dashboard for the role
- [ ] Refreshing the page keeps you signed in
- [ ] Sign Out works from all five screens, including the mobile avatar dropdown
- [ ] `users` collection contains your uid
- [ ] No `alert()` and no `page.reload()` left in the auth code

**Cannot be verified on the deployed URL yet** — that needs step 08.

---

**Next:** `04-frontend.md` — load live data and save real documents.
