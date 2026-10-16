# 15 — Keyword Model (Naive Bayes + TF-IDF phrases)

**Status:** ☑ DONE — branch `feat/keyword-model` (errata #65).
**Code:** `src/keywordModel.ts` (pure, no React, no Firebase) · examples in
`src/keywordModel.check.ts` (`node src/keywordModel.check.ts`) · UI in
`RegisterForm.tsx` ("Suggested keywords") and `KeywordModelCard.tsx` (staff
Statistics tab).

The professor asked us to "build a model in your system". This is a
**keyword predictor**: a machine-learning model that the app trains itself, in
the browser, from the studies already stored. On the Register / Edit study save
step it suggests keywords for the study being saved; staff click the ones they
want. The staff Statistics tab shows what the model learned and how accurate it
is.

Nothing new is stored, nothing is sent anywhere, and no AI service or new
library is used: the model is plain arithmetic in one file written for this
project. Search ranking, similarity scores, the summary, citations, the
validation rules, `data.ts`, the types and `firestore.rules` are unchanged.

---

## 1. What a "model" is here

A **model** is a set of numbers learned from examples that turns a new input
into a prediction.

- **Examples (training data):** every stored study that has keywords. The
  **features** are the words of its title and abstract; the **labels** are its
  keywords.
- **Learning (training):** counting — how often each word appears in studies
  with a given keyword and in studies without it. These counts *are* the
  model.
- **Prediction:** for a new study, the counts give a probability for every
  keyword the model knows.
- **Evaluation:** the model is tested on studies it did not learn from, and
  compared with a simple baseline (§5).

Words are processed exactly as in similarity (`similarity.ts`, `docs/14` §1a):
`tokenize()` from search, plurals folded (`sensors → sensor`), one-letter
words, plain numbers and ~100 common words dropped.

**Labels are normalised** the same way, so "Rice", "rice " and "rices" are one
keyword (`keywordKey()`: `rice`), and "Low-cost Sensors" and "low-cost
sensors" are one (`low cost sensor`). The chip shows the spelling used most
often. Studies with no keywords are not training examples: having no keywords
means "not labelled", not "none of these keywords apply".

The model is trained **once per data change** (`useMemo` on the studies list),
never per keystroke. In **Edit study** the study being edited is left out of
training by its id, so it can never "predict" its own keywords.

---

## 2. The learned part — multinomial Naive Bayes

For every known keyword *k* the model asks one yes/no question: *does this
study have keyword k?* (**one-vs-rest**: one small classifier per keyword).

```
P(w | k)   = (count of w in studies with k    + 1) / (words in studies with k    + |V|)
P(w | ¬k)  = (count of w in studies without k + 1) / (words in studies without k + |V|)

z          = ln( (n_k + 1) / (N − n_k + 1) )                prior: n_k of the N training
           + Σ over the study's words [ ln P(w|k) − ln P(w|¬k) ]   studies have k
P(k | study) = 1 / (1 + e^−z)
```

- **|V|** is the vocabulary: every word in the training studies. Words of the
  new study that are not in it are skipped — they say nothing either way.
- **+1 (Laplace smoothing):** a word never seen with *k* gets a small
  probability instead of 0. Without it a single unseen word would make
  P = 0 and wipe out all other evidence.
- **"Naive":** words are treated as independent, so the probability of a whole
  abstract is the product of the word probabilities. That is not true of real
  text, but it works well for ranking topics (McCallum & Nigam, 1998).
- **Logs:** multiplying hundreds of small probabilities rounds to 0 in a
  computer, so the model adds logarithms instead.
- **Evidence words:** the different words of the study that were seen in *k*'s
  studies and are more likely with *k* than without (`ln P(w|k) > ln P(w|¬k)`).

### Worked example by hand

Three training studies (title left empty):

| Study | Words | Keyword |
|---|---|---|
| A | tilapia pond fish | aquaculture |
| B | fish pond feed | aquaculture |
| C | concrete beam load | bridge |

New study D: *"tilapia pond"*.

**Vocabulary** |V| = 7 (tilapia, pond, fish, feed, concrete, beam, load).
For *aquaculture*: studies with it (A, B) hold 6 words; without it (C), 3.

| | with *aquaculture* | without |
|---|---|---|
| P(tilapia) | (1 + 1) / (6 + 7) = 0.154 | (0 + 1) / (3 + 7) = 0.100 |
| P(pond) | (2 + 1) / (6 + 7) = 0.231 | (0 + 1) / (3 + 7) = 0.100 |

```
prior = ln((2 + 1) / (1 + 1))        = ln 1.5   =  0.405
z     = 0.405 + ln(0.154 / 0.100) + ln(0.231 / 0.100)
      = 0.405 + 0.431 + 0.836        = 1.672
P(aquaculture | D) = 1 / (1 + e^−1.672) = 0.842 → 84%
```

For *bridge* the numbers mirror: z = −1.672, P = 16%. D has **2** evidence
words for *aquaculture* (tilapia, pond). `node` on `keywordModel.ts` gives the
same 0.842 and 0.158. With the cut-off below (§4) it would **not** be suggested:
84% is under 90%, and 2 evidence words are under 5.

---

## 3. The extraction part — TF-IDF two-word phrases

The learned part can only suggest keywords that earlier studies already use. A
new topic, or an empty library, would get nothing. So the model also takes
the best **two-word phrases** of the new abstract:

```
w(word)        = (1 + ln tf) × (1 + ln((1 + N) / (1 + df)))   tf: times in this abstract
                                                                df: training studies with the word
score(phrase)  = (1 + ln tf(phrase)) × (w(first word) + w(second word))
```

- A phrase is two **neighbouring** words with only spaces between them, so a
  phrase never crosses a full stop, comma, bracket or dash ("soil moisture.
  Rice yield" never gives "moisture rice"). The two words must differ once
  folded: "rice rice" or "Niño niños" is not a phrase.
- Both words must count (no common word, no number, at least 3 letters), and
  generic report words ("achieved", "revealed", "conference", "elsevier"…, the
  list `PHRASE_STOP_WORDS`) are not used. A hyphenated word is one word and is
  kept: "low-cost sensors".
- The phrase is shown **as written in the abstract** (most used spelling), not
  in its folded form: "low-cost sensors", not "low cost sensor".
- The idf has **+1** so the scores stay above 0 when the library is empty
  (then repetition alone decides).

Example with an empty library (idf factor = 1): *"Drip irrigation saves water.
Farm owners like drip irrigation."* — `drip` and `irrigation` appear twice:
w = 1 + ln 2 = 1.69 each; "Drip irrigation" appears twice →
(1 + ln 2) × (1.69 + 1.69) = **5.73**, first; "irrigation saves" 2.69,
"saves water" 2.00.

### The suggestions

At most **6** chips, learned ones first (highest probability first), then
phrases. Never a keyword the study already has (compared by the normalised
key, so "Rices" counts as "rice"), never the same keyword twice, never one the
Keywords box would refuse (`validation.ts`: 2–60 characters, a letter, no
comma). Each chip says **"learned from N studies"** or **"from this
abstract"**. Clicking a chip adds it through the same `addKeywords()` as
typing it (repeats ignored, at most 10 keywords); **nothing is ever added
automatically**.

---

## 4. The confidence cut-off

A learned keyword is suggested only when **P ≥ 0.9 and at least 5 evidence
words** (`KEYWORD_MODEL` in `keywordModel.ts`).

Why not the probability alone: on long texts Naive Bayes pushes probabilities
to 0 or 1, because every one of a few hundred words multiplies in. It **ranks**
keywords well but its probabilities are over-confident. On the real e-library
the e-learning study *my.Eskwela* got **"soil moisture" at P = 0.97** — from only
**2** evidence words: with the agriculture studies as the only alternatives, it
was simply "less unlike" them. The evidence rule removes that: a keyword needs
several words of the study that really occur with it. Averaging per word was
tried and rejected (an unrelated study scored 0.63, a related one 0.58).

**These thresholds were chosen on the same 13 studies they are reported on.**
The library is too small to keep a separate set of studies for tuning, so the
cut-off is a reasoned starting point, not a measured optimum. Re-check it
once the e-library holds real studies.

### What it does on the real e-library (2026-10-16, 13 studies)

Each study as Edit would see it — trained on every other study, its own
keywords hidden:

| Study | Its real keywords | Suggestions |
|---|---|---|
| thesis sample 2 | soil moisture, rice farming, low-cost sensors, irrigation, Isabela | the same 5, *learned from 2 studies* (its copies) · water costs |
| Thesis | machine learning, crop yield prediction, palay, Isabela Province, gradient boosting, precision agriculture | all 6, *learned from 1 study* (its copy "Thesis2") |
| my.Eskwela | trust, confidence in new technology, system socialness, media equation theory, HCI | phrases only (guard): Computer Science, Information Systems, online social, social environment, social capital, social widgets |
| Vit (MOOC study, no keywords) | — | trust, confidence in new technology, system socialness, media equation theory, HCI *(learned from 1 study, 13 evidence words)* · crop yield prediction |

The last row shows the main weakness: Vit and my.Eskwela are both e-learning
studies, so my.Eskwela's whole keyword set carries over — "HCI" fits, "media
equation theory" does not. Keywords that always appear together on the same
studies cannot be told apart by any model; that improves only with more varied
studies.

---

## 5. Evaluation — leave-one-out cross-validation vs a baseline

A model must be tested on studies it **did not learn from**. With few studies
the fairest test is **leave-one-out**:

1. Take one study with keywords and hide its keywords.
2. Train a **new model from scratch** on the other studies only — keywords,
   vocabulary, word counts and the phrase df. Nothing of the hidden study is
   learned (`leaveOneOutFolds()`; `keywordModel.check.ts` checks that no fold
   has the tested study's words in its vocabulary).
3. Let it suggest up to 6 keywords and compare them with the real ones.
4. Repeat for every study with keywords.

**Near-copies are hidden too.** The e-library holds the same PDFs registered
several times. If a copy stays in training, the model only has to remember it.
So each test also leaves out every study the originality check calls a
"Possible duplicate" (≥ 80%, `docs/14` §4) of the tested one.

**Baseline:** always suggest the 6 keywords used by the most training studies.
A model is only worth having if it beats this.

**Measures** (for the model and the baseline):

- **At least one correct:** share of tested studies where at least one
  suggestion is a real keyword.
- **Precision:** correct suggestions ÷ suggestions shown.
- **Recall:** share of each study's real keywords that were suggested,
  averaged over the tested studies.

### Results on the real e-library (13 studies, 6 with keywords; run with the shipped code)

| Test | Model: ≥ 1 correct | precision | recall | Baseline: ≥ 1 correct | precision | recall |
|---|---|---|---|---|---|---|
| Plain leave-one-out (copies kept) | 5/6 = **83%** | 27/36 = 75% | 83% | 3/6 = 50% | 9/36 = 25% | 30% |
| **Near-copies hidden** (5 copies hidden) | **0%** | 0% | 0% | 0% | 0% | 0% |

- **The 83% is not real accuracy.** The 6 tested studies are copies of only 3
  abstracts; with a copy in training the model recognises the copy. That is why
  the staff card shows only the near-copies-hidden numbers.
- **0% is the honest state of the library, not a bug:** with copies hidden, no
  keyword is used by two different studies, so there is nothing to learn yet —
  and the baseline scores 0% as well.
- On made-up libraries with very few known keywords the baseline can win:
  6 suggestions out of ~8 known keywords is almost "suggest everything".
  `keywordModel.check.ts` therefore checks the arithmetic of the baseline, not
  that the model beats it.

**Speed:** leave-one-out trains one model per tested study. Measured in node on
300 synthetic studies (200-word abstracts, 5 keywords each): **2.2 s** for the
whole test, 25 ms to train once, 9 ms for one set of suggestions. The staff
card runs the test after the Statistics tab has drawn ("Testing the model…"),
once per data change.

### The staff card (Statistics tab)

"Keyword model": training studies (with keywords), known keywords; the
leave-one-out test with near-copies hidden — "*N* studies tested, *M* copies
hidden" — model next to baseline for the three measures; and, below 30
studies with keywords, **"Fewer than 30 studies with keywords — not reliable
yet."** Students do not see it.

---

## 6. Limits

- **It can only learn keywords already used on earlier studies.** A brand-new
  topic gets phrases from its abstract, never a learned keyword.
- **Accuracy will mean something only after about 30 varied studies with
  keywords** — several different studies sharing each keyword. Today each
  keyword set belongs to one PDF registered several times.
- **The thresholds were tuned on the same 13 studies they are reported on**
  (§4); there are too few to keep a separate tuning set.
- **Keywords that always appear together are learned together** (§4, the Vit
  row): the model cannot tell them apart until some study has one without the
  other.
- **Naive Bayes probabilities are over-confident** on long texts; that is why
  the evidence rule exists, and why the chips show "learned from N studies"
  instead of a percentage.
- **Phrases are two words only and purely statistical:** "low-cost soil" (from
  "low-cost soil moisture") or "Small rice" can appear; staff simply do not
  click them. No grammar, no meaning — like similarity, it compares words, not
  ideas (`docs/14` §5).
- **Junk in the abstract becomes junk phrases:** a PDF's publisher lines
  ("Procedia Computer Science") can be suggested; the common ones are in
  `PHRASE_STOP_WORDS`.

---

## Reference

McCallum, A., & Nigam, K. (1998). A comparison of event models for naive Bayes
text classification. In *AAAI-98 Workshop on Learning for Text Categorization*
(pp. 41–48). AAAI Press.
