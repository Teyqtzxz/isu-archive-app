# 07 — Combined Summary (extractive, with citations)

**Status:** ☑ DONE — merged in PRs #12 and #13; the §6 checks were done by hand in the
browser on 2026-10-02. The summariser uses MMR rather than the §3 points system — see §7.
**Changed 2026-10-07 (group decision):** the summary has **one sentence per ticked thesis**,
with no upper limit, and never quotes a thesis twice (was: at most 4 sentences) — see §7.
**Owner:** B · **Depends on:** 05 · **Next:** 08

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Create
> `src/summary.ts` with the extractive algorithm below, replace the hardcoded
> summary string in `CombinedSummaryPanel.tsx`, implement the Close-only action bar, and
> make citation chips jump to their source result. Do not call any AI or API."*

---

## 1. What it does

From the Search screen, **"View Summary (N)"** opens a panel that:

1. Takes the theses the user **ticked**, in rank order
2. Reads their abstracts
3. Produces **one sentence per ticked thesis** covering the common themes (see §7)
4. Tags each with a citation chip `[n]` where `n` is that thesis's **visible
   rank** in the result list — tick results #2 and #5 and the chips read `[2]`
   and `[5]`, not `[1]` and `[2]`
5. Highlights the query keywords in `--isu-yellow-light`

No AI, no API, no server. It must work offline from the abstracts already in
memory. This is an **extractive** summariser: it selects real sentences, it does
not write new prose.

### The trigger is manual selection, not "top 5" — decided during the bug fix

Earlier drafts of these docs said the panel opens automatically over the **top 5
ranked results**. The prototype disagreed with that in a more useful way, and the
code was kept:

- Every result row has a **checkbox**
- **"View Summary (N)"** appears only once N ≥ 1, where N is the number of
  **ticked** rows
- The panel summarises exactly those N theses — no automatic top-5, and no
  hidden cap: tick 7 and all 7 are used
- N counts only ticked results **still visible** under the current filters.
  Today `SearchScreen` shows `selected.size`, which still counts a ticked result
  after a filter hides it — so the button can say 3 while the panel gets 2.
  Count `results.filter(r => selected.has(r.thesis.id)).length` instead

The prototype also had a *second*, floating "Combined Summary" button that took
the top 10 and appeared whenever 2+ results existed. Two buttons, two different
inputs, two different thresholds, and no way for a user to know which one they
were about to press. That one was deleted.

**If your group prefers the automatic version**, it is a small change: drop the
checkbox state, and in `SearchScreen` call
`onCombinedSummary(results.slice(0, 5).map((r, i) => ({ thesis: r.thesis, rank: i + 1 })), query)`.
Everything else in this file is unaffected. Do that *before* you build the panel, not after.

---

## 2. What to replace

`CombinedSummaryPanel` currently:

- shows a hardcoded string that says the same thing regardless of the results ❌
- has a `highlightKw()` helper — ✅ keep
- builds citation chips from the `theses` indices — keep the chip styling, but
  number them from `sourceIndex` (the visible rank), not the array index
- has a `copied` state and a Copy button — ❌ the design says **Close only**

**The payload changes shape.** `onCombinedSummary` now carries
`RankedThesis[]` instead of `Thesis[]`, so the `summaryData` type in `App.tsx`
changes too. `App.tsx` is A's file (`10` §2): ask A to change the one type
(`theses: Thesis[]` → `theses: RankedThesis[]`) in their branch, or agree that
you make that one-line change in yours. Do not refactor anything else there.

Replace the string, delete the Copy/Export buttons and the `copied` state
(including the `setTimeout(() => setCopied(false), 2000)` that exists only to
reset it). Keep the panel layout, the slide-up modal, the highlight helper and the
chips.

---

## 3. `src/summary.ts`

Pure functions. Import `tokenize` from `./search`; do not reimplement it.

```typescript
import { tokenize } from "./search";
import type { Thesis } from "./types";

export interface SummarySentence {
  text: string;
  sourceIndex: number;   // the thesis's visible rank = the [n] on its result card
}

/** A ticked result and the rank it was shown at. SearchScreen builds these —
 *  the rank is `index in results + 1`, NOT the position among ticked rows. */
export interface RankedThesis {
  thesis: Thesis;
  rank: number;
}

/* Splitting on every ". " shreds real thesis prose: "Dr. Maria Santos" becomes
   "Maria Santos", "Fig. 3" becomes "3". Thesis abstracts are full of adviser
   names, figure references and "et al.", so protect those periods first. */
const ABBREVIATION = new RegExp(
  String.raw`\b(?:Drs|Dr|Prof|Engr|Archd|Mr|Mrs|Ms|Mx|St|Sr|Jr|Fig|Figs|Eq|Eqs` +
  String.raw`|No|Nos|Vol|Ch|pp|ed|eds|al|i\.e|e\.g|vs|cf|approx|Inc|Ltd|Co|Dept|Univ)\.`,
  "gi",
);
const DOT = "\u0001";   // sentinel, cannot occur in extracted PDF text

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .replace(ABBREVIATION, (m) => m.slice(0, -1) + DOT)   // "Dr." → "Dr<DOT>"
    .split(/(?<=[.!?])\s+(?=[A-Z(“"'])/)
    .map((s) => s.replaceAll(DOT, ".").trim())
    .filter((s) => s.length > 20);   // drop fragments too short to be useful
}
```

