# 16 — Smart Search Box (Trie autocomplete + Levenshtein "Did you mean")

**Status:** ☑ DONE — branch `feat/smart-search` (errata #66).
**Code:** `src/levenshtein.ts`, `src/trie.ts`, `src/smartSearch.ts` (pure, no
React, no Firebase) · examples in `src/levenshtein.check.ts`,
`src/trie.check.ts`, `src/smartSearch.check.ts` (`node src/<name>.check.ts`;
the last one also times 300 synthetic studies) · UI in
`src/components/SmartSearchInput.tsx` (both search boxes) and
`SearchScreen.tsx` ("Did you mean" and "Showing results for").

The search boxes get two helpers, both written from scratch for this project
(no library):

1. **Autocomplete.** While you type, a list under the box offers words and
   keyword phrases from the e-library that finish the word you are typing:
   `irr` → *irrigation*, `rice fa` → *rice farming*. Words are stored in a
   **Trie** (prefix tree).
2. **"Did you mean…?"** When a word you searched matches nothing in the
   e-library, the Search screen offers the closest word, found with the
   **Levenshtein distance**: `machne lerning` → *Did you mean: **machine
   learning**?*

Autocomplete only **suggests**: the box changes only when you pick a row.
A correction is shown as a **button** ("Did you mean…?") — except in one
safe case, where the search runs the correction at once and says so:
`irigation` (0 results) → *Showing results for **irrigation*** with a
*Search instead for "irigation"* link (§7). The box always keeps what you
typed. Search ranking (`search.ts`, BM25F), `summary.ts`, `data.ts`, `types.ts` and
`firestore.rules` are unchanged, and nothing is stored. A "word" is whatever
`tokenize()` in `search.ts` says it is, so the helpers and search always agree.

---

## 1. Where it shows

| Box | Autocomplete | "Did you mean" |
|---|---|---|
| Student dashboard (hero box) | ✔ | — (Enter opens the Search screen, which shows it) |
| Search screen (students, and the staff **Search** tab) | ✔ | ✔ above the results (a button, or "Showing results for", §7) |

Staff Dashboard has no search box of its own; its Search tab is the Search screen.

**Keyboard.** ↓ / ↑ move through the list (they wrap around). **Enter** or
**Tab** picks the highlighted row. **Esc** closes the list. With nothing
highlighted, Enter searches as before and Tab moves focus as usual. While an
input method (Japanese, Chinese, some phone keyboards) is still composing a
word, these keys belong to it and the box ignores them
(`e.nativeEvent.isComposing`): Enter then only confirms the composed text.

**The list closes** on Esc, when you leave the box, after a pick and when the
box is emptied. It never opens while the box is empty, and it does not pop up
when the Search screen opens with words already in the box.

**Accessibility.** The ARIA *combobox* pattern: the input has
`role="combobox"`, `aria-expanded`, `aria-controls`,
`aria-autocomplete="list"` and `aria-activedescendant`. The list is a
`role="listbox"` of `role="option"` rows with `aria-selected`.

**Phone.** Rows are 44px tall (a comfortable tap). The list is as wide as the
box, so it fits a 360px screen. A tap picks the row without closing the
keyboard first.

**Dark mode.** Theme tokens only (`--surface`, `--border`, `--surface-hover`,
`--accent-soft`, `--accent`, `--text-muted`).

---

## 2. Levenshtein distance — "how many typing mistakes apart?"

The **Levenshtein distance** between two words is the smallest number of
one-letter edits that turns one into the other. Each edit costs **1**:

- **add** a letter: `irigation` → `irrigation`
- **remove** a letter: `soill` → `soil`
- **change** a letter: `cat` → `cut`

### The table

Write the first word down the side and the second across the top, each
starting with an empty "" row and column. Cell (*row*, *column*) holds the
distance between the letters **up to** that row and the letters **up to**
that column.

- Row 0 is 0, 1, 2, 3…: to make the first *j* letters out of nothing takes
  *j* additions.
- Column 0 is 0, 1, 2, 3…: to turn the first *i* letters into nothing takes
  *i* removals.
- Every other cell is the **smallest** of three moves:
  - from the **left** + 1 (add a letter)
  - from **above** + 1 (remove a letter)
  - from the **top-left** + 0 if the two letters are the same, + 1 if they
    differ (change a letter)

The answer is the **bottom-right** cell.

### Worked example 1: `cat` → `cut` (filled in by hand)

|       | ""  | c   | u   | t   |
|-------|-----|-----|-----|-----|
| **""**| 0   | 1   | 2   | 3   |
| **c** | 1   | **0** | 1 | 2   |
| **a** | 2   | 1   | **1** | 2 |
| **t** | 3   | 2   | 2   | **1** |

Some cells worked out:

- (c, c): same letter, so top-left 0 + 0 = **0**.
- (a, u): different letters. Top-left 0 + 1 = 1; left 1 + 1 = 2; above 1 + 1
  = 2. The smallest is **1**: change *a* into *u*.
- (t, t): same letter, so top-left 1 + 0 = **1**.

**Distance = 1**: one change (*a* → *u*). The bold cells are the cheapest
path.

### Worked example 2: `irigation` → `irrigation` (filled in by hand)

|        | ""  | i | r | r | i | g | a | t | i | o | n  |
|--------|-----|---|---|---|---|---|---|---|---|---|----|
| **""** | 0   | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| **i**  | 1   | **0** | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| **r**  | 2   | 1 | **0** | **1** | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| **i**  | 3   | 2 | 1 | 1 | **1** | 2 | 3 | 4 | 5 | 6 | 7 |
| **g**  | 4   | 3 | 2 | 2 | 2 | **1** | 2 | 3 | 4 | 5 | 6 |
| **a**  | 5   | 4 | 3 | 3 | 3 | 2 | **1** | 2 | 3 | 4 | 5 |
| **t**  | 6   | 5 | 4 | 4 | 4 | 3 | 2 | **1** | 2 | 3 | 4 |
| **i**  | 7   | 6 | 5 | 5 | 4 | 4 | 3 | 2 | **1** | 2 | 3 |
| **o**  | 8   | 7 | 6 | 6 | 5 | 5 | 4 | 3 | 2 | **1** | 2 |
| **n**  | 9   | 8 | 7 | 7 | 6 | 6 | 5 | 4 | 3 | 2 | **1** |

Some cells worked out:

- (r, first r): same letter, so top-left 0 + 0 = **0**.
- (r, second r): same letter again, so top-left 1 + 0 = 1, and left 0 + 1 =
  1. That is **1**: the extra *r* is the one **added** letter, a step to the
  right.
- (i, i in column 4): same letter, so top-left 1 + 0 = **1**.
- From there every letter matches, so the diagonal stays at 1 all the way to
  (n, n).

**Distance = 1**: one added *r*. `levenshtein.check.ts` holds these two tables
cell for cell, so a mistake here would make a check fail.

### Two rows instead of the whole table

Each row is built **only from the row above it**. Once row 3 is done, rows 0–2
are never read again. So `levenshtein()` keeps just two arrays, the row above
and the row being built. Memory is two short lists instead of a whole grid.
`levenshteinTable()` builds the full table only for teaching and for the
checks.

### Stopping early

"Did you mean" only wants words within 1 or 2 edits (§4), so `levenshtein(a,
b, max)` can stop early:

- **Before starting:** if the two lengths differ by more than `max`, it would
  take more than `max` additions or removals, so it returns `max + 1` at once.
- **During the rows:** a cell is never smaller than the smallest cell of the
  row above (an edit never costs less than 0). So once **every** cell of a row
  is above `max`, the final answer must be too, and it returns `max + 1`.

A check compares the early-stopping answer with the full table on **5000
random word pairs** (letters including ñ and é): they always agree when the
distance is ≤ `max`.

### Letters, not characters

Both words are `normalize("NFC")`-ed and split by code point (`[...word]`).
So an **ñ** typed as one character and an ñ pasted from a PDF as *n* + a
combining tilde both count as **one** letter (`niño` vs the pasted `niño` =
0).

---

## 3. The Trie — autocomplete

A **Trie** (prefix tree) stores words letter by letter. Words that start the
same share their first nodes. Here are five words:

```
(root)
 ├─ s ─ o ─┬─ i ─ l● ─ s●                  soil, soils
 │         └─ r ─ g ─ h ─ u ─ m●           sorghum
 └─ i ─ r ─ r ─ i ─ g ─ a ─ t ─┬─ e●        irrigate
                               └─ i ─ o ─ n●  irrigation

● = a stored word ends here
```

To find every word starting with `soi`, walk **s → o → i** and collect
everything below: *soil*, *soils*. That is three steps however many words are
stored, so a keystroke never scans the whole word list. `trie.ts` knows
nothing about studies: it stores values under text keys, and
`smartSearch.ts` decides what goes in.

### What goes in

Built from search's own index (`buildIndex()`), so every suggestion is a word
search can find:

| From | Example | Notes |
|---|---|---|
| title words | *machine*, *management* | |
| keyword words **and** each whole keyword phrase | *soil*, *soil moisture* | a phrase is one entry |
| author names | *acosta* | |
| adviser names | *pagulayan* | Dr., Engr., Prof., PhD… are left out (`isNameTitle`) |
| abstract words | *irrigate*, *many* | |

Never 1-letter words, plain numbers (years) or common words (`STOP_WORDS`
from `similarity.ts`: *the, of, study, research…*).

**Lookup key.** Lowercase with accents removed (`foldKey`), so `nin`, `Niñ`
and `NIN` all reach *niño*. The word put into the box keeps its accent
(*niño*), because search does not fold accents (`nino` ≠ `niño` in search).

### Which word is completed

- The **last** word, and only while it is still being typed. A query ending
  in a space or punctuation gets no list.
- It must have at least **2 letters**, the same minimum search uses.
- The last **2–3 words** are also matched against keyword phrases, so `rice
  fa` → *rice farming* and `crop yield pr` → *crop yield prediction*. Phrase
  matches of several words come first.
- A word already typed in full is not offered back: `machine` offers only
  *machine learning*.

### Ranking (at most 6 rows)

Phrase matches of the last 2–3 words come first (`rice fa` → *rice
farming*). Then, inside that and inside the single-word matches:

1. **Two groups.** Words seen in a title, keyword, author or adviser first;
   words seen **only** in abstracts last. Abstracts are full of filler
   (*many*, *massive*, *far*), so those sink to the bottom.
2. **More studies** containing it, inside each group: `ma` → *machine*
   (8 studies) before *management* (1).
3. **A–Z**, so the order never depends on how the studies were loaded.

Each row shows the word, its field and "*N* studies".

### Picking a suggestion

Only the words it matched are replaced. Everything before them stays exactly
as typed (capitals, extra spaces, punctuation), and a space is added for the
next word:

| Box | Picked | Box after |
|---|---|---|
| `rice fa` | rice farming (2 words) | `rice farming ` |
| `Rice  FA` | farming (1 word) | `Rice  farming ` |
| `Rice  FA` | rice farming (2 words) | `rice farming ` |
| `SOIL  Rice  fa` | rice farming (2 words) | `SOIL  rice farming ` |
| `soil, irr` | irrigation | `soil, irrigation ` |

---

## 4. "Did you mean…?"

### When it shows

On the Search screen, above the results, when **at least one searched word
matches nothing** in the whole e-library **and** a close word exists. Most
corrections are a button; the safe ones are searched at once (§7). It does
not depend on the number of results: `rice irigation` finds 3 studies through
*rice*, but *irigation* is wasted, so it still offers *rice irrigation*.

"Matches nothing" uses search's own rule (`findMatchScore`) against
**every** word search indexes, common words included. So it says "no" only
when search really finds nothing for that word. `socialnes` (the start of
*socialness*) and `ediction` (inside *prediction*) count as found.

### Words it never touches

- shorter than **4** letters. With 3 letters almost anything is 1 edit from
  a real word, and most 3-letter words in research are acronyms: in a test
  library `GIS` was "corrected" to *gas*. `GIS`, `IoT`, `ICT` are never
  changed.
- numbers and years (`2024`, `1999`)
- titles and degrees (`Dr`, `Engr`, `PhD`…)
- common words (`the`, `of`, `and`…), even in a library without them

### How close is close enough

| Typed word | Most edits allowed |
|---|---|
| 4 letters | 1 |
| 5+ letters | 2 |

A short word with two edits is usually a different word (*rice* → *risk*).

### Tie-breaks (when two words are equally close)

1. Fewer edits.
2. **Same first letter** as the typed word. People rarely get the first
   letter wrong. `Acosat` is 2 edits from both *acosta* and *cost*; without
   this rule *cost* would win, because it is in more studies.
3. Length closer to the typed word.
4. In more studies (`firm` → *form* (2 studies) over *farm* (1)).
5. A–Z (`past` → *pest* before *post*).

### What it looks like

> Did you mean: rice **irrigation**?

It is one button, with the changed words in bold. Clicking it puts that query
in the box and searches at once. When the correction is safe enough, the
search runs it by itself instead and shows a note (§7).

**No loop.** A correction is always a word search indexes, so the corrected
query has nothing left to correct and the line disappears. The check tries
this on 8 queries.

**Accent-only typos.** `nino` (no study has it) → *Did you mean: **niño**?*
(1 edit: n ≠ ñ).

---

## 5. Speed

The word list and the Trie are built **once per data change**: one `useMemo`
in `App.tsx`, shared by both boxes. They are never rebuilt per keystroke.

- **Autocomplete:** one walk down the Trie per keystroke, then a sort of
  what is below that node.
- **"Did you mean":** runs on the 300 ms debounced query, and only for words
  search does not match. It compares only words whose length is within the
  allowed edits (words are kept grouped by length), and each comparison stops
  early (§2).

Measured by `node src/smartSearch.check.ts` (300 synthetic studies, 10-word
titles, 240-word abstracts, 5 keywords, 2 authors, an adviser each):

| Step | Time |
|---|---|
| Build once (2264 distinct words) | ≈ 85 ms |
| Autocomplete | ≈ 0.07 ms per keystroke |
| Did you mean | ≈ 0.9 ms per query |

---

## 6. On the real e-library (2026-10-16, 13 studies, shipped code)

Read with the app's own read-only subscription; nothing was saved.

| Typed | Autocomplete (field, studies) |
|---|---|
| `irr` | irrigation (keyword, 3) · irrigate (abstract, 3) |
| `soi` | soil (keyword, 5) · soil moisture (keyword, 3) |
| `mac` | machine (keyword, 8) · machine learning (keyword, 2) |
| `ma` | machine (8) · machine learning (2) · management (title, 1) · maria (adviser, 1) · many (abstract, 6) · massive (abstract, 6) |
| `acos` | acosta (author, 1) |
| `pag` | pagulayan (adviser, 3) |
| `cro` | crop (keyword, 2) · crop yield prediction (keyword, 2) |
| `rice fa` | **rice farming** (keyword, 3) · farming · farms · factors · failed · far |
| `zzz` | nothing; the list stays closed |

All departments, all years. "Results" = studies found as typed → found by
the correction.

| Typed | Correction | Results | What happens |
|---|---|---|---|
| `irigation` | irrigation | 0 → 3 | **auto-corrected** |
| `machne lerning` | machine learning | 0 → 9 | **auto-corrected** |
| `Isabella` | isabela | 0 → 5 | **auto-corrected** |
| `philipines` | philippines | 0 → 2 | **auto-corrected** |
| `maching` | machine | 0 → 8 | **auto-corrected** |
| `sooil` | soil | 0 → 5 | **auto-corrected** |
| `moistrue` | moisture (2 edits: swapped letters) | 0 → 3 | button |
| `Acosat` | acosta (2 edits; first-letter tie-break) | 0 → 1 | button |
| `crop yeild` | crop yield (2 edits) | 2 → 5 | button |
| `yeld` | yield (4 letters) | 0 → 5 | button |
| `rice irigation` | rice irrigation | 3 → 3 | button (*rice* already finds studies) |
| `GIS`, `IoT`, `ICT` | — (3 letters) | 0 | nothing |
| `eskwela` (correct, 1 study) | — | 1 | nothing |
| `2024`, `the`, `of`, `Rice`, `the 2024 eskwela` | — | 5–13 | nothing |

---

## 7. When the search corrects itself

`searchPlan()` in `smartSearch.ts` decides, for each searched query, one of:

| Mode | Searches | Shows |
|---|---|---|
| **as-typed** | the typed query | nothing extra (correct spelling: exactly as before) |
| **auto-corrected** | the correction | *Showing results for **fixed** words* and a small *Search instead for "typed words"* link |
| **suggest** | the typed query | the *Did you mean: …?* button |

### The three conditions

The search corrects itself only when **all three** are true:

1. **(a)** the query **as typed finds 0 results** with the current filters;
2. **(b)** **every** corrected word was typed with **5+ letters** and is
   **exactly 1 edit** from its fix;
3. **(c)** the **corrected query finds at least 1 result** with the same
   filters.

If any one fails but a correction exists (2 edits, a 4-letter word, or the
typed query already finds something), only the button is shown and nothing
is searched by itself. 3-letter words and acronyms are never corrected (§4).

| Typed (13 live studies) | (a) 0 as typed | (b) 5+ letters, 1 edit | (c) fix finds | Result |
|---|---|---|---|---|
| `irigation` | ✔ | ✔ | 3 | auto-corrected |
| `machne lerning` | ✔ | ✔ both words | 9 | auto-corrected |
| `Isabella` | ✔ | ✔ | 5 | auto-corrected |
| `moistrue` | ✔ | ✘ 2 edits | 3 | button |
| `yeld` | ✔ | ✘ 4 letters | 5 | button |
| `rice irigation` | ✘ 3 found | ✔ | 3 | button |
| `irigation`, year 2018 only | ✔ | ✔ | ✘ 0 | button |
| `GIS` | — | — | — | nothing (never corrected) |

### What the user sees

- **The box keeps exactly what was typed.** Only the search uses the
  corrected query.
- Everything after the search uses the query **actually searched**: the
  "N results for …" line, the highlights, the snippets, the relevance %, and
  the ticked studies sent to the Combined summary.
- The note is text, not a button. Only *"typed words"* is a link: it
  searches the typed words **exactly as typed**, with no correction and no
  note, for that query only. Typing anything (or the clear ✕) resets it.
- Picking a correction never leads to a second one: the corrected query's
  words are all e-library words.

### Why (industry practice)

- **Zero-result fallback.** Web search engines correct by themselves mostly
  when the typed words find little or nothing, and always say so with a way
  back — Google's "Showing results for … / Search instead for …". Condition
  (a) and the link copy that.
- **Stricter rules for short words.** Search engines allow fewer typos in
  short words: Elasticsearch's `fuzziness: AUTO` allows 0 edits for 1–2
  letters, 1 for 3–5 and 2 for longer words, and Algolia only tolerates
  typos above a minimum word size (by default 4 letters for 1 typo, 8 for 2).
  Here the button needs 4+ letters, and correcting by itself needs 5+
  letters **and** only 1 edit — stricter than either, because changing the
  query without a click must be very safe.
- **Never a dead end.** Condition (c): switching to a correction that also
  finds nothing would only hide what was typed.

### Limits of the self-correction

- **A 1-edit fix can still be a different real word.** *corn* and *core*
  are both real words, 1 edit apart: if studies use *corn* and none uses
  *core*, a search for *core* is "fixed" to *corn*. At 4 letters that is only
  the button, but 5+ letter pairs exist too: with no study about *field*
  work, `field` (0 results) would be searched as *yield*. That is why the
  note and the *Search instead* link are **always** shown — the user sees
  what was searched and can undo it in one tap.
- **2-edit typos and short-word typos only get the button** (`moistrue`,
  `crop yeild`, `yeld`): swapped letters cost 2 (no Damerau, §8), so they are
  never searched by themselves.
- **Acronyms are never changed** — but only because they are 3 letters. A
  4-letter acronym that no study uses (`NDVI`) can still get the button
  (never the self-correction: it needs 5+ letters).
- It counts results with the current filters, but whether a word "matches
  anything" is still asked of the whole e-library (§8).

---

## 8. Limits (say these at the defense)

- **Swapped letters cost 2.** This is plain Levenshtein, not
  Damerau-Levenshtein: `moistrue` → `moisture` and `yeild` → `yield` are 2
  edits, not 1. They are still found because words of 5+ letters allow 2
  edits — but only as the button, never by themselves (§7) — and a swap in
  a 4-letter word (`raod`) is not corrected.
- **Suggestions come only from words already in the e-library.** It is not a
  dictionary. A correctly spelled word that no study uses gets no suggestion
  (or, at worst, the closest word that is there), and a misspelling that is
  itself stored in a study is accepted as a word.
- **The first-letter tie-break is a choice, not a rule of the method.**
  `Acosat` → *acosta* only because of it; without it, *cost* (more studies)
  would win. A typo in the first letter (`rrigation`) still works when no
  other word is as close, but loses ties.
- **The study counts are inflated by the copied test studies.** The
  e-library holds the same 3 PDFs registered 2–6 times, so *machine* shows
  "8 studies" and *irrigation* "3 studies" when there are really 1–2
  different studies. Counts become meaningful once the test copies are
  deleted (planned before the demo).
- **Autocomplete ranks by study count inside two groups** (§3): a word
  used in 8 studies beats one used in 1, but any title/keyword/author/adviser
  word beats an abstract-only word, even one in more studies. Because the
  counts are inflated by the copies (above), the order on the demo data is
  partly an accident of which PDFs were copied most.
- **Accents.** Autocomplete ignores accents when finding (`nin` → *niño*), but
  search does not, so "Did you mean" treats *nino* and *niño* as different
  words (1 edit).
- **The whole e-library decides whether a word is "found"**, not the
  department/year filter: a word only in another department is "found", so
  no correction is offered even if the filter hides every result. (The
  self-correction's result counts in §7 do use the filters.)
- **Common-word list is English only** (`STOP_WORDS`); Filipino words such as
  *ang*, *mga* are treated as normal words.
- **No learning from what people search.** Ranking is by field and study
  count only.
