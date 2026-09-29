# 11 — Doc Errata (changelog)

**Status:** ☑ DONE — informational. Nothing to build here.

The step docs are the source of truth. This file records what was wrong with the
original versions on **2026-09-26** and where the fix now lives, in case you or a
groupmate read an earlier copy.

Several defects were of the kind that produce plausible-looking but wrong output
rather than a crash — you would not notice until the demo.

---

## Corrections

| # | Was wrong | Now | Where |
|---|-----------|-----|-------|
| 1 | Firestore rules used `allow create, update: if request.auth.uid == uid`, so a **student could set `role: "STAFF"` on their own document** and then write theses | `role` is immutable on update, pinned to `STUDENT` on create, plus a 4-row Playground test matrix | `03` §7 |
| 2 | Authorized domains never mentioned — deployed sign-in fails with `auth/unauthorized-domain` | Added to setup step 6 and as a deploy step with a symptom description | `03` §1, `08` §4b |
| 3 | Three conflicting status vocabularies: prototype used lowercase, spec used `DRAFT`/`NEEDS_REVIEW` | One canonical uppercase enum + `isPending()` + a line-by-line migration table | `02` §2, §5 |
| 4 | `saveThesis()` hardcoded `status: "ARCHIVED"`, so Pending Review was permanently 0 and the Status filter was dead | Status is a parameter; `serverTimestamp()` instead of `new Date()` | `04` §2.2 |
| 5 | Keywords regex `(.+)$` with the `s` flag was greedy to end-of-document — it captured 3 pages of chapter text and turned it into garbage chips | Bounded to one line, with a `firstNonEmptyLine` fallback | `06` §4 |
| 6 | `KEYWORDS?` **never matches** "KEY WORDS", despite the doc claiming it did | `KEY\s?WORDS?` | `06` §4 |
| 7 | `items.map(i => i.str).join(" ")` flattened every line break, making a line-bounded match impossible in principle | `item.hasEOL` honoured | `06` §4 |
| 8 | Search spec prescribed a `+0.5` fuzzy bonus — negligible against BM25 scores of 5–20, so the feature would appear broken | Removed; the prototype's in-function `findMatchScore` weighting is correct and already built | `05` §3 |
| 9 | Header table said 60px at 640–1023px, CSS said 64px, and `.main-content` hardcoded 56px — content sat under the bar at ≥640px | One `--header-h` variable read by both header and padding | `04` §4.2 |
| 10 | pdf.js worker described as "in some versions" optional | Marked required for v4+, with the version-dependent filename | `06` §3 |
| 11 | `splitSentences` split on any `. `, truncating "Dr. Maria Santos" to "Maria Santos" and "Fig. 3" to "3" | Protect known abbreviations with a sentinel, split, then restore. Verified against 6 abbreviation-bearing sentences. A negative-lookbehind regex was tried first and **silently dropped** short sentences | `07` §3 |
| 12 | `catch {}` in the register flow hid the real error, so "invalid link shows a clear message" was unpassable | Error surfaced to staff | `06` §5 |
| 13 | `Math.random() > 0.3` made the headline feature a 70% coin flip | Flagged for removal, with a `grep` check | `06` §2, `09` §4 |
| 14 | Citation chips were specified to highlight a card *behind* a modal | Close-panel-then-scroll-and-flash | `07` §4 |
| 15 | Both `package-lock.json` and `pnpm-lock.yaml` committed | `pnpm-lock.yaml` deleted; npm is now the only package manager | `08` §1 |
| 16 | Progress tracker claimed nothing was done | Corrected against the code, with owners | `00`, `01` §5 |
| 17 | Doc said the top result shows 100% relevance; the code deliberately caps at 97% via `× 93 + 4` | Doc rewritten to describe the code and explain why a fixed ceiling is worse | `05` §4, `09` |
| 18 | Doc said the summary panel takes the top 5 visible results; the code had manual selection **and** a duplicate top-10 FAB | Kept manual selection, deleted the FAB, renamed to "View Summary (N)"; the alternative is documented with a 1-line revert | `01` Flow D, `04`, `07` §1 |
| 19 | Doc told the group the prototype uses pnpm | pnpm was never installed; the lockfile was a stray artefact | `01` §1, `08` §1 |
| 20 | Doc said the dev server is on port 5173 | It is 8443, set in `vite.config.ts` | `01` §1 |
| 21 | `02` §5 and `04` Part 1 gave `src/App.tsx` line numbers (~18, ~33, ~196, ~352, ~959) for the enum migration and the module split — all stale the moment the split landed | Rewritten against the post-split file layout, and both sections marked done | `02` §5, `04` Part 1 |
| 22 | `07` and `09` pointed at `src/components/SummaryPanel.tsx`, which does not exist — the module split renamed it `CombinedSummaryPanel.tsx`. Worst of all, the QA check was `grep -n "copied" SummaryPanel.tsx` expecting no output: grep on a missing file writes to stderr and prints nothing to stdout, so **the check could never fail** | Corrected to the real filename in 4 places, and added the check nobody had: that `const extractive` (the hardcoded mock at `CombinedSummaryPanel.tsx:8`) is gone and `from "../summary"` now appears. Both new checks were run against current code and correctly report a match, confirming they can fail | `07` §prompt + §8, `09` §7 + auto block |
| 23 | **All 8 step docs opened with `**Status:** ☐ DONE`** — an unchecked box next to the word DONE, on steps the tracker shows as not started. It is the first thing the AI reads after the title, so it could reasonably conclude the whole step is finished and do nothing. The genuine per-section completions (`02` §5, `04` Part 1) are marked inline with `✅ DONE` and were always correct | Changed to `☐ TODO` in all 8. The inline markers are the authoritative signal and were left alone | `02`–`09` line 3 |
| 24 | Three prompt lines still instructed work that had already shipped: `02` said "migrate the prototype's status values" (§5 is done), `04` said "Part 1: split `src/App.tsx`" (commit `c5644d4`), `05` said "move the search code out of `App.tsx` into `src/search.ts`" (already there). Each contradicted a `✅ DONE` marker further down the same file | Rewrote all three to name only the remaining work, with an explicit "do not redo" clause. Also corrected `02` §1, which said "Files to create: `src/types.ts`" and "Files to modify: `src/App.tsx`" — `types.ts` exists and must be extended, not rewritten, and `App.tsx` needs no change at all | `02` prompt + §1 + §2, `04` prompt, `05` prompt |

