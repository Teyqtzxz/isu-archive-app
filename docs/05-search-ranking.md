# 05 — Search & Ranking (BM25, debounce, filters)

**Status:** ☑ DONE — merged in PRs #10 and #11 (branch `person-b-search`).
**Owner:** B · **Depends on:** 04 · **Next:** 06 or 07

> **Ranking changed on 2026-10-14 (errata #61, professor's feedback).** Search
> now also reads the **authors, adviser and Academic Year**, and weighs fields
> with **BM25F** (a title hit counts 3×, keywords and names 2×, the abstract
> 1×). Tokens keep ñ and accents. See **§3a**. The "do not change `search.ts`"
> instructions below were for step 05 itself and are historical; the
> must-survive rules (§3, §6, §4 relevance) still hold.

### What shipped

- 300ms debounce in `SearchScreen` (`query` for the input, `debouncedQuery`
  for BM25). While a search is pending the count reads "Searching…".
- Queries shorter than 2 characters count as "no query" (all theses, newest first).
- `search.ts`: **no code change** (one comment corrected, see §3). A
  before/after harness over the 21 seed theses and 14 queries confirmed
  identical scores and ranking order.
- **"Why this rank?" was removed** at the group lead's request (§4). The
  relevance % badge stays.
- Department options come from `DEPARTMENTS` (all ten, even with no theses);
  staff start on their own department (prop from `App.tsx`), students on All.
- Active filters show as removable chips; "Clear filters" resets all three.
- "The archive is empty" and "No theses found" are separate states.

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. **`src/search.ts`
> already exists with `tokenize`, `findMatchScore`, `buildIndex`,
> `computeDocFreq`, `bestFieldFor` and `bm25Score` — leave every one of them
> exactly as they are and do not change the scoring maths.** Add the 300ms
> debounce, finish the filters, and add the empty states. There is no
> 'Why this rank?' panel — it was removed. Do not start step 06."*

---

## 1. What already works — already in `src/search.ts`, do not rewrite it

## ✅ DONE — the move into `src/search.ts` shipped with the module split (`c5644d4`)

`src/search.ts` and `SearchScreen.tsx` already contain a real, correct search
engine:

| Function | Status |
|----------|--------|
| `tokenize(text)` | ✅ works — NFC, lowercases, keeps Unicode letters (ñ, é), digits and `_`, splits on everything else, drops empties (§3a) |
| `findMatchScore(q, d)` | ✅ works — `1.0` exact, `0.8` prefix, `0.6` substring (4+ chars only), `0` none |
| `docTextOf(t)` | ✅ works — the searchable text: title + abstract + keywords + authors + adviser |
| `buildIndex(theses)` | ✅ works — pre-tokenises the corpus **per field**, keeps each study's year, builds a postings map |
| `computeDocFreq(tokens, index)` | ✅ works — document frequency per query term (a 4-digit term also counts studies of that year) |
| `bestFieldFor(index, docIndex, term)` | ✅ works — title / year / keyword / author / adviser / abstract (was for the removed breakdown panel; reads the prebuilt index, tokenises nothing) |
| `bm25Score(query, thesis, docIndex, index, df)` | ✅ works — BM25F (§3a), returns `{ score, termScores }` |
| `textOnly(text)` | ✅ new — a document with only `text` as its abstract; the summary scores sentences with it (§3a) |
| `relevancePercent(score, maxScore)` | ✅ new — the relevance badge, top result 97% (§4) |
| `SearchScreen` filters by department / year / status | ✅ works |
| Empty query sorts newest-first | ✅ works |
| "Relevance: XX%" badges | ✅ works |
| "Why this rank?" per-term breakdown | ❌ removed 2026-09-30 (§4) |

It is already in `src/search.ts`. **Do not move, rewrite or "improve" it.** Your
job is only the remaining gaps below. (Historical: step 05 itself changed no
scoring. The field weighting in §3a came later, errata #61.)

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

Measured against the 21 seed theses:

| Query | With the guard | Without it |
|-------|----------------|------------|
| `ion` | 0 theses | **all 21** — it is inside almost every word |
| `ate` | 0 theses | 18 |
| `dr`  | prefix only (`drainage`…) | also `hydrological` |

`dr` substring-matching `hydrological` is why searching an adviser's name like
`Dr. Maria Santos` used to return a hydrology thesis.

**What the guard does not do:** a 4+ letter term still matches mid-word, by
design — that is what makes `diver` find *Biodiversity*. So `rate` legitimately
matches `demonstrated`, `integrated`, `generated` and surfaces ~10 theses, with
or without the guard. An earlier version of this doc used `rate` as the test
for the guard; it could never have passed. Use `ion` (§8).

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
scale, and any per-term figure reports a real number instead of a
fabricated one. Keep it.

### Single-character guard

A one-character query should not search. It matches too much to be useful and
wastes a full corpus scan. `findMatchScore` already returns `0` for terms shorter
than two characters, so this is handled.

The sketch below is **illustrative only** — there is no `searchTheses` or
`sortByNewest` in the code, and you should not add them. The real equivalent is
the `results` `useMemo` in `SearchScreen.tsx` (§6), which already returns
everything newest-first for an empty query:

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

## 3a. Field weighting (BM25F), authors, adviser and year — errata #61

### Fields and weights

| Field | Weight w | b (length normalisation) | Why |
|-------|----------|--------------------------|-----|
| Title | **3** | **0** | The author's own one-line summary: one hit there says more than one hit in a 250-word abstract. b = 0: a 5-word title is no less about "sample" than a 2-word one |
| Keywords | **2** | 0.75 | Topic labels picked by staff: more reliable than the abstract, less than the title |
| Authors | **2** | 0 | A name typed in the box means that person is wanted; names rarely collide with abstract words, so 2 is enough. Name length says nothing |
| Adviser | **2** | 0 | Same as authors |
| Abstract | **1** | 0.75 | The baseline — the old BM25 |
| Year | **3** | — | Exact match of a 4-digit query word with the Academic Year |

The weights are constants at the top of `search.ts` (`FIELD_WEIGHTS`,
`FIELD_B`, `YEAR_WEIGHT`). Change them there, and re-run
`node src/search.check.ts`.

### The formula (BM25F)

```
tf̃(term, study) = Σ over fields  w_f · tf_f / (1 − b_f + b_f · len_f / avgLen_f)
                  + 3 if the term is 4 digits and equals the study's year
score            = Σ over terms   idf(term) · tf̃ · (k1 + 1) / (tf̃ + k1)        k1 = 1.5
idf(term)        = ln((N − df + 0.5) / (df + 0.5) + 1)
```

- `tf_f` is still the fuzzy count from `findMatchScore`: exact 1.0, prefix 0.8,
  substring 0.6 (4+ letters only).
- Each field is normalised against **its own** average length (`avgFieldLen`).
  An empty corpus, or a field nobody filled, falls back to 1, like `avgDocLen`.
- The fields are added **before** the saturation. A word in the title *and* the
  abstract therefore scores more than either alone, but not twice as much.
- `df` counts the studies with a match in **any** field, plus, for a 4-digit
  term, the studies of that year. A year query therefore gets a sensible idf: a
  year shared by every study counts for little.
- With only the abstract filled (weight 1, b 0.75), this is exactly the old
  BM25. That is why the summary did not change (below).

### Names: titles and degrees are not indexed

`Dr.`, `Engr.`, `Prof.`, `Asst.`, `Assoc.`, `Mr.`, `Mrs.`, `Ms.`, `Atty.` and
the degrees `PhD`, `EdD`, `MSc`, `MS`, `MA`, `MIT`, `MBA`, `RN`, `PE`, `CE` (the ones
`validation.ts` accepts) are dropped from the author and adviser fields.
Otherwise `Dr. Santos` would match every "Dr." adviser, the old `dr` bug again.
`Dr. Stone` still finds Stone first, through "stone". The result card does
not highlight these words in the author and adviser lines either
(`isNameTitle()`): "Dr. Stone" never marks the "Dr" of Dr. Santos. The abstract
snippet and the summary still mark "Dr" in prose; only the name lines skip it.

### Year

- Only a query word of exactly **4 digits** checks the year, and only for
  equality. `20` and `202` never match the year field; they still prefix-match
  text as before.
- A year in the text still counts as text, so a 2024 study that also says "2024"
  scores a little higher.
- This is ranking, not a filter: the Year dropdown is separate and unchanged.

### Tokenizer: ñ and accents are letters

```typescript
text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\d_\s]/gu, " ")
```

- `niño`, `Peñablanca` and `José` stay whole words. Before, `niño` became `ni`
  + `o`, and `ni` prefix-matched unrelated words.
- `NFC` makes an `é` copied out of a PDF as `e` + accent match a typed `é`.
- Accents are **not** folded: `nino` does not find `niño`.
- `queryWordPattern()` in `snippet.ts` uses the same letters, so the
  highlighting matches: `ni` marks all of "Niño".

### On the card

While searching, the query words are highlighted in the **author names** and
the **adviser** line as well as in the snippet. All three use the same
`highlightKw()` (rule: `highlightParts()` in `snippet.ts`). "Author:"/"Authors:",
"+N more", and titles and degrees in the names are never marked.

### Before / after on the 13 real studies (2026-10-14)

| Query | Before | After |
|-------|--------|-------|
| `sample` | needs review sample 97 · thesis sample 2 57 · thesis sample 2 scanned 57 · Sample Thesis for pdf reader 57 · Vit sample 42 | needs review sample 97 · Vit sample 80 · thesis sample 2 scanned 80 · thesis sample 2 80 · Sample Thesis for pdf reader 80 |
| `learning` | the seven "Vit…" studies 97 · Thesis2, Thesis 88 | the same seven 97 · Thesis2, Thesis 81 |
| `irrigation` | the 3 studies with it in their keywords, 97 | the same 3, 97 |
| `Acosta` | no results | Vit with Author 97 |
| `Stone` | no results | Vit with Author, Vit, Vit sample — 97 |
| `2024` | no results | the 5 studies of 2024, 97 |
| `niño` | Thesis2, Thesis (wrong: via "ni…") | no results (correct) |

On "sample":
- "needs review sample" says the word twice (title and a 5-word abstract), so it
  stays first.
- The title-only hits now tie, because title length no longer counts.
- Equal scores keep the newest-first order. "Sample Thesis for pdf reader" is
  5th only by that tie order, and no tie-break was added (the owner's decision).

### The summary trap

`summary.ts` scores single sentences with this same `bm25Score`. It used to
build `{ ...thesis, title: "", keywords: [], abstract: sentence }`. With
authors, adviser and year now indexed, that would have made **every** sentence
of a study "match" its author's name or its year. It now uses
`textOnly(sentence)`: the sentence and nothing else.

`search.check.ts` proves the summary is unchanged. It compares every sentence's
score and the final picks for 8 queries against values recorded on `main`
before the change. One exception is on purpose: on text containing ñ or accents
the word count changes (`niño` is one word now, not two), and so do the scores,
slightly.

---

## 4. Gap 3 — the filters

### "Why this rank?" — removed

The per-term breakdown panel was **removed on 2026-09-30 at the group lead's
request**. It had been built (IDF × TF = score per term, plus the total) and
then taken out; `search.ts` is back to its original code. Results still show
the relevance % badge. Do not re-add the panel unless the group decides to.

`bm25Score` still returns `termScores` and `bestFieldFor` is still exported —
the rule "leave every search.ts function exactly as it is" wins over removing
now-unused output.

### Filters

- **Department ▼ · Year ▼ · Status ▼** — Status is staff-only; students never see it
- All three combine with the query using **AND** semantics, and with each other
- Staff default: their own department. Student default: "All Departments"
- Active filters render as chips with an X
- "Clear filters" returns to the full list

(The Status filter was removed on 2026-10-12 with the review step — errata #50.)
Read the option lists from `DEPARTMENTS` in `src/types.ts` rather
than hardcoding option arrays in the component. (Today the department dropdown
derives its options from the loaded theses — `allDepts` in `SearchScreen.tsx` —
so a department with no theses yet is missing. Switch it to `DEPARTMENTS`.)

The staff default department comes from `App.tsx` as a prop (`04` §2.3). It is
one of the exact `DEPARTMENTS` strings.

### Relevance percentage

Normalise against the top result's score, not a fixed ceiling:

```typescript
// search.ts — SearchScreen calls relevancePercent(score, maxScore)
export function relevancePercent(score: number, maxScore: number): number {
  return Math.round((score / Math.max(maxScore, 0.01)) * 93) + 4;
}
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

## ✅ DONE

This was the one real performance bug in the prototype and it is **already
fixed**. Do not "optimise" it again.

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
const filtered = useMemo(() => { /* dept / year filters */ },
  [theses, deptFilter, yearFilter]);

const index = useMemo(() => buildIndex(filtered), [filtered]);

const results = useMemo(() => {
  if (!query.trim()) {
    return filtered
      .map((t) => ({ thesis: t, score: 0, termScores: [] }))
      .sort((a, b) => registeredAtISO(b.thesis).localeCompare(registeredAtISO(a.thesis)));
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

## 7. Seed data

## ⚠️ REMOVED (2026-10-12) — the sample theses are gone

The 21 sample theses were deleted on the professor's request: the e-library
holds real studies only (`02` §6). The measurements in this file were taken
on them and stay valid as a record. Do not add sample data back to test
search; test on the real studies staff have posted.

Why there were 21 rather than the prototype's 8, kept for the record:

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
- [ ] The top result shows the **highest** relevance percentage. It reads ~97%,
      not 100% — that is deliberate, see §4
- [ ] Searching `ion` returns **no results** ("No theses found"). If it returns
      every thesis, the `length >= 4` guard in `findMatchScore` was lost
- [ ] Department / Year filters combine with the query and with each other
- [ ] Active filters appear as removable chips; "Clear filters" resets everything
- [ ] Staff see their own department preselected; students see "All Departments"
- [ ] Nobody sees a Status filter (removed 2026-10-12)
- [ ] **[auto]** `node src/search.check.ts` ends with "All passed." It checks
      that a title hit beats an abstract hit, that authors and the adviser are
      found ("Acosta", "Stone", "Dr. Stone"), the year match and its df, that ñ
      is kept, every must-survive rule, and that the combined summary is
      unchanged against values recorded on `main`
- [ ] `Acosta` / `Stone` find their studies, with the name highlighted on the
      card; `2024` lists that year's studies; `niño` finds only studies that
      contain "niño"
- [ ] A change to the weights or the formula comes with a before/after table on
      the real studies (like §3a), not "ranking identical": ranking is
      *meant* to change when the weights do
- [ ] An archive with zero theses shows the empty state and does not print `NaN`
- [ ] `search.ts` imports nothing from `firebase/*`
- [x] Seed has ≥ 20 theses (21, step 02)
- [ ] The department dropdown lists all ten `DEPARTMENTS`, even ones with no theses
- [ ] `bm25Score` still takes `(query, thesis, docIndex, index, df)` and reads
      only the index; `bestFieldFor` reads `index.fieldTokens` and tokenises
      nothing

---

**Next:** `06-pdf-extraction.md` (register flow) and `07-combined-summary.md`.
These are independent — take whichever you prefer.