The two-step approach matters. A single negative-lookbehind regex
(`(?<!Dr|Prof|…)\s*[.!?]\s+`) looks equivalent and is not — the lookbehind
consumes text and silently drops short sentences. Protect, split, restore is
predictable. Verified against six sentences containing `Dr.`, `Prof.`, `Engr.`,
`Fig.`, `et al.`, `Vol.`, `pp.` and `Eq.` — all six recovered intact.

Note the cost of the length filter: a genuinely short sentence in an abstract is
dropped rather than summarised. That is acceptable here (short sentences carry
little content and rank poorly in `scoreSentence` anyway), but it means the
summary can be shorter than `maxSentences`. Do not "fix" it by lowering the
threshold to 10 — that lets "et al." fragments through.

```typescript
function scoreSentence(
  sentence: string,
  terms: string[],
  isFirstInAbstract: boolean,
): number {
  const lower = sentence.toLowerCase();
  let score = 0;

  for (const t of terms) {
    if (lower.includes(t)) {
      score += 2;                                   // matched a query term
      score += lower.split(t).length - 1;           // +1 per extra occurrence
    }
  }

  if (isFirstInAbstract) score += 1;   // opening sentences usually state the aim
  const words = sentence.split(" ").length;
  if (words < 5) score -= 2;           // too short to be useful
  if (words > 60) score -= 1;          // too long to read

  return score;
}

/** Every ticked result is used — the user chose them. Order does not matter;
 *  output is put back into rank order at the end. */
export function summarise(
  results: RankedThesis[],
  query: string,
  maxSentences = 4,
): SummarySentence[] {
  const top = [...results].sort((a, b) => a.rank - b.rank);
  const terms = tokenize(query);

  const candidates: (SummarySentence & { score: number })[] = [];
  top.forEach(({ thesis, rank }) => {
    splitSentences(thesis.abstract).forEach((s, sIdx) => {
      candidates.push({
        text: s,
        sourceIndex: rank,
        score: scoreSentence(s, terms, sIdx === 0),
      });
    });
  });

  // --- Fallback: no query, or nothing matched. Use the opening sentence of the
  //     top results in rank order so the panel is never empty.
  if (terms.length === 0 || !candidates.some((c) => c.score > 0)) {
    return top
      .map(({ thesis, rank }) => {
        const first = splitSentences(thesis.abstract)[0];
        return first ? { text: first, sourceIndex: rank } : null;
      })
      .filter((x): x is SummarySentence => x !== null)
      .slice(0, maxSentences);
  }

  return candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.sourceIndex - b.sourceIndex)   // back into rank order
    .map(({ text, sourceIndex }) => ({ text, sourceIndex }));
}
```

The final `.sort()` by `sourceIndex` matters: sentences selected purely by score
come out in relevance order, which reads as random. Restoring rank order makes the
summary follow the same sequence the user just scrolled past.

---

## 4. Rendering

**Panel**

- Slide-up modal on mobile, centred ~600px on desktop
- Each sentence followed by its `[sourceIndex]` chip, styled with `--isu-green`
- Run the existing `highlightKw()` over each sentence so query words get
  `--isu-yellow-light`
- Action bar: **Close only**, green, full width on mobile

**Trigger button**

- Label is `View Summary (N)` where N is the number of **ticked** results
- Show it only when N ≥ 1
- N must match the results the panel will actually use — count ticked results
  that are still visible, and pass exactly those, each with its rank
- There is exactly **one** summary button. The prototype's second floating
  "Combined Summary" button was removed as a duplicate — see §1

**Citation chips**

Tapping a chip must take the user to that result. Do not try to reveal a card
*behind* the modal — it is behind an overlay, so it is either invisible or you are
fighting the backdrop. The workable behaviour:

```
chip click → close the panel
           → scrollIntoView({ block: "center" }) on the matching result card
           → flash a temporary highlight class, remove it after ~1.6s
```

Pass the target id up as `onCiteJump(thesisId)` and let `SearchScreen` own the
scrolling, so the panel does not need to know how result cards are rendered.

---

## 5. Honest limitations

Worth knowing before you demo, because a teacher may probe:

- Sentences are copied verbatim from abstracts, so the summary can be disjointed.
  A single "This study…" sentence from five different theses reads oddly, and
  ticking many theses gives an equally long summary (one sentence each).
- With one result, the summary is that abstract's single most relevant sentence.
  The panel says so.
- A ticked thesis with no sentence containing the search words is not quoted, so
  the summary can have fewer sentences than theses ticked.
- It matches on query terms only. A query with no matching sentence anywhere
  triggers the fallback rather than returning nothing.