## Code bugs found and fixed (not doc bugs)

Found by reviewing `src/App.tsx` and verified against the real sample data.

| # | Bug | Fix |
|---|-----|-----|
| A | `bm25Score` re-tokenised the whole corpus once per document — O(D²) — and `results` was an un-memoised IIFE in the render body, so it re-ran on *any* state change | `buildIndex` + `computeDocFreq`, both `useMemo`'d. **461 ms → 6.3 ms at 200 theses** |
| B | `findMatchScore` allowed substring matching at any length, so `rate` matched `invertebrates`/`demonstrated`/`integrated` and `dr` matched `hydrological` | Substring requires a 4+ character query term. Prefix matching untouched |
| C | `avgDocLen = sum / theses.length` → `NaN` on an empty archive | Falls back to `1` |
| D | Empty query returned results **unsorted**, contradicting the spec's "newest first" | Sorts by `dateAdded` descending |
| E | "This Month" dashboard stat was hardcoded to `>= "2024-11"` — permanently wrong | Computed from the current month |
| F | `npm run build` was `vite build` only, so a type error could not fail the build | `tsc --noEmit && vite build` |
| G | `vite.config.ts` used `__dirname` and an attribute-less JSON import — both break under Vite's native config loader | `import.meta.dirname`, `with { type: 'json' }` |
| H | The status filter pills built their label with `s.charAt(0).toUpperCase() + s.slice(1)`. Harmless on `"archived"`, but on `"ARCHIVED"` it returns `"ARCHIVED"` — the migration alone would have put three all-caps buttons in the staff UI | Both the badge and the pills now read one exported `STATUS_LABELS` map, so they cannot drift |
| I | Five `// ─── Section ───` divider comments survived the module split and pointed at the wrong file — `LoginScreen.tsx` was headed "Screen 2: Staff Dashboard" | Removed. Also dropped the two unused type imports the split introduced |

**Note on H.** The migration was verified by rendering, not by assuming. All six
screens were rendered to static markup and asserted: 6 `ARCHIVED` / 1 `DRAFT` /
1 `NEEDS_REVIEW` in the seed data, `isPending` counting 2, every badge still
carrying its colour class (`status-archived` / `status-pending` /
`status-needs-review`) rather than a bare unstyled `status-badge`, all three
filter pills labelled, and no raw enum value leaking into visible text. The
staff dashboard's "Pending Review" stat still reads 2, exactly as it did before
the rename, because `DRAFT` + `NEEDS_REVIEW` is the same pair of theses the old
`"pending" || "needs_review"` filter matched. Ranking is untouched — the BM25
harness still reports a max score delta of `0.000e+0`.

**Behaviour preserved, and proved rather than assumed.** `05`'s ranking maths is
unchanged. An old-vs-new harness over the 8 real sample theses confirmed:

- 11 queries with no short terms: **max score delta 0.000e+0**, zero field
  attribution mismatches
- 14 of 16 queries rank identically; the 2 that differ are the substring guard
  working as designed (`rate`, `Dr. Maria Santos`)
- Empty corpus: `avgDocLen` finite, zero results, no `NaN`

A `adviser`-name search returning nothing is **not** a regression — `adviser` was
never part of the searchable text (`docTextOf` is title + abstract + keywords).
The old code only appeared to match because `dr` hit `hydrological`.

---

## Still open — needs a person, not a doc edit

| Item | Owner |
|---|---|
| Create the Firebase project, obtain the real `firebaseConfig` | A |
| Add authorized domains | A |
| Promote test accounts to `STAFF` | A |
| Confirm whether Drive CORS blocks you in practice | C |
| Create 2+ Google accounts to test STAFF vs STUDENT (one per browser profile) | all |
| Write ~20 seed theses, not 8 | B |
| Run the QA pass on the deployed URL | C |
| Present it | all |

### Two gaps nobody has asked about yet

- **Duplicate detection.** Nothing stops two staff registering the same thesis
  twice. A normalised-title existence check before `addDoc` is a few lines, and it
  is the kind of hole that becomes an awkward question during Q&A.
- **Load failure vs empty data.** Every screen assumes Firestore is reachable. A
  permission error and a genuinely empty archive currently look identical. The
  spec handles this (`04` §2.3, `09` §9) — make sure it is actually implemented.

---

## Correctness of this changelog

Verified after writing: no superseded pattern survives anywhere in `00`–`10` except
inside the "was wrong" descriptions in this file. Every markdown code fence is
balanced.
