# 05 — Search & Ranking (BM25, debounce, filters)

**Status:** ☐ DONE
**Owner:** B · **Depends on:** 04 · **Next:** 06 or 07

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Move the existing
> search code out of `App.tsx` into `src/search.ts` **without changing their
> behaviour** — that means `tokenize`, `findMatchScore`, `buildIndex`,
> `computeDocFreq`, `bestFieldFor` and `bm25Score`, all verbatim. Then add a
> 300ms debounce and finish the filters and the 'Why this rank?' panel. Do not
> change the scoring maths. Do not start step 06."*

---

## 1. What already works — move it, do not rewrite it

The prototype's `App.tsx` already contains a real, correct search engine:

| Function | Status |
|----------|--------|
| `tokenize(text)` | ✅ works — lowercases, strips punctuation, splits on whitespace, drops empties |
| `findMatchScore(q, d)` | ✅ works — `1.0` exact, `0.8` prefix, `0.6` substring (4+ chars only), `0` none |
| `docTextOf(t)` | ✅ works — the searchable text: title + abstract + keywords |
| `buildIndex(theses)` | ✅ works — pre-tokenises the corpus and builds a postings map |
| `computeDocFreq(tokens, index)` | ✅ works — document frequency per query term |
| `bestFieldFor(t, term)` | ✅ works — title / keyword / abstract, for the breakdown panel |
| `bm25Score(query, thesis, docIndex, index, df)` | ✅ works — returns `{ score, termScores }` |
| `SearchScreen` filters by department / year / status | ✅ works |
| Empty query sorts newest-first | ✅ works |
| "Relevance: XX%" badges | ✅ works |
| "Why this rank?" per-term breakdown | ✅ works |

Your job is to **move this code into `src/search.ts` unchanged**, then close the
two remaining gaps. Moving code that works is a mechanical task — resist every
urge to improve it while you are in there.

### Note the signatures

`bm25Score` does **not** take a corpus array. It takes a prebuilt `SearchIndex`
and a precomputed document-frequency map, because the original version re-tokenised
the entire corpus once per document per keystroke. That was quadratic and it has
already been fixed — see §6. Do not "simplify" the signature back.

---

## 2. Gap 1 — 300ms debounce

The only genuinely missing piece. Search currently recomputes on every keystroke.

```typescript
// inside SearchScreen
const [query, setQuery] = useState("");
const [debouncedQuery, setDebouncedQuery] = useState("");

useEffect(() => {
  const t = setTimeout(() => setDebouncedQuery(query), 300);
  return () => clearTimeout(t);
}, [query]);
```

Use `debouncedQuery` in the results computation; use `query` for the input's own
value so typing stays responsive. Typing feels instant, BM25 runs once the user
stops.

The `clearTimeout` in the cleanup is what makes this a debounce rather than a
delay. Without it, every keystroke leaves a pending timer and you get seven
searches per word.

---

## 3. Gap 2 — verify prefix and substring matching

This already works. Confirm it and leave it alone.

The requirement: `Bio` must match **Biodiversity**, and `diver` must also match
**Biodiversity**. BM25 alone only matches exact tokens, so `findMatchScore`
supplies a weaker weight for partial hits:

```typescript
function findMatchScore(queryTerm: string, docToken: string): number {
  if (queryTerm.length < 2) return 0;                             // single char never searches
  if (docToken === queryTerm) return 1;
  if (docToken.startsWith(queryTerm)) return 0.8;                 // Bio → Biodiversity
  if (queryTerm.length >= 4 && docToken.includes(queryTerm)) return 0.6;  // diver → Biodiversity
  return 0;
}
```

### The `length >= 4` guard is load-bearing — do not remove it

That guard is not an optimisation, it is a correctness fix. Without it, a
three-character query term matches *any* word containing those three letters, and
because term frequency is summed across every matching token, one thesis can
outrank another for a term it does not contain.

Measured against the 8 prototype theses, an unguarded `rate` matched:

