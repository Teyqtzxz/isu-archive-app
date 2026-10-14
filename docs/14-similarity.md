# 14 — Document Similarity (TF-IDF + cosine)

**Status:** ☑ DONE — branch `feat/similarity` (errata #64).
**Code:** `src/similarity.ts` (pure, no React, no Firebase) · examples in
`src/similarity.check.ts` (`node src/similarity.check.ts`).

The professor asked for "a distinct feature connected to computer science".
This one is from **information retrieval**: every study is turned into a
vector of numbers, and two studies are compared by the **angle between their
vectors**. It powers two things:

1. **Originality check** — on the Register / Edit study save step, the study
   about to be saved is compared with every stored study. A possible duplicate
   must be confirmed before saving.
2. **Similar studies** — in Study Details (staff and students), the 3 most
   similar other studies, each clickable.

Both show the **shared key terms**: the words that make the two studies alike.
Search ranking (`search.ts`, BM25F) is not changed by any of this.

---

## 1. From a study to a vector

### 1a. Words

The title, keywords and abstract go through `tokenize()` from `search.ts` — the
same as search, so case, punctuation and accents are handled identically
("Soil-Moisture" = "soil moisture"). Then `similarityTerms()`:

- **Plurals folded:** `sensors → sensor`, `studies → study`, `switches →
  switch`. Words ending in *-ss, -us, -is* are kept (`process`, `campus`,
  `analysis`).
- **Dropped:** one-letter words, plain numbers (`2024`), and about 100 very
  common words — *the, of, and, is, we, this, study, research*, and pronouns
  and determiners (*my, our, your, their, its, his, her, us, they, them*).

Why drop common words when idf (below) already gives them almost no weight?
Tested on the real e-library: the percentages change by about 1%, but without
the list the "shared key terms" were *is, an, we, and, my* — true, and useless.

### 1b. Weighted count (term frequency)

Like search's BM25F, a word in the title says more about the topic than one in
a long abstract:

```
count(t) = 3 × (times in title) + 2 × (times in keywords) + 1 × (times in abstract)
```

### 1c. TF-IDF weight

```
idf(t) = ln( (1 + N) / (1 + df(t)) )        N = number of stored studies
                                             df(t) = studies containing t
w(t)   = (1 + ln count(t)) × idf(t)
```

- **idf** ("inverse document frequency") is high for a rare word and 0 for a
  word in **every** study: such a word cannot tell studies apart.
- **1 + ln count** dampens repetition: a word used 20 times is not 20 times
  more important than a word used once.
- Words with weight 0 are left out of the vector.

### 1d. Cosine similarity

```
            Σ  wA(t) × wB(t)          (over the words both studies have)
cos(A,B) = ───────────────────
              ‖A‖ × ‖B‖               ‖A‖ = √( Σ wA(t)² )
```

The result is between 0 (no word in common) and 1 (same direction: the same
words in the same proportions), shown as **0–100%**. An empty vector (no
countable words) gives 0, never a division by zero.

### 1e. Shared key terms

The words with the largest `wA(t) × wB(t)` — the terms that add the most to
the score — at most 5, biggest first.

### 1f. When it is computed

- The idf table and every stored study's vector are built **once per data
  change** (`useMemo` on the studies list), never per keystroke.
- The draft on the Register form is two extra vectors (overall and
  abstract-only, §4) measured against those
  idfs, computed only on the save step: 2 vectors + 2N dot products, well under
  a millisecond.
- Study Details computes the similar studies of the one study that is open.

---

## 2. Worked example (`src/similarity.ts`, rounded)

Three stored studies, N = 3:

| | Title | Keywords | Abstract |
|---|---|---|---|
| A | Soil Moisture Sensors for Rice Irrigation | irrigation | A low-cost sensor tells farmers when the rice paddies need water. |
| B | Rice Yield Prediction | machine learning | Weather records predict the rice harvest. |
| C | Library Book Reservation App | mobile app | Students reserve books from their phones. |

New study D: *Solar Pumps for Rice Irrigation* · keywords *irrigation* ·
"A soil sensor switches the pump on when the paddies need water."

**Counts for D:** `irrigation` = 3 (title) + 2 (keyword) = 5; `pump` = 3 + 1 =
4; `solar` 3; `rice` 3; `soil`, `sensor`, `switch`, `paddy`, `need`, `water` 1.

**idf** (N = 3): `rice` is in A and B → ln(4/3) = 0.29; `irrigation`, `soil`,
`sensor`, `paddy`, `need`, `water` are in A only → ln(4/2) = 0.69; `pump`,
`solar` are in no stored study → ln(4/1) = 1.39.

**Weights for D:** `irrigation` (1 + ln 5) × 0.69 = 1.81; `pump` 3.31; `solar`
2.91; `switch` 1.39; `rice` 0.60; the rest 0.69. ‖D‖ = 5.23. A's vector the
same way: ‖A‖ = 3.75.

**Dot product D·A** over the shared words:

| Word | wD | wA | wD × wA |
|---|---|---|---|
| irrigation | 1.81 | 1.81 | 3.28 |
| sensor | 0.69 | 1.65 | 1.14 |
| soil | 0.69 | 1.45 | 1.00 |
| paddy, need, water | 0.69 | 0.69 | 0.48 each |
| rice | 0.60 | 0.69 | 0.41 |
| **Sum** | | | **7.26** |

cos(D, A) = 7.26 / (5.23 × 3.75) = **0.37 → 37%** → "Related studies",
shared key terms *irrigation, sensor, soil, need, paddy*.
cos(D, B) = 3% (only *rice*), cos(D, C) = 0%.

---

## 3. Why TF-IDF + cosine

- **Explainable.** Every percent can be worked out by hand (§2), and the shared
  key terms show *why* two studies match — staff can check the reason, not
  just trust a number.
- **Length-fair.** Cosine compares direction, not size: a 300-word abstract and
  its 150-word shortened copy still score high, where a raw count of shared
  words would favour long abstracts.
- **Common words handled.** idf makes words that every study uses ("system",
  "students" in a CS-heavy library) count little, and rare topic words count a
  lot.
- **Fits the architecture.** Pure arithmetic in the browser over the studies
  already loaded: no server, no paid API, no AI model, nothing stored in
  Firestore (`00` hard constraint). It reuses `tokenize()` from search.
- **Fast.** O(total words) to build once; one comparison is a loop over the
  draft's words.

Alternatives considered: a raw word-overlap count (Jaccard) ignores how rare a
word is; an AI embedding model would catch paraphrases but needs a server or a
paid API, which the project rules forbid.

---

## 4. Thresholds (decided on the real e-library, 2026-10-14)

The originality check (Register / Edit save step) scores every stored study
**twice**, with the same TF-IDF + cosine method:

- **overall** — title ×3, keywords ×2, abstract ×1 (§1);
- **abstract only** — the abstracts alone, with idf counted over the
  abstracts only.

The **higher** of the two decides the level and is the % shown, with its
reason: **"Abstract 100% similar"** when the abstract-only score is higher,
otherwise **"91% similar overall"** (an exact copy is 100% both ways and reads
"overall"); the shared key terms are those of the score shown. Why: the title
and keyword weights dilute a copied abstract. In review, the exact abstract of
"thesis sample 2" under a new title with no keywords scored only 76% / 72% /
69% overall — "Very similar", no checkbox — while its abstract-only score is
100%. "Similar studies" in Study Details keeps the overall score.

| Score (higher of overall and abstract-only) | Where | Shows |
|---|---|---|
| **≥ 80%** | Register / Edit save step | **"Possible duplicate — this study may already be registered"** (red). The save button stays disabled until **"I checked — register anyway"** is ticked |
| **50–79%** | Register / Edit save step | **"Very similar study found"** (yellow warning) |
| **30–49%** | Register / Edit save step | **"Related studies"** (green information) |
| **≥ 15%** overall | Study Details | **"Similar studies"**, top 3; none → no section |

At most **3** matches are shown in either place. Measured on the 13 studies in
the app (mostly test uploads of the same 3 PDFs):

| Case | Overall | Abstract only | Check shows |
|---|---|---|---|
| Copies of the same PDF registered twice | 86–100% | 100% | Possible duplicate |
| Exact copy of a study | 100% | 100% | Possible duplicate, "100% similar overall" |
| Same abstract, new title, no keywords | 69–89% | 100% | Possible duplicate, "Abstract 100% similar" |
| First half of the abstract, new title | 64% | 72% | Very similar, "Abstract 72% similar" |
| Same title and keywords, different abstract | 57% | 4% | Very similar, "57% similar overall" — never a duplicate by the abstract rule |
| Different studies | 10% or less | under 30% | nothing |

Each warning lists the match (title, year, % with its reason), its shared key terms, **Show
details** (authors, adviser, department, keywords, abstract, inside the
warning — the form is never left, so nothing typed is lost) and **Open in
Drive** (new tab). In **Edit study** the study is never compared with itself.
If the possible duplicates change after ticking (the abstract is edited), the
box must be ticked again.

---

## 5. Limits

- **Paraphrasing is not caught.** TF-IDF compares *words*, not *meaning*. A
  study that says the same thing in different words ("water-saving watering
  plan" for "irrigation scheduling") or one translated into Filipino scores
  low. Only an AI language model could catch that, and it is outside the
  project's no-server, no-paid-service rules.
- **It is a screening aid for staff, not a plagiarism verdict.** A high score
  means "look at these two studies"; a low score does not prove a study is
  original. Staff decide — that is why a duplicate can still be registered
  after "I checked".
- **Only the stored title, keywords and abstract are compared** — not the full
  PDF text. Two studies with different abstracts but copied chapters are not
  detected.
- **Small libraries move the numbers.** idf depends on what is stored; with
  few studies a word shared by two of them looks rarer than it will later.
  The thresholds should be re-checked once the e-library holds real studies.
- **Simple word rules.** Plural folding is basic English (no full stemmer):
  "irrigate" and "irrigation" stay different words.