---

## 6. Verification

- [ ] Search "biodiversity" → the summary contains real sentences about
      biodiversity, drawn from the top results
- [ ] Search a different keyword → a **different** summary
- [ ] Every sentence is traceable to an abstract you can find in the results
- [ ] Adviser names survive splitting — a summary sentence containing
      "Dr. …" or "Fig. …" is not truncated to "…" or "3"
- [ ] Citation chips correspond to visible rank: tick results #2 and #5 and the
      chips read `[2]` and `[5]`
- [ ] Ticking 7 results summarises from all 7 (no silent top-5 cap)
- [ ] Tick 3, then apply a filter that hides one: the button reads
      `View Summary (2)`
- [ ] Tapping a chip closes the panel and scrolls to that result
- [ ] Query words are highlighted in yellow
- [ ] An empty or non-matching query falls back gracefully instead of showing
      nothing
- [ ] "View Summary (N)" appears only when N ≥ 1, and N matches the ticked count
- [ ] Ticking two results and opening the panel summarises those two — and only
      those two
- [ ] The action bar has exactly one button — no Copy, no Export
- [ ] `grep -n "const extractive" src/components/CombinedSummaryPanel.tsx` returns
      nothing — that hardcoded template literal is the mock this step replaces
- [ ] `grep -n 'from "../summary"' src/components/CombinedSummaryPanel.tsx` finds
      a match — the panel now calls the real algorithm
- [ ] `grep -n "copied" src/components/CombinedSummaryPanel.tsx` returns nothing
      (the Copy button and its state are removed)
- [ ] No network request is made when the panel opens
- [ ] `npm run build` passes

---

## 7. What shipped: MMR instead of the §3 points system (2026-10-02)

The §3 `scoreSentence` (+2 per match, +1 for the first sentence, −2 if short…)
was replaced. Its weights had no source, it never compared the theses with each
other (so it could not find "common themes"), and it repeated itself: two
records with the same abstract produced the same sentence twice, and one thesis
could fill all four slots. `splitSentences`, the `summarise()` signature and the
panel are unchanged.

**Method — Maximal Marginal Relevance** (Carbonell & Goldstein, 1998):

1. **Query relevance** — every sentence is scored with the real `bm25Score()`
   from `search.ts`, treating each sentence as a small document. Search and
   summary therefore agree on what "relevant" means, and BM25's length
   normalisation replaces the old "too long" penalty.
2. **Centrality** (the idea behind LexRank, Erkan & Radev, 2004) — the average
   TF-IDF cosine similarity between a sentence and the sentences of the *other*
   ticked theses: how much it says what the rest of the selection also says.
3. **Relevance** = (BM25 ÷ best BM25 + centrality ÷ best centrality) ÷ 2. With a
   query, only sentences with BM25 > 0 are eligible. With no query or no match,
   relevance is centrality alone — a generic summary of the selection (this
   replaces the old "first sentence of each" fallback).
4. **Selection** — one sentence per ticked thesis: repeatedly take the sentence
   with the highest `λ·relevance − (1−λ)·(similarity to the closest sentence
   already picked)`, λ = 0.7 (the usual starting value), **only from theses not
   quoted yet**, until every thesis that can be quoted is. A sentence with
   cosine ≥ 0.8 to one already picked is never taken; a thesis whose sentences
   are all excluded (no query match, or only near-copies) is left out rather
   than another thesis being quoted twice. (Until 2026-10-07 the summary was
   capped at 4 sentences, so ticking 5+ theses left some unquoted.)
5. Output is put back into rank order, then abstract order within one thesis.

Measured on the 21 seed abstracts: no repeated sentences, at most one sentence
per thesis until every eligible thesis is quoted, ~12 ms with all 21 ticked.

**Trade-offs, honestly:** λ = 0.7 and the 0.8 duplicate cut-off are judgement
calls, tested on the seed data, not derived. Novelty can beat relevance — for
"rice" over all 21 theses MMR quotes #15 (rice *and corn* cooperatives, which
shares more with the other theses) instead of #3. Matching is still word-for-
word: "farming" and "agriculture" are different words to BM25 and to TF-IDF.
The summary still reads as quotes side by side; only rewriting (an AI) fixes
that, and that is out of scope.

**Smaller changes, unchanged from the first version of this step:**

- Middle initials are protected in `splitSentences` ("Prof. J. Cruz" was split
  after "J."). Cost: a sentence ending in a lone capital ("Vitamin A.") is not
  split there.
- `highlightKw()` builds React nodes instead of an HTML string, so abstract
  text is never parsed as HTML (and the original casing is kept).
- Result cards show their rank (`1.`, `2.`…) so a `[n]` chip can be traced by eye.
- `App.tsx` (A's file): `summaryData` type → `RankedThesis[]`, plus a
  `citeJump` state passed to `SearchScreen` as `jumpTo` for the chip scroll.

---

**Next:** `08-deployment.md` — build, deploy, and authorize the domain.