| Query | Words it silently matched |
|-------|--------------------------|
| `rate` | `invertebrates`, `macroinvertebrate`, `macroinvertebrates`, `demonstrated`, `integrated` |

So a search for `rate` credited four separate theses — including two about
crop-yield machine learning — for a word they never used. Worse, `dr` (two
characters) substring-matched `hydrological`, which is why searching an adviser's
name like `Dr. Maria Santos` used to return a hydrology thesis.

`startsWith` stays unguarded, so `Bio` → Biodiversity and `diver` → Biodiversity
both still work. Only the mid-token match is restricted.

### Do not replace this with a flat "+0.5 bonus"

A tempting alternative is to score the thesis with plain BM25 and then add a small
constant for any fuzzy hit. Do not do that. BM25 scores are not normalised to a
0–1 range — across 8–100 documents a single matching term routinely scores 5–20 and
a three-term query far higher. A `+0.5` addition is a rounding error on that
scale, so the feature would appear to do nothing and you would lose a day
debugging it.

Weighing fuzzy hits **inside** the scoring function, as `findMatchScore` does, is
correct for two reasons: a fuzzy hit competes with an exact hit on the same
scale, and the "Why this rank?" panel reports a real number instead of a
fabricated one. Keep it.

### Single-character guard

A one-character query should not search. It matches too much to be useful and
wastes a full corpus scan. `findMatchScore` already returns `0` for terms shorter
than two characters, so this is handled — but keep the early return in
`searchTheses` too, so an all-garbage query never builds an index:

```typescript
export function searchTheses(query: string, theses: Thesis[]): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return sortByNewest(theses);

  const index = buildIndex(theses);
  const df = computeDocFreq(tokens, index);

  return theses
    .map((thesis, i) => {
      const bm = bm25Score(query, thesis, i, index, df);
      return { thesis, score: bm.score, termScores: bm.termScores };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
```

`tokenize` already drops empties, so a whitespace-only query returns
`tokens.length === 0` and falls through to "everything, newest first".

`buildIndex` guards its own division: on an empty corpus it reports
`avgDocLen: 1` rather than `NaN`, so a single empty archive can never poison
every score with `NaN`.

---

## 4. Gap 3 — "Why this rank?" and the filters

### The breakdown must show honest arithmetic

Per query term, show IDF, TF, and the product, then the total:

```
biodiversity   IDF 2.14 × TF 1.00 = 2.14
river          IDF 3.01 × TF 1.00 = 3.01
─────────────────────────────────────────
Total: 5.15
```

Use the same numbers `bm25Score` computed. Do not recompute them for display —
two implementations of the same formula will eventually disagree, and the panel
becomes a thing that lies.

### Filters

- **Department ▼ · Year ▼ · Status ▼** — Status is staff-only; students never see it
- All three combine with the query using **AND** semantics, and with each other
- Staff default: their own department. Student default: "All Departments"
- Active filters render as chips with an X
- "Clear filters" returns to the full list

Read the option lists from `DEPARTMENTS` and `STATUSES` in `src/types.ts` rather
than hardcoding option arrays in the component.

### Relevance percentage

Normalise against the top result's score, not a fixed ceiling:

```typescript
const maxScore = Math.max(...results.map((r) => r.score), 0.01);
const pct = Math.round((score / maxScore) * 93) + 4;
```

This maps the best result to 97% rather than 100%, which is deliberate — a search
UI showing "Relevance: 100%" reads as a claim the system cannot actually make, and
users distrust it. The `0.01` floor is what stops a division by zero when nothing
matched.

Do **not** normalise against a fixed ceiling. A raw score of 3.2 against a ceiling
of 20 shows every result as 16%, which looks broken even when the ranking is right.

---

## 5. Empty states

| Situation | Show |
|-----------|------|
| No query, no filters | all theses, newest first |
| Query matches nothing | "No theses found" / "Try different keywords, adjust filters, or check spelling." |
| Database empty | a sensible empty dashboard, not a crash |

