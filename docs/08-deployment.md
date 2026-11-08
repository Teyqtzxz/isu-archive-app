# 08 — Deployment, Git Workflow & PWA

**Status:** ☐ TODO
**Owner:** C · **Depends on:** 03, 04, 06 · **Next:** 09

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Verify the
> production build, add PWA/offline support if the sections below mark it
> optional, and write a deploy checklist. Do not run any deployment command
> yourself — I will do that."*

---

## 1. Package manager — already settled: npm

The repo had **both** `package-lock.json` and `pnpm-lock.yaml` committed. Two
lockfiles means two developers can install different dependency trees from the
same commit, and "works on my machine" stops being a joke.

**Resolved: `pnpm-lock.yaml` has been deleted. This project uses npm.** pnpm was
not even installed on the machine that produced the prototype, so the lockfile was
a stray artefact rather than a deliberate choice.

```bash
npm ci          # clean clone
npm install     # after adding a dependency
```

Do not reintroduce `pnpm-lock.yaml` or a `yarn.lock`. The regression check for
this is in `09-testing-checklist.md` — `ls package-lock.json pnpm-lock.yaml`
must report exactly one file.

Also confirm `.gitignore` covers `dist/` (it does). `firebase.json` and
`.firebaserc` are committed (errata #83) and have a single owner (C), so two
people do not generate conflicting config; never regenerate them with
`firebase init`.

### A build that actually typechecks

`npm run build` is `tsc --noEmit && vite build`. It used to be `vite build`
alone, which meant **a TypeScript error could not fail the build** — the app
shipped type errors and nobody noticed until someone opened an editor. There is
also a standalone `npm run typecheck` if you just want the types checked.

---

## 2. Git workflow

```bash
# branches
git checkout -b person-a-data
git checkout -b person-b-search
git checkout -b person-c-pdf

# commit small and often
git add -A
git commit -m "feat(search): add 300ms debounce to SearchScreen"

# push so others can see progress
git push -u origin person-b-search
```

**Merge `main` into your branch daily** — never rebase:

```bash
git pull origin main
```

Rebasing a branch you have already pushed rewrites its history, and the next
push then needs `--force`, which preamble rule 10 forbids. Merging never does.

Merge in this order, because later merges are easier:

```
1. person-a-data    types.ts + data.ts — everything imports these
2. person-b-search  search.ts / summary.ts — pure, no conflicts expected
3. person-c-pdf     RegisterForm + index.css
```

Keep the docs inside the repo so nothing is lost — **this is already done**:

```
isu-archive-app/
  docs/          ← these 15 files, including 00-AI-PREAMBLE.md
  src/
  firestore.rules
```

Never keep a second copy of the docs outside the repo. Two copies means two
versions, and the group ends up building against whichever one they happened to
open.

---

## 3. Build

```bash
npm run build
```

This must pass with **zero** TypeScript errors before you deploy. (Warnings are
fine — Firebase Hosting just serves the static files in `dist/`.)

Preview it locally before deploying:

```bash
npx vite preview --port 4173 --strictPort
```

(The port matters: `vite.config.ts` falls back to 8443, the dev server's port.
`vite preview` does not read `firebase.json`, so headers and the rewrite are
only seen on the live site.)

This serves the production bundle over HTTP rather than Vite's dev server, which
is the only way to catch base-path and asset problems.

---

## 4. Deploy to Firebase Hosting (errata #83)

**Live address: https://isu-elibrary.web.app** — the Hosting site
`isu-elibrary` in the project `isu-archive-9253b`. The owner created the site in
the Firebase console (Hosting → Add another site). The project's default site,
`isu-archive-9253b.web.app`, is not used for the e-library.

**Prereq:** the authorized domain and the Drive API key website from §4b are
added **before** the first deploy.

### The config is committed — no `firebase init`

Do **not** run `firebase init`: it would ask questions and could rewrite the two
files below. Both are in git:

- `.firebaserc` — the default project, `isu-archive-9253b`.
- `firebase.json` — **Hosting only**:

| Part | Value | Why |
|------|-------|-----|
| `site` | `isu-elibrary` | Deploys to isu-elibrary.web.app, not the project's default site |
| `public` | `dist` | What `npm run build` makes |
| `ignore` | `firebase.json`, `**/.*`, `**/node_modules/**` | Never upload these |
| `rewrites` | `**` → `/index.html` | Every path opens the app. The email links open `/?mode=resetPassword&oobCode=…`; a mistyped path shows the app instead of a 404 |
| header, `regex` `^/(index\.html)?$` | `Cache-Control: no-cache` | The browser asks again for `index.html` every time (a quick "not changed" when nothing changed) |
| header, `source` `/assets/**` | `Cache-Control: public, max-age=31536000, immutable` | Every file in `/assets/` has a hash in its name (main bundle, CSS, the lazy pdf.js chunk **and** the pdf.js worker), so a new build always has new names and these can be kept for a year |

**There is no `firestore`, `storage` or `functions` section, on purpose.** So
`firebase deploy` can never change the security rules. A pastes
`firestore.rules` into the console (`03` §7) — that stays the method. When A
changes `firestore.rules` in git, A pastes it again. The file in git and the
console must always match; if they differ, the console is what is live.

**Why `index.html` must not be cached.** After a redeploy the old hashed files
are gone. A browser that kept an old `index.html` would ask for the old main
bundle, or — later, when staff open Register — for the old lazy pdf.js chunk.
The `**` rewrite answers that missing `.js` file with `index.html`, the browser
refuses it as a script, and the page goes blank or PDF reading fails. With
`no-cache`, every visit checks for the new `index.html` first.

**How the header rules match (Hosting docs, checked 2026-11-09).** Header
patterns are matched against the **request path before any rewrite**, so the
rule must name `/`, not only `/index.html`. The query string is not part of the
path, so `/?mode=resetPassword&oobCode=…` gets the `/` rule (confirm with the
`curl -I` checks below). The docs say only that "matching rules are applied in
the order they are defined" and **do not say what happens when two rules set
the same header**, so the two rules here never match the same path. Other paths
(a mistyped `/xyz`) still open the app through the rewrite with Hosting's
default cache; nothing in the app or the emails links to such a path.

**No `Referrer-Policy` header.** The Drive API key is restricted to websites
(`06` §0), so the browser must keep sending the site's origin with each Drive
request. The browser's default does that; a policy like `no-referrer` would
make every Drive read fail with 403.

### Deploy — the owner runs these (Windows cmd, one per line)

Once per computer:

```
npm install -g firebase-tools
firebase login
```

Each deploy, from the repo folder, on an up-to-date `main`:

```
cd C:\Users\reyster\isu-archive-app
git checkout main
git pull origin main
npm run build
firebase deploy --only hosting --project isu-archive-9253b
```

`npm run build` must end with no errors (it type-checks first). The deploy
prints `Hosting URL: https://isu-elibrary.web.app` at the end.

### Check the cache headers (after each deploy)

`curl` comes with Windows 10 and 11. Take a real file name from `dir dist\assets`
(for example `index-D5MQskc7.js`; the name changes with every build):

```
curl -I https://isu-elibrary.web.app/
curl -I "https://isu-elibrary.web.app/?mode=resetPassword"
curl -I https://isu-elibrary.web.app/assets/index-D5MQskc7.js
```

| Address | Expected `cache-control` |
|---------|--------------------------|
| `/` | `no-cache` |
| `/?mode=resetPassword` | `no-cache` |
| `/assets/<file>` | `public, max-age=31536000, immutable` |

All three should say `HTTP/1.1 200` (or `HTTP/2 200`). If `/?mode=…` shows
anything other than `no-cache` (for example `max-age=3600`), Hosting did not
match it to the `/` rule: tell the builder before the next deploy.

### If something fails

| Symptom | Cause | Fix |
|---------|-------|-----|
| Sign-in says `auth/unauthorized-domain` | `isu-elibrary.web.app` not in Authorized domains | §4b step 1. Applies at once, no redeploy |
| Register: Drive link read fails, console shows 403 with "referer" / "API_KEY_HTTP_REFERRER_BLOCKED" | The Drive key's website list lacks the new site | §4b step 2. Can take up to 5 minutes |
| Blank page | Build not run or wrong folder deployed, or an old `index.html` cached | `npm run build`, deploy again; hard refresh (Ctrl+F5); check the `curl -I` table |
| 404 on refresh or on an email link | The rewrite is missing (someone ran `firebase init` and overwrote `firebase.json`) | `git checkout firebase.json`, deploy again |
| The reset email opens Firebase's plain page | Action URL not set yet | `17` §6 step 7 |

### Going back to the previous version

Do **not** run `firebase hosting:disable`: it takes the whole site offline, it
does not go back to an earlier version. The safe ways:

1. **Fix and redeploy** (normal): fix on a branch, merge, then the deploy
   commands above.
2. **Roll back a release**: Firebase console → Hosting → the `isu-elibrary`
   site → Release history → the previous release → ⋮ → **Roll back**. The
   previous build is live again in seconds; nothing in Firestore changes. The
   very first deploy has nothing to go back to, so there only 1 applies.
3. Or redeploy an older commit: `git checkout <older commit>`, `npm run build`,
   `firebase deploy --only hosting --project isu-archive-9253b`, then
   `git checkout main`.

Hosting never touches Firestore data, Authentication accounts or the security
rules, so going back changes only the page files.

### 4b. Authorize the deployed domain

**This is the most likely reason a deployed demo fails.** Firebase only accepts
sign-in from allowlisted origins. A freshly deployed `.web.app` URL is not on the
list, so sign-in fails immediately with `auth/unauthorized-domain` — the live
app looks completely broken while `localhost` still works. The Drive API key has
its own list of websites, and a site missing there makes every Drive read fail.

1. Firebase console → **Authentication → Settings → Authorized domains → Add
   domain** → `isu-elibrary.web.app`. Keep the ones already there:
   `localhost`, `isu-archive-9253b.web.app`,
   `isu-archive-9253b.firebaseapp.com` (the Google popup still runs on
   `firebaseapp.com`, `src/firebase.ts` `authDomain`).
2. Google Cloud console → **APIs & Services → Credentials** → the Drive API key
   → **Application restrictions → Websites** → add
   `https://isu-elibrary.web.app/*`, keep the others (`06` §0) → Save.
3. Both apply without a redeploy. Verify by signing in and reading a Drive link
   **on the deployed URL**.

Do this as part of the first deploy, not the last.

---

## 5. Environment variables

Usually unnecessary — the Firebase web config is public by design. If you ever
need to hide a flag:

```bash
# .env.local
VITE_ADMIN_FLAG=true
```

```typescript
const flag = import.meta.env.VITE_ADMIN_FLAG;
```

`.env*` is already in `.gitignore`. Never commit secrets.

---

## 6. PWA / offline (optional)

Do this only when steps 01–07 are done and tested.

```bash
npm install -D vite-plugin-pwa
```

```typescript
// vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

plugins: [
  react(),
  tailwindcss(),
  VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["favicon.ico"],
    manifest: {
      name: "ISU Research Study E-Library",
      short_name: "ISU E-Library",
      theme_color: "#006439",
      background_color: "#FFFFFF",
      display: "standalone",
      start_url: "/",
    },
    workbox: { navigateFallbackDenylist: [/^\/__\//] },
  }),
],
```

### Offline thesis cache

`onSnapshot` is not available offline. Mirror the list to `localStorage` and
hydrate from it on boot so search still works with no connection:

```typescript
// on every snapshot
try { localStorage.setItem("theses_cache", JSON.stringify(list)); } catch { /* quota */ }

// on boot, before Firestore responds
try {
  const cached = localStorage.getItem("theses_cache");
  if (cached) setTheses(JSON.parse(cached));   // instant first paint
} catch { /* corrupt cache, ignore */ }
```

Wrap both in `try/catch` — private-browsing modes and quota limits will throw, and
an uncaught throw here takes down the whole app on launch.

BM25 is client-side, so search works from the cache with no further changes.

---

## 7. Custom domain (polish, only if ISU provides one)

Firebase Hosting → **Add custom domain** → verify ownership with a TXT record →
add the DNS records the console shows you (they are project-specific; do not
copy IPs from a tutorial). Then add the domain to the Firebase **Authorized
domains** (§4b) and to the Drive API key's website restrictions (`06` §0). No
code changes. If the
campus does not provide a domain, skip this entirely.

### 7b. Protecting the study files (staff checklist)

Students read the whole study in Google's **view-only** viewer ("Read full
study") with their ISU Google account, and get no Download, Print or Copy. The
app only shows the link — the real protection is how each PDF is shared in
Google Drive. For every study PDF:

- [ ] **Owner** is the Research Department's ISU Google account (not a
      student's or a staff member's personal account)
