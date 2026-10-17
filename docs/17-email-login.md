# 17 — Email + Password Login (for the defense)

**Status:** ◐ BUILT — branch `feat/email-password-login` (errata #68). The
browser test of §3 case B (password account, then Continue with Google) and
the console steps in §6 are still to be done by the owner.
**Code:** `src/auth.ts` (pure: rules, messages, Firebase error code → words)
· examples in `src/auth.check.ts` (`node src/auth.check.ts`) · Firebase calls
in `src/data.ts` (auth section) · UI in `src/components/LoginScreen.tsx`
(Sign in, Create account, Forgot password), `ForgotPassword.tsx`,
`VerifyEmailScreen.tsx` ("Check your ISU inbox"), `AuthActionScreen.tsx`
(the page an email link opens) · routing in `src/App.tsx`
(`routeSignedInUser`).

The professor's requirement: **users log in with their email and password in
text fields.** "Continue with Google" stays next to it and works as before.
Everything runs in the browser on Firebase Authentication's free Spark plan —
no server, no Cloud Functions, no new library.

---

## 1. Why a system password, and not the Gmail password

**No Google API lets another website check a Google (ISU Gmail) password.**
Google only accepts that password on its own sign-in page — that is what the
"Continue with Google" popup is. A site that asked for the Gmail password in
its own form would be doing exactly what phishing pages do, and Google would
still not let it check the answer.

So the password typed in our form is a **system password** for this
e-library only:

| | Gmail (ISU Google) password | E-library (system) password |
|---|---|---|
| Typed on | Google's page (Continue with Google) | our login form |
| Checked by | Google | Firebase Authentication (Email/Password provider) |
| Changed by | the university / Google | Forgot password? in the e-library |
| Changing one changes the other? | **no** | **no** |

The Create account form says so under the password box: *"At least 8
characters. Not your Gmail password."*

**Proof that the user owns the ISU address** is the verification link Firebase
emails to that ISU inbox. Only someone who can open that inbox can verify the
account, and `firestore.rules` gives an unverified account nothing (§4).

### Where the passwords are stored

- **Only in Firebase Authentication, hashed.** Firebase stores a salted hash
  (its own modified scrypt), never the password itself. Nobody can read it
  back — not the Research Department, not the developers, not the Firebase
  console (the console's user list has no password column).
- **Never in Firestore.** `users/{uid}` holds `role`, `department`, `email`,
  `displayName` and `createdAt` — no password field.
- **Never in `localStorage` / `sessionStorage`, never in a log.** A password
  lives only in the form's React state while the form is open and goes
  straight to Firebase over HTTPS. The only things logged are error codes
  (`[email-link] auth/invalid-action-code`), never a typed value or a link.
- What the browser keeps after sign-in is Firebase's **session token**
  (IndexedDB), as with Google sign-in today — not the password.

---

## 2. The screens and flows

### Login card

```
 Email or ISU username   [ juan.delacruz        @isu.edu.ph ]
 Password                [ ••••••••                    (eye) ]
                         [            Sign in               ]
 Forgot password?                              Create account
 ─────────────────────────── or ───────────────────────────
                         [ G   Continue with Google         ]
```

- Typing only the username (`juan.delacruz`) adds `@isu.edu.ph`
  (`toIsuEmail()`); a full ISU address works too.
- **Every password box has its own show/hide (eye) button** — Sign in,
  both boxes of Create account, and both boxes of the new-password screen.
- While a request runs, Sign in / Create account / Send reset link / Resend
  and Continue with Google are disabled, and a guard (`inFlight` ref) ignores
  a second click before the screen re-renders, so a double click never sends
  twice.

### Sign in

Email + password → `signInWithEmailAndPassword` → App.tsx's auth listener:
unverified → "Check your ISU inbox"; verified → profile → dashboard (the
role comes from `users/{uid}`, as for Google).

### Create account

```
 Full name          [ Juan Dela Cruz ]           ← optional field (owner's call)
 ISU email          [ juan.delacruz  @isu.edu.ph ]
 Password           [ ••••••••            (eye) ]
                    At least 8 characters. Not your Gmail password.
 Confirm password   [ ••••••••            (eye) ]
                    The passwords don't match.   ← under its own field
                    [        Create account      ]
```

1. The form checks every field **before** calling Firebase (`auth.ts`):
   full name (the Register form's author-name rules), ISU email, password
   ≥ 8, passwords match. Each message sits under its own field.
2. `createUserWithEmailAndPassword` — Firebase creates the account **and signs
   the user in**.
3. `updateProfile(displayName)` — so the dashboards greet them by name.
4. `sendEmailVerification` — the link goes to the ISU inbox.
5. The listener sees `emailVerified = false` → **"Check your ISU inbox"**:
   - **I've verified** → `reload()` + `getIdToken(true)` → dashboard. No
     second sign-in. If the link was not clicked yet: *"Not verified yet. Open
     the link in your ISU inbox first."* under the button.
   - **Resend email** (60 s cooldown) · **Use a different account** (signs out).
6. The `users/{uid}` profile is created on that first verified routing, by the
   same `getUserProfile()` as Google, **always as `STUDENT`**. Staff are still
   promoted in the Firebase console (`03` §8).

The forced token refresh in step 5 matters: the rules read `email_verified`
from the ID token, and without `getIdToken(true)` the old token (with
`false`) is used for up to an hour and every read is denied.

**A signed-in but unverified account never sees a dashboard** — App.tsx
routes it to "Check your ISU inbox" before reading the profile.

### Forgot password

① ISU email → ② *"If an account exists for j•••@isu.edu.ph, we sent a link…"*
(the **same words** for an email with no account) → ③ the link opens our
"Create a new password" screen → "Password changed" → Sign in.

This is also how:
- a **Google-only** user adds a password (§3 case A), and
- the **real owner takes back** an account someone else created with their
  email (§3 case B2).

A link works for 1 hour and only once; each new request cancels the older
links. An old or used link shows "This link no longer works" + **Send a new
link**.

### Continue with Google

Unchanged: the first Google sign-in creates the account and the profile as
`STUDENT`; no Create account needed. ISU Google accounts are always verified.

---

## 3. One person = one account (Google and password together)

Firebase's default setting **"Link accounts that use the same email"** (one
account per email address) means one email can never become two Firebase
users. Firebase's documentation lists Google as a **trusted** provider only
for `@gmail.com`; for other domains — ours is `@isu.edu.ph` — it is listed as
**untrusted**, and an email/password account **without** verification is
untrusted too. That decides what happens:

| Case | What Firebase does | What the app does | Same uid? |
|---|---|---|---|
| **A.** Used Google, now wants a password | Forgot password → the link sets a password on the **existing** user | nothing special | yes |
| **B.** Created a password account, later Continue with Google | Either **(B1)** Google *replaces* the password method ("the trusted provider overwrites the untrusted provider"), or **(B2)** `auth/account-exists-with-different-credential` | B1: nothing — Forgot password? adds the password back. B2: the "connect Google" notice below | yes |
| **C.** Create account with an email that already has a Google account | `auth/email-already-in-use` | "This ISU email already has an account. Sign in, or use Forgot password? to set a password." under the email box | — (no second account) |

### Case B2: the "connect Google" notice

`signInWithGoogle()` keeps Google's credential **in memory only** (a reload
forgets it) and the login card shows:

> **juan.delacruz@isu.edu.ph** already has an e-library password. Sign in with
> it once below to connect Google to the same account. Don't know this
> password? Use **Forgot password?** to set a new one through your ISU inbox,
> then sign in here.

After that password sign-in, `linkWithCredential` joins Google to the same
user: from then on both methods reach the same uid, profile and role.

**Why the notice offers Forgot password?** The real owner may *not* know that
password: **someone else may have created the account with their email**
(Create account accepts any `@isu.edu.ph` address). That person still cannot
use it — without the owner's inbox they cannot verify it, and the rules deny
every read to an unverified account. The owner takes it back through their
own inbox:

1. Forgot password? (the email is pre-filled) → link to the owner's ISU inbox.
2. Setting a new password replaces the other person's password. Firebase
   treats a password change as a major account change and **ends that
   account's other sessions**.
3. The owner signs in with the new password, verifies if asked, and presses
   Continue with Google again → the notice → sign in once → Google connected.

### Which branch does our project take? (case B, real browser test)

**Result: _not tested yet_** — fill in after `09` §1 "Case B" with a **new**
test ISU account (never an owner or staff account):

- [ ] B1 — Google replaced the password (old password → "Email or password is
      incorrect."; Forgot password? works; same dashboard).
- [ ] B2 — the "connect Google" notice appeared; after the password sign-in,
      Google and password both reach the same dashboard.

In both cases the Firebase console (Authentication → Users) must show **one**
row for that email with one User UID. Record the date and which box was
ticked here and in errata #68.

---

## 4. The rules

| Rule | Where | Notes |
|---|---|---|
| Password **≥ 8 characters** (code points; spaces count, nothing trimmed) | `checkNewPassword()` (browser) **and** the console's password policy (§6 step 4) | Firebase's own default minimum is 6; the console policy makes 8 a server rule. Both `auth/weak-password` and `auth/password-does-not-meet-requirements` show "Choose a longer password: at least 8 characters." Sign in does not check the length (it would hint at what the password is not) |
| **Only `@isu.edu.ph`** | `checkEmail()` before every Firebase call; `isIsuEmail()` again in `data.ts` | **The real boundary is `firestore.rules`** (unchanged): `email_verified == true` and an email matching `@isu[.]edu[.]ph$`. An unverified or non-ISU account can read nothing, whichever way it signed in |
| **No email enumeration on sign-in** | `authErrorMessage()` | Wrong password and unknown email both show **"Email or password is incorrect."** With enumeration protection on, Firebase itself returns the same code (`auth/invalid-credential`) for both |
| **No enumeration on Forgot password** | `ForgotPassword.tsx` | The same "If an account exists…" words; Firebase sends nothing and says nothing for an unknown email |
| **Too many wrong attempts** | `auth/too-many-requests` | "Too many attempts. Wait a few minutes and try again, or use Forgot password?" Firebase refuses further tries for a while (its own limit; we do not count attempts); resetting the password is the way out |
| **Create account for an existing email** | `auth/email-already-in-use` | Tells them to sign in or use Forgot password?. **This does reveal that the email has an account** — see §7 |
| **Never STAFF** | `getUserProfile()`, `firestore.rules` | New profiles are `STUDENT`; the rules refuse any other role on create and any role change by the user |

---

## 5. Email links open the app (action URL)

Firebase sends the emails and checks the one-time code in each link — all
free and from the browser. The console's **action URL** decides where a link
opens. Set to the deployed app (§6 step 7), a link opens
`https://isu-archive-9253b.web.app/?mode=…&oobCode=…`, and App.tsx shows
`AuthActionScreen` over everything else:

- `resetPassword` → "Create a new password" (new + confirm, each with an eye)
  → "Password changed" → Sign in.
- `verifyEmail` → "Email verified" → Continue. If this browser is signed in to
  that account, Continue goes straight to the dashboard.
- Expired or used → "This link no longer works" (+ Send a new link for a reset).

**The console refuses a `localhost` action URL**, so while testing on this
computer the links open Firebase's own page. That page works too (it sets the
password or verifies the email) and shows a **Continue** button back to the
app, because `data.ts` passes `url: <this app>` with every email. Our
"Create a new password" screen is therefore first seen on the deployed site.

**Why links and not a 6-digit code like Google's:** emailing a code and
checking it needs a server (Cloud Functions → the paid Blaze plan). Links give
the same steps on the free plan, and the "no backend server" design stays.

---

## 6. Firebase console steps (the owner does these)

1. **Authentication → Sign-in method → Email/Password → Enable.** Leave
   "Email link (passwordless sign-in)" off. While Email/Password is off, sign
   in says "Password sign-in is not turned on yet", and reset emails are
   *still sent* but every link fails.
2. **Authentication → Settings → User account linking:** check that **"Link
   accounts that use the same email"** is selected (the default). This is what
   keeps one person = one uid.
3. **Authentication → Settings → User actions:** check that **Email
   enumeration protection** is on (the default for new projects).
4. **Authentication → Settings → Password policy:** minimum length **8**,
   mode **Require (enforce)**, no character-type requirements. (If the page
   asks to upgrade the project, skip this step: the browser check still
   requires 8, and say so in the defense.)
5. **Authentication → Templates:** for *Email address verification* and
   *Password reset*, set the sender name to **ISU Research Study E-Library**
   (✏ → Sender name). Optionally edit the subject lines.
6. **Authorized domains** (Authentication → Settings): `localhost` is there by
   default; `isu-archive-9253b.web.app` and `isu-archive-9253b.firebaseapp.com`
   must be added when deploying (`08` §4b). The Continue link in every email
   only works for an authorized domain.
7. **After the first deploy:** Templates → *Password reset* → ✏ → **Customize
   action URL** → `https://isu-archive-9253b.web.app/` → Save (the URL is
   shared by all templates). Then send a reset link to a test account and
   check it opens the live site on "Create a new password".

`firestore.rules` does **not** change: it already requires a verified
`@isu.edu.ph` email, so the security boundary is identical for both sign-in
methods.

---

## 7. Limits (say these in the defense)

- **Create account reveals that an email is registered** (`auth/email-already-in-use`).
  Google documents that sign-up keeps returning `EMAIL_EXISTS` even with
  enumeration protection on, and anyone can call that API directly, so hiding
  it in our screen would add no protection. Sign in and Forgot password do
  not reveal it.
- **Anyone can create an unverified account for any ISU address.** It gets
  nothing (the rules), the real owner can take it back (§3 B2), and an
  unverified account with no profile is harmless — but it does sit in the
  Firebase user list until someone deletes it in the console.
- **No 6-digit codes, no SMS, no two-step verification** — all would need a
  server or the paid plan (§5).
- **The pending Google connection is memory only.** If the user reloads (or
  the reset link opens in another tab), they press Continue with Google again
  and get the same notice.
- **The action URL cannot point at localhost** (§5), so the in-app "Create a
  new password" and "Email verified" screens are fully tested only after
  deploying.
- **Password strength beyond length is not checked** (no common-password
  list); 8 characters is the agreed minimum.
- **Case B depends on Firebase's provider rules** (§3). Both branches end at
  one uid; which one our project takes is recorded in §3 after the browser
  test.

---

## 8. Checks

`node src/auth.check.ts` — 55 examples: username → email, ISU only (including
`juan@mail.isu.edu.ph` and `juan@isu.edu.ph.evil.com` rejected), password
length (8 passes, 7 fails, an emoji counts as one), passwords match (case and a
trailing space matter), full name (author rules), the masked email, and every
Firebase error code → words, including "wrong password" and "unknown email"
giving the **same** sentence.

Browser steps: `09` §1 (email + password sign-in).