These are different states. Do not collapse "no results" and "no data" into the
same message.

---

## 6. Performance — already done, do not redo it

This was the one real performance bug in the prototype and it is **already
fixed**. Do not "optimise" it again; move the existing code.

**What was wrong.** `bm25Score` took the whole corpus as an argument and, for
*each* document it was scoring, looped over the *entire* corpus re-tokenising
every title, abstract and keyword list just to count document frequency. Scoring
D documents therefore cost D × D tokenisations. On top of that, `SearchScreen`
computed `results` as a bare IIFE in the render body, so it re-ran on *any* state
change — hovering a preview, expanding a rank, ticking a checkbox.

**What replaced it.** `buildIndex` pre-tokenises the corpus once and builds a
postings map. `computeDocFreq` walks the vocabulary once per query. Both are
wrapped in `useMemo`, and the index is built from the *filtered* set so that N,
document frequency and `avgDocLen` all describe the same corpus.

```typescript
const filtered = useMemo(() => { /* dept / year / status filters */ },
  [theses, deptFilter, yearFilter, statusFilter]);

const index = useMemo(() => buildIndex(filtered), [filtered]);

const results = useMemo(() => {
  if (!query.trim()) {
    return filtered
      .map((t) => ({ thesis: t, score: 0, termScores: [] }))
      .sort((a, b) => b.thesis.dateAdded.localeCompare(a.thesis.dateAdded));
  }
  const df = computeDocFreq(tokenize(query), index);
  return filtered
    .map((t, i) => ({ thesis: t, ...bm25Score(query, t, i, index, df) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}, [filtered, index, query]);
```

**Measured**, 200 theses, query `biodiversity water quality assessment`:

| | Time |
|---|------|
| Original | 461 ms |
| Indexed | 6.3 ms |

Roughly 73× faster, and the gap widens with corpus size. At 20 seed theses both
are imperceptible, so this will never show up in manual testing — which is
exactly why it was worth fixing before the group starts adding data.

If the collection ever grows past roughly a thousand, move the index into a
`useMemo` keyed on thesis id and a Web Worker. Do not build that yet.

---

## 7. Seed data — your other job

The prototype has 8 sample theses. **Write at least 20.**

Eight documents give BM25 almost nothing to discriminate between, the relevance
percentages all look similar, and the combined summary in step 07 has nothing to
summarise. Twenty varied abstracts with overlapping terminology is what makes
search look like it works.

Spread them across departments and years, and reuse vocabulary deliberately
("biodiversity", "Cagayan River", "rice", "e-commerce", "stem") so queries
actually have something to match against.

---

## 8. Verification

- [ ] Typing `Bio` surfaces the Biodiversity thesis, ~300ms after you stop typing
- [ ] Typing `diver` also surfaces it
- [ ] A single-character query does not search
- [ ] An empty query returns all theses, newest first
- [ ] "Why this rank?" shows real term math that sums to the displayed total
- [ ] The top result shows the **highest** relevance percentage. It reads ~97%,
      not 100% — that is deliberate, see §4
- [ ] Searching `rate` does **not** surface the machine-learning or watershed
      theses. If it does, the `length >= 4` guard in `findMatchScore` was lost
- [ ] Department / Year / Status filters combine with the query and with each other
- [ ] Active filters appear as removable chips; "Clear filters" resets everything
- [ ] Staff see their own department preselected; students see "All Departments"
- [ ] Students do not see the Status filter
- [ ] Ranking is **identical** to before the move to `search.ts` — verify by
      running the same query before and after
- [ ] An archive with zero theses shows the empty state and does not print `NaN`
- [ ] `search.ts` imports nothing from `firebase/*`
- [ ] Seed has ≥ 20 theses

---

**Next:** `06-pdf-extraction.md` (register flow) and `07-combined-summary.md`.
These are independent — take whichever you prefer.