- [ ] **Share → General access = "Isabela State University" → Viewer**
- [ ] **Share → ⚙ Settings → "People who can download, copy, print…" = Editors**
- [ ] **Share → ⚙ Settings → "Allow editors to change permissions and share" = off**
- [ ] Add other Research Department staff as Editors only if they need it
      (Editors **can** download)
- [ ] **Never** "Anyone with the link" — that lets anyone outside ISU open it
- [ ] When registering, choose the PDF **from this computer**: a view-only file
      cannot be read through the Drive API (`06` §7)

**How to check.** Close **every** Incognito window first (they all share one
Google sign-in), open a new one and sign in with **only** a student's ISU
account, then open the study from the e-library with "Read full study". The
owner and Editors always see Download, so checking from the owner's own account
proves nothing. The student should see the PDF with **no Download / Print**
buttons; a non-ISU Google account should be asked to sign in or request access.

**Several Google accounts in one browser.** Drive normally opens a link with the
browser's *first* Google account (often a personal Gmail), which gets "You need
access". The e-library adds `authuser=<e-library email>` to the link when it is
opened (`withAccount()` in `SearchScreen.tsx`; the saved `driveLink` is
unchanged), so with two accounts signed in the study still opens with the
account used for the e-library.

**Honest limit.** View-only stops downloading, printing and copying text in
Google's viewer. It **cannot** stop screenshots or someone photographing the
screen — no web app can.

---

## 8. Verification

- [ ] Only one lockfile is committed
- [ ] `npm run build` passes with zero errors
- [ ] `npx vite preview --port 4173 --strictPort` renders the app from the production bundle
- [ ] `firebase deploy --only hosting --project isu-archive-9253b` succeeds
- [ ] https://isu-elibrary.web.app loads the app
- [ ] The three `curl -I` checks in §4 show the expected `cache-control`
- [ ] **Sign-in works on the deployed URL** — not just localhost
- [ ] Search, register and summary all work on the deployed URL
- [ ] HTTPS padlock shows, with no mixed-content warnings in the console
- [ ] Refreshing the page while signed in returns you to your dashboard (the app
      has no URL routes, so this is session restore, not a 404 check)
- [ ] PDF auto-fill works on the deployed URL (the Drive API key allows
      `https://isu-elibrary.web.app/*` — `06` §0)
- [ ] A fresh `git clone` → install → build succeeds
- [ ] If PWA: the browser offers "Install app", and airplane mode still shows a
      usable search

---

**Next:** `09-testing-checklist.md` — the full QA pass before showing your teacher.
