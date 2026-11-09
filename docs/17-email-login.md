# 17 — Email + Password Login (for the defense)

**Status:** ◐ BUILT — branch `feat/email-password-login` (errata #68). The
browser test of §3 cases A and B was done on 2026-10-18 (result in §3); the
console steps in §6 are still to be done by the owner.
**Code:** `src/auth.ts` (pure: rules, messages, Firebase error code → words)
· examples in `src/auth.check.ts` (`node src/auth.check.ts`) · Firebase calls
in `src/data.ts` (auth section) · UI in `src/components/LoginScreen.tsx`
(Sign in, Create account, Forgot password), `ForgotPassword.tsx`,
`VerifyEmailScreen.tsx` ("Check your ISU inbox"), `AuthActionScreen.tsx`
(the page an email link opens) · `src/verifySend.ts` (Create account, then the
verification email; `node src/verifySend.check.ts`) · `src/emailLink.ts`
(Forgot password's email sign-in link, §9; `node src/emailLink.check.ts`) ·
routing in `src/App.tsx`
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

The Create account form says so under the password box: *"Not your Gmail
password."* The password rules are in the live checklist under the boxes (§4).

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
 ISU username            [ juan.delacruz        @isu.edu.ph ]
 Password                [ ••••••••                    (eye) ]
                         [            Sign in               ]
 Forgot password?                              Create account
 ─────────────────────────── or ───────────────────────────
                         [ G   Continue with Google         ]
```

- The box is labelled **ISU username** on Sign in, Create account and Forgot
  password (errata #83; was "Email or ISU username" / "ISU email"). Typing
  only the username (`juan.delacruz`) adds `@isu.edu.ph` (`toIsuEmail()`); a
  full ISU address (`juan.delacruz@isu.edu.ph`) still works and gives the same
  email. The grey `@isu.edu.ph` ending shows until an `@` is typed.
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
 ISU username       [ juan.delacruz  @isu.edu.ph ]
 Password           [ ••••••••            (eye) ]
                    Not your Gmail password.
 Confirm password   [ ••••••••            (eye) ]
                    The passwords don't match.   ← under its own field
                    ○ At least 8 characters      ← live checklist, ticks as
                    ○ An uppercase letter          you type
                    ○ A lowercase letter
                    ○ A number
                    ○ A symbol
                    ○ Passwords match
                    [        Create account      ]
```

1. The form checks every field **before** calling Firebase (`auth.ts`):
   full name (the Register form's author-name rules), ISU email, the password
   rules (§4), passwords match. Each message sits under its own field.
2. `createUserWithEmailAndPassword` — Firebase creates the account **and signs
   the user in**.
3. `updateProfile(displayName)` — so the dashboards greet them by name.
4. `sendEmailVerification` — the link goes to the ISU inbox. If it cannot
   be sent, the account still exists and the user still lands on "Check your
   ISU inbox", which shows the same error Resend would show and offers
   **Resend email** at once (no cooldown). `verifySend.ts` hands the failure
   to that screen, because Firebase signs the user in (and App.tsx may open
   the screen) before the send has finished (errata #84).
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

① ISU username → ② *"If an account exists for j•••@isu.edu.ph, we sent a link…"*
(the **same words** for an email with no account) → ③ the link opens our
"Create a new password" screen → "Password changed" → Sign in.

Since errata #85 the email is an **email sign-in link**, which always opens
our page even though the action URL cannot be changed; past the free plan's
daily limit it is the old reset email, which opens Firebase's plain page
(§9). Step ② says so: *"The email may say "Sign in to …" or "Reset your
password". Either link lets you set a new password."*

This is also how:
- a **Google-only** user adds a password (§3 case A), and
- the **real owner takes back** an account someone else created with their
  email (§3 case B2).

A link works only once; each new request cancels the older links. An old or
used link shows "This link no longer works" + **Send a new link**.

### Continue with Google

Unchanged: the first Google sign-in creates the account and the profile as
`STUDENT`; no Create account needed. ISU Google accounts are always verified.

### A slow connection (errata #73)

Sign-in and loading the profile have no time limit of their own in our code.
After `SLOW_WAIT_MS` (15 seconds, `auth.ts`) of waiting, the screen shows
*"This is taking longer than usual. Check your internet connection."* with a
**Try again** button that reloads the page.

- **Covered:** the splash screen (`authReady` false), a password sign-in,
  Create account, and `getUserProfile` after any sign-in or after "I've
  verified". One timer in `App.tsx` runs over the whole wait, so a slow sign-in
  followed by a slow profile counts as one wait.
- **Not while the Google popup is open:** the popup never starts the timer, and
  an older wait's message is hidden until the popup closes.
- **Only a message:** nothing is cancelled, no sign-in is rejected, the routing
  and the student-view fallback are unchanged. When the wait ends the message
  goes. Every exit of `routeSignedInUser` ends the wait (`try`/`finally`, and
  only the latest run clears the flags).
- **Firebase's own limits can end a wait first:** a sign-in request fails after
  30 s (5 s if the browser knows it is offline) with "No connection…", and on a
  dead connection Firestore goes offline after about 10 s, so `getDoc` fails
  and the student view opens with no message. The message is for a connection
  that is up but very slow, and for the first-time `setDoc`, which has no limit.

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
| **B.** Created a password account, later Continue with Google | **Verified** account (tested 2026-10-18): **(B3)** Firebase links Google to the existing user by itself; the password is kept. **Unverified** account (not tested): either **(B1)** Google *replaces* the password method ("the trusted provider overwrites the untrusted provider"), or **(B2)** `auth/account-exists-with-different-credential` | B3: nothing. B1: nothing — Forgot password? adds the password back. B2: the "connect Google" notice below | yes |
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

**Result (2026-10-18, a second ISU test account — never an owner or staff
account):**

1. Create account → "Check your ISU inbox" → verification link → dashboard
   with the full name, role `STUDENT`. **Pass.**
2. **Case B, verified account → B3, linked automatically.** With the
   *verified* password account, Continue with Google (same email) signed
   straight in with no notice. The Firebase console (Authentication → Users)
   shows **one** row for that email with **both** providers (Google and
   Email/Password) and one User UID, and signing in with email + the
   original password still works. So it was neither B1 (the password was not
   removed) nor B2 (no error, no notice): Firebase linked Google to the
   existing user by itself.
3. **Case A.** Forgot password on the owner's Google-first account: the email
   arrived, the new password works, the role is still `STAFF`. **Pass.**

**Not tested: Continue with Google on an *unverified* password account.**
An unverified email/password account is untrusted (above), so Firebase may
remove its password there (**B1**): the same uid signs in with Google, and
Forgot password? adds a password back. If it answers with
`auth/account-exists-with-different-credential` instead (**B2**), the
"connect Google" notice above appears. Either way the result is one uid.

**The B2 notice stays in the code as a safety net**, for the untested case
and in case Firebase's behaviour changes; it costs nothing when B3 happens.


---

## 4. The rules

| Rule | Where | Notes |
|---|---|---|
| A new password needs **at least 8 characters, an uppercase letter, a lowercase letter, a number and a symbol** (code points; spaces count, nothing trimmed; a symbol is anything that is not a letter, a number or a space; Unicode-safe, so Ñ is an uppercase letter and an emoji is one character and a symbol) | `passwordRules()` (one function, used by `checkNewPassword()` and both checklists), **in the app only**: the console's password policy stays off (§6 step 4) | Firebase's own minimum stays 6 with no character rules (§7). Both `auth/weak-password` and `auth/password-does-not-meet-requirements` show "Choose a stronger password. It must have at least 8 characters, an uppercase letter, a lowercase letter, a number and a symbol." **Sign in does not check the rules** (`checkPassword()`): existing accounts with older passwords still sign in, and saying the rules there would hint at what the password is not |
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
opens. **For this project the action URL cannot be changed** (§6 step 7), so
for now every link opens Firebase's plain page (below). Set to the deployed
app, a link would open
`https://isu-elibrary.web.app/?mode=…&oobCode=…`, and App.tsx shows
`AuthActionScreen` over everything else:

- `resetPassword` → "Create a new password" (new + confirm, each with an eye)
  → "Password changed" → Sign in.
- `verifyEmail` → "Email verified" → Continue. If this browser is signed in to
  that account, Continue goes straight to the dashboard.
- Expired or used → "This link no longer works" (+ Send a new link for a reset).
- `signIn` (Forgot password's email sign-in link, errata #85) → the same
  "Create a new password" screen. This one opens our app **today**, without
  the action URL change: Firebase's page always sends a sign-in link on to the
  app (§9).

### Design (errata #69)

All three email-link screens share one look, in `App.css` next to the
`reset-*` block, using the existing tokens only (light and dark):

- A 56px round **badge** above the heading (inline SVG, `aria-hidden`):
  envelope = email sent / Check your ISU inbox, lock = Forgot password step ①
  and Create a new password, green check = Password changed / Email verified
  (pops in and draws the tick; off under `prefers-reduced-motion`), amber
  warning = This link no longer works / turned off / not recognised, spinner
  = One moment.
- A heading and one short help line; the user's email in bold where the
  screen knows it (masked on Forgot password, as before).
- No screen states how long a link lasts. The short notice after Resend stays.
  (The "Didn't get it?" block was removed at the professor's request, errata
  #73.)
- The step indicator (`ResetSteps`): numbered circles joined by a line, done
  = tick, current = solid green with a ring.
- Create account and Create a new password: the same live checklist under the
  boxes (`PasswordChecklist` in `shared.tsx`), "At least 8 characters", "An
  uppercase letter", "A lowercase letter", "A number", "A symbol" and
  "Passwords match". It only displays — it calls the same `passwordRules()` /
  `checkConfirm()` as the buttons, and the messages under each box still appear
  only on leaving a box or on submit. No `aria-live`; each line has hidden
  "(done)" / "(not yet)" text.
- Every password box shows only our eye button: Edge's own reveal button
  (`::-ms-reveal`) is hidden in `App.css`.

**The console refuses a `localhost` action URL**, so while testing on this
computer the links open Firebase's own page (and, while the change is
blocked, on the live site too). That page works too (it sets the
password or verifies the email) and shows a **Continue** button back to the
app, because `data.ts` passes `url: <this app>` with every email. Our
"Create a new password" screen is therefore first seen on the deployed site.

**Why links and not a 6-digit code like Google's:** emailing a code and
checking it needs a server (Cloud Functions → the paid Blaze plan). Links give
the same steps on the free plan, and the "no backend server" design stays.

---

## 6. Firebase console steps (the owner does these)

1. **Authentication → Sign-in method → Email/Password → Enable**, and turn
   **"Email link (passwordless sign-in)" ON** (errata #85: Forgot password
   sends an email sign-in link, §9). With it off, Forgot password still works
   but always sends the old reset email (Firebase's plain page). While
   Email/Password is off, sign in says "Password sign-in is not turned on
   yet", and reset emails are *still sent* but every link fails. Turning email
   link on gives no new way in: the link is only good to whoever can open
   that ISU inbox, who could already reset the password.
2. **Authentication → Settings → User account linking:** check that **"Link
   accounts that use the same email"** is selected (the default). This is what
   keeps one person = one uid.
3. **Authentication → Settings → User actions:** check that **Email
   enumeration protection** is on (the default for new projects).
4. **Security → Authentication → Settings → Password policy: leave it OFF.**
   Google's documentation treats `forceUpgradeOnSignin=true` as require mode,
   so turning on Require could refuse older passwords at sign-in, STAFF accounts
   included. Its symbol and letter rules are also stricter than ours, so a
   password could tick every checklist line and still be refused. The rule is
   enforced by the app on Create account and Create a new password, not by
   Firebase's server, and Firebase's plain reset page stays weaker until the
   deploy sets the action URL (step 7).
5. **Authentication → Templates:** for *Email address verification* and
   *Password reset*, set the sender name to **ISU Research Study E-Library**
   (✏ → Sender name). Optionally edit the subject lines.
6. **Authorized domains** (Authentication → Settings): `localhost` is there by
   default; add **`isu-elibrary.web.app`** (the live site, errata #83) before
   the first deploy, and keep `isu-archive-9253b.web.app` and
   `isu-archive-9253b.firebaseapp.com` (`08` §4b). The Continue link in every
   email only works for an authorized domain.
7. **After the first deploy:** Templates → *Password reset* → ✏ → **Customize
   action URL** → `https://isu-elibrary.web.app/` → Save (the URL is
   shared by all templates). Then use Forgot password on the live site and
   check the email's link opens "Create a new password" on
   isu-elibrary.web.app (not Firebase's plain page).
   **Blocked (2026-11-09):** the console says "An error occurred when
   updating URL", and the Identity Toolkit API answers `400
   EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` for every new value; only the current
   `https://isu-archive-9253b.firebaseapp.com/__/auth/action` saves. A
   support request is open. Sending `handleCodeInApp: true` with the email
   does **not** get around it: tested on localhost on 2026-11-09, the reset
   link still opened Firebase's hosted page, so it was removed (errata #84).

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
  deploying. **For this project it cannot be changed at all yet**
  (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, support request open, §6 step 7), so
  the verification link and the fallback reset link open Firebase's plain
  page, including on the live site. Forgot password's sign-in link does not
  need the change (§9).
- **Only 5 email sign-in links a day for the whole project** on the free
  Spark plan (Google's limit; more needs the Blaze plan with a card). After
  that, Forgot password sends the old reset email instead (§9), so it never
  stops working; it only opens Firebase's plain page. Requests for addresses
  with no account also use up the 5.
- **A no-account sign-in link that could not be deleted stays behind** (§9
  case 2): a verified account with no name and no profile. Harmless (it
  can only be used by the owner of that inbox), but delete it in the console
  (Authentication → Users) if you see one with no name.
- **Password strength beyond the five rules is not checked** (no
  common-password list). `Password1!` passes.
- **The new-password rules are enforced by the app, not by Firebase's server.**
  Create account and Create a new password check them; Firebase's own minimum
  stays 6 characters. The console's password policy stays off (§6 step 4):
  Google's documentation treats `forceUpgradeOnSignin=true` as require mode, so
  it could refuse older passwords, and its symbol and letter rules are stricter
  than ours. Firebase's plain reset page stays weaker until the deploy sets the
  action URL (§6 step 7). Say this plainly in the defense.
- **Case B depends on Firebase's provider rules** (§3). Tested 2026-10-18:
  a **verified** password account followed by Continue with Google was
  linked automatically (B3: one uid, both providers, password kept). An
  **unverified** account was not tested; there Firebase may remove the
  password (B1, Forgot password? adds it back) or ask to connect (B2, the
  notice kept as a safety net). Every branch ends at one uid.

---

## 8. Checks

`node src/auth.check.ts` — 80 examples: username → email, ISU only (including
`juan@mail.isu.edu.ph` and `juan@isu.edu.ph.evil.com` rejected), the password
rules (each missing rule, 8 passes and 7 fails, spaces, an emoji is one
character and a symbol, Ñ and ñ, sign-in still accepts an older password),
passwords match (case and a trailing space matter), full name (author rules),
the masked email, the 15-second constant and message, and every Firebase error
code → words, including "wrong password" and "unknown email" giving the **same**
sentence.

`node src/emailLink.check.ts` — 66 examples for §9: which link opened the
app (reset, verify, sign-in, a sign-in link inside `link=`, wrong case, no
code), the console line (names only), which send errors fall back, the kept
email (24 h, broken or blocked storage), and every Save outcome (saved, no
account deleted and signed out, delete failing, someone signed in, wrong
email, offline, weak password, requires-recent-login, two Saves at once).

Browser steps: `09` §1 (email + password sign-in) and §1c (Forgot password
by email sign-in link).

---

## 9. Forgot password by email sign-in link (errata #85)

**Why.** The action URL cannot be changed (§6 step 7), so a reset email
always opens Firebase's plain page. Firebase's documentation says an email
**sign-in** link must always be completed in the app, unlike reset and verify
links: Firebase's page sends it on to the `url` we give, with
`handleCodeInApp: true`. So Forgot password signs the person in with the
link, and our page then sets the password with `updatePassword`.

**The flow.**

1. Forgot password → `sendSignInLinkToEmail(auth, email, { url: <this
   app>/, handleCodeInApp: true })`. The email is kept in localStorage
   (`isu.resetLinkEmail`, with the time), as Firebase advises.
   **Fallback:** on **any** error except `auth/network-request-failed`,
   `auth/invalid-email` and `auth/missing-email` (those are shown), the old
   `sendPasswordResetEmail` is sent instead. The real code for the 5-a-day
   limit is not known, so it is not listed; only the code is logged
   (`[auth] sign-in link not sent, sending the reset email instead
   auth/…`). The screen after is the same either way.
2. The link opens `/?apiKey=…&oobCode=…&mode=signIn&lang=en` (expected; the
   owner's test confirms it, below). `emailLink.ts parseEmailAction` picks the
   screen; Firebase's `isSignInWithEmailLink` must agree. The link is taken
   off the address bar at once (`replaceState`) and kept in memory.
3. Our "Create a new password" (same design, checklist, confirm box, eyes),
   **plus Cancel**. The link is used only when **Save** is pressed, so opening
   or reloading the page does not use it up.
4. Save → our checklist → `setPersistence(inMemoryPersistence)` →
   `signInWithEmailLink` → `updatePassword` on the user it returned → sign out
   → `setPersistence(indexedDBLocalPersistence)` → "Password changed" →
   **Sign in**.

**The hard cases.**

1. **Routing.** While the screen is open, `routeSignedInUser` in App.tsx does
   nothing (`holdRouting`, set on the first render, before the auth
   listener): no dashboard, no `users/{uid}` read or write. The session is
   **memory only**, so another open e-library tab never sees it (it would
   route it and write the profile). Leaving signs out, switches back to the
   saved session, then routes as usual.
2. **No account for that email.** A sign-in link **creates** an account. If
   `getAdditionalUserInfo(...).isNewUser` is true, the account is deleted at
   once (tried twice), the session ends, and the screen says the one safe
   sentence used for expired, used, wrong-email and no-account links:
   *"This link can't be used. It may have expired or been used already, or
   it is not for the ISU email you typed. Request a new link and open the
   newest email. No account yet? Use Create account."* If the delete fails
   both times, the session still ends; the account stays (§7).
3. **Opened on another device or browser.** No kept email → "Confirm your
   ISU email" asks for the **ISU username** (same box as Sign in). A wrong one
   gives the safe sentence. The kept email is cleared when the flow ends.
4. **An account already signed in here.** Nothing happens until it signs
   out: *"An account is signed in on this browser (j•••@isu.edu.ph). Sign out
   to set a new password with this link, or cancel to keep using it."* Cancel
   goes to that account's dashboard. The password is always set on the user
   `signInWithEmailLink` returned, never on whoever is signed in.
5. **Google-only account.** One account per email (§6 step 2), so the link
   signs in to the **same uid** and `updatePassword` adds the password. Firebase
   may remove the Google provider when a verified email sign-in arrives (§3,
   Google is not "trusted" for @isu.edu.ph); then the next Continue with
   Google gets the "connect Google" notice (§3 B2) and joins it again. Not
   tested with a real account yet.
6. **Address bar.** Cleaned at once; the link works once.
7. **Errors.** Weak password: our checklist first, then Firebase's
   `auth/weak-password` under the box (Save again does not sign in again). No
   connection: the message, the session stays, Save again. Anything else
   (expired, used, wrong email, `requires-recent-login`, email link turned
   off): the safe sentence and the session ends.
8. **Two Saves at once** (a double click, React's dev StrictMode): one
   shared promise per link (`data.ts linkReset`), so the link is used once.
9. **Leaving early.** Cancel, Send a new link and the other buttons sign out
   first. Closing the tab or Back leaves nothing: the session was in memory.
   The saved session is switched back on before any normal sign-in.

**The `[email-link]` console line.** Every email link prints one line with
the mode and the parameter **names** only, e.g.
`[email-link] mode=signIn params=apiKey,lang,mode,oobCode`. Never a code or
key, so it can be read out or pasted.

**Owner's real test** (localhost:8443; each test uses 1 of the 5 emails a day;
never paste the link or its code):

a) **Own STAFF account.** Forgot password → the email → our "Create a new
   password" page on localhost:8443 → a new password → Sign in → still
   **STAFF**, and Authentication → Users shows the **same UID** as before.
   Open the browser console (F12) **before** clicking the link and read the
   `[email-link]` line: it must say `mode=signIn` and list `oobCode`.
b) **Another device or browser.** Open the email link on the phone or in
   another browser → it must ask for the **ISU username** before the password
   form. A link asked for on localhost:8443 goes back to **localhost:8443**,
   which a phone cannot open: on the phone, ask for the link on the live site
   (after a deploy), or use another browser on this PC (Edge, or a Chrome
   guest window).
c) **The fallback.** At the end of the day, the 6th Forgot password → the
   **reset email** arrives (Firebase's plain page). The console shows
   `[auth] sign-in link not sent, sending the reset email instead auth/…`;
   write down that code for the errata.

Also look, after (a), at the Users row's providers. If a Google-only account
was used, note whether Google is still listed (case 5).
