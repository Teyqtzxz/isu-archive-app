# 08 — Deployment, Git Workflow & PWA

**Status:** ☐ DONE
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

Also confirm `.gitignore` covers `dist/` (it does) and that `firebase.json` and
`.firebaserc` have a single owner, so two people do not generate conflicting
config.

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

**Rebase onto `main` daily.** No branch should live longer than 24 hours.

```bash
git fetch origin && git rebase origin/main
```

Merge in this order, because later merges are easier:

```
1. person-a-data    types.ts + data.ts — everything imports these
2. person-b-search  search.ts / summary.ts — pure, no conflicts expected
3. person-c-pdf     RegisterForm + index.css
```

Keep the docs inside the repo so nothing is lost — **this is already done**:

```
isu-archive-app/
  docs/          ← these 13 files, including 00-AI-PREAMBLE.md
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

This must pass with **zero** TypeScript errors before you deploy. A build that
"succeeds with warnings" will break on Firebase's stricter runtime.

Preview it locally before deploying:

```bash
npm run preview
```

This serves the production bundle over HTTP rather than Vite's dev server, which
is the only way to catch base-path and asset problems.

---

## 4. Deploy to Firebase Hosting

**Prereq:** steps 03 and 04 are done, and the authorized domains from §4b exist.

```bash
npm install -g firebase-tools    # once
firebase login                   # opens a browser, approve it
firebase init hosting
```

Answer the prompts:

| Prompt | Answer |
|--------|--------|
| Which project | `isu-thesis-archive` |
| Public directory | `dist` |
| Single-page app | **Yes** |
| Automatic builds (GitHub Actions) | No (optional later) |

"Single-page app: Yes" is required — it adds the rewrite that sends every route
to `index.html`. Without it a refresh on any route 404s.

Then:

```bash
npm run build && firebase deploy --only hosting
```

Redeploy any time you finish a feature.

### 4b. Authorize the deployed domain

**This is the most likely reason a deployed demo fails.** Firebase only accepts
sign-in from allowlisted origins. A freshly deployed `.web.app` URL is not on the
list, so Google sign-in fails immediately with `auth/unauthorized-domain` — the
live app looks completely broken while `localhost` still works.

1. Firebase console → **Authentication → Settings → Authorized domains**
2. **Add domain**, then add:
   - `isu-thesis-archive.web.app`
   - `isu-thesis-archive.firebaseapp.com`
3. Save — it applies immediately, no redeploy needed
4. Verify by signing in **on the deployed URL**

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
      name: "ISU Thesis Archive",
      short_name: "ISU Archive",
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
add two A records (`151.101.1.195`, `151.101.65.195`). No code changes. If the
campus does not provide a domain, skip this entirely.

---

## 8. Verification

- [ ] Only one lockfile is committed
- [ ] `npm run build` passes with zero errors
- [ ] `npm run preview` renders the app correctly from the production bundle
- [ ] `firebase deploy` succeeds
- [ ] The deployed URL loads the app
- [ ] **Sign-in works on the deployed URL** — not just localhost
- [ ] Search, register and summary all work on the deployed URL
- [ ] HTTPS padlock shows, with no mixed-content warnings in the console
- [ ] Refreshing a deep route does not 404
- [ ] A fresh `git clone` → install → build succeeds
- [ ] If PWA: the browser offers "Install app", and airplane mode still shows a
      usable search

---

**Next:** `09-testing-checklist.md` — the full QA pass before showing your teacher.
