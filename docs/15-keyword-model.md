# 15 — Keyword Model (Naive Bayes + TF-IDF phrases)

**Status:** ☑ DONE — branch `feat/keyword-model` (errata #65); automatic
keywords, the reliability fix and the junk-phrase filter on `feat/auto-keywords`
(errata #77); automatic keywords fill their room on `feat/auto-keywords-fill`
(errata #79); keywords automatic only, staff only remove (with Undo), also from
a typed abstract, on `feat/keywords-auto-only` (errata #80).
**Code:** `src/keywordModel.ts` (pure, no React, no Firebase) · examples in
`src/keywordModel.check.ts` (`node src/keywordModel.check.ts`) · UI in
`RegisterForm.tsx` (automatic keywords, × and Undo) and
`KeywordModelCard.tsx` (staff Statistics tab).

The professor asked us to "build a model in your system". This is a
**keyword predictor**: a machine-learning model that the app trains itself, in
the browser, from the studies already stored. When a **new** study's PDF has
been read (or, with no abstract read, when staff type one), the save step
**adds the best keywords automatically**, marked "auto"; staff review them and
remove any that do not fit (§6). Staff **never add a keyword by hand**
(errata #80): there is no typing box and no click-to-add box, on Register or
on Edit study, only × and a short Undo. The staff Statistics tab shows what
the model learned and how accurate it is.

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
- **Learning (training):** counting — in how many studies with a given
  keyword each word appears, and in how many without it. A word counts
  **once per study**, however often it is written, and **near-copies count
  as one study** (§2). These counts *are* the model.
- **Prediction:** for a new study, the counts give a probability for every
  keyword the model knows.
- **Evaluation:** the model is tested on studies it did not learn from, and
  compared with a simple baseline (§5).

Words are processed exactly as in similarity (`similarity.ts`, `docs/14` §1a):
`tokenize()` from search, plurals folded (`sensors → sensor`), one-letter
words, plain numbers and ~100 common words dropped.

**Labels are normalised** the same way, so "Rice", "rice " and "rices" are one
keyword (`keywordKey()`: `rice`), and "Low-cost Sensors" and "low-cost
sensors" are one (`low cost sensor`). A learned keyword is added with the
spelling used most often. Studies with no keywords are not training examples: having no keywords
means "not labelled", not "none of these keywords apply".

The model is trained **once per data change** (`useMemo` on the studies list),
never per keystroke. In **Edit study** the study being edited is left out of
training by its id, so it can never "predict" its own keywords.

---

## 2. The learned part — Naive Bayes, each word once per study

For every known keyword *k* the model asks one yes/no question: *does this
study have keyword k?* (**one-vs-rest**: one small classifier per keyword).

```
P(w | k)   = (studies with k having w    + 1) / (words of studies with k    + |V|)
P(w | ¬k)  = (studies without k having w + 1) / (words of studies without k + |V|)

z          = ln( (n_k + 1) / (N − n_k + 1) )                prior: n_k of the N training
           + Σ over the study's different words              studies have k
               [ ln P(w|k) − ln P(w|¬k) ]
P(k | study) = 1 / (1 + e^−z)
```

"Words of studies with k" counts each study's different words once. Two
reliability rules (errata #77):

- **Each word once per study**, in training and in the study being scored.
  Before, a word written 10 times counted 10 times: one abstract saying
  "model" ten times added about +20 to *z* by itself and pushed unrelated
  keywords to 100%.
- **Near-copies count as one study.** Studies that the originality check
  calls a "Possible duplicate" of each other (≥ 80%, `docs/14` §4) are joined
  into one training study: their words and keywords together, each once.
  The same PDF registered three times no longer counts three times. The
  search for near-copies is `possibleDuplicates` (`docs/14` §1f), the same
  one the leave-one-out test uses. A study left out (the one being edited)
  never joins two others.

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

**With a repeated word.** Now let D be *"tilapia pond pond pond"*. Counted
three times (the code before errata #77), "pond" added its 0.836 three times:
z = 0.405 + 0.431 + 3 × 0.836 = 3.344, P = **0.966**. Counted once, D is
still *tilapia, pond*: P = **0.842**, as above. In the same way, if study A
read "tilapia pond pond pond fish", the old code gave D 0.870 and the new one
gives 0.842. All four numbers come from running the old and the new code.

---

## 3. The extraction part — TF-IDF phrases

The learned part can only suggest keywords that earlier studies already use. A
new topic, or an empty library, would get nothing. So the model also takes
the best **two-word phrases** of the new abstract (three words when a term
always comes as three, below):

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
"saves water" 2.00. Since errata #77 "irrigation saves", the middle of the
once-seen run "Drip irrigation saves water", is dropped and "saves water"
stays (below): a verb ending in -s cannot be told from a plural noun, so it
is not filtered (§7).

### Junk-phrase filter (errata #77)

On 9 real theses the phrases included "schedule during", "knowledge along",
"process involves", "project implements", "handle projects", "Nurses
should", "participants reported", "proponent excluded", "providing
quality", "documents internally", "specific plastic" and "case suite". The
rules below decide which written words may be half of a keyword phrase. They
are for keyword phrases only: `STOP_WORDS` in `similarity.ts`, and so search
and the originality check, are unchanged.

| Rule | Example removed | Still a phrase |
|---|---|---|
| **Grammar words** that similarity keeps (modal verbs, prepositions, linking words: should, must, during, along, via, including…) are never in a phrase | "Nurses should", "schedule during", "knowledge along" | "Filipino nurses" |
| **Verbs of report writing, base and -s form** (`VERBS`: provide, involve, implement, handle, monitor, reduce…; nouns such as process, project, control, change, report, design are left out on purpose) are never in a phrase | "handle projects", "process involves", "project implements" | "process improvement", "applied mathematics" |
| **Their -ing form** (providing, monitoring, managing…) may be part of a phrase, but **not right after a preposition** (in, for, of, with…) **or a plural noun**: there it is a verb | "in providing quality care" gives no "providing quality"; "in mitigating plastic pollution", "nurses providing care", "for monitoring water quality" | "monitoring system", "the water quality monitoring system", "real-time monitoring" |
| **Adverbs** ending in -ly after -al, -ful, -ous, -ive, -ent, -ant, -ic, -ate, -ing, -less, -ish, -ed, -ular/-ilar, -ably/-ibly, -arily, plus a short list (only, highly, mainly…) | "documents internally" | "family planning", "supply chain", "elderly patients", "early detection", "monthly income" |
| **Vague words** (specific, various, different, several, certain, existing, relevant, many, few, such, same, own…) cannot start a phrase, and since errata #79 cannot end one either | "specific plastic", "various documents", "producing various" | "plastic types" |
| **A past form never ends a phrase** (-ed, or an irregular one: held, made, born, rose, taught…) | "participants reported", "proponent excluded", "nurses held", "pupils taught" | "perceived stress" |
| **An -ed word cannot start a phrase right after a noun**: there it is the verb of the sentence. "Noun" here is a phrase word, or "study" / "research", which similarity drops. After another -ed word, "the", "of", "and", a comma or the start of a sentence it still can | "Drip irrigation saved water" gives no "saved water"; "This study assessed students" gives no "assessed students" | "Reduced tillage", "automated attendance system", "improved varieties", "practiced reduced tillage" → "reduced tillage" |
| **Roman page numbers** (up to xcix, 3+ letters) are no word | "xiii Nurse-Patient" | "Nurse-Patient interaction" |
| **Fixed terms** (`FIXED_TERMS`: "use case", "test case"): their second word never starts a phrase right after the first | "the use case suite and the test case suite" gives no "case suite" | "test case" |
| **A hyphenated word** is one word and needs only one counted part | — | "game-based learning", "web-based enrollment system", "low-cost sensors" |

**Why round 2 narrowed the verb rule** (review of errata #77). Banning every
form of `VERBS` also removed real terms: "monitoring system", "real-time
monitoring", "automated attendance system", "reduced tillage", "improved
varieties". Only the base and -s forms are now banned everywhere; the -ed
and -ing forms follow the position rules above, which still keep all 12 junk
phrases out.

**Why "use case" and "test case" are listed.** In "the use case suite and
the test case suite", "use" is one of the common words similarity drops, so
the phrase reader sees "case suite" with nothing usable in front of it. A
rule about the word in front cannot see "use" (by design it only counts words
that can be half of a phrase, below). "test case suite" appears once, so
under the seen-once rule below only its right-hand pair "case suite" would
stay; "test case" is listed for that reason. Add another only when a real
abstract shows the same problem.

### Three-word terms (errata #77)

"perceived behavioral control" used to come as two halves, "perceived
behavioral" and "behavioral control". A word next to a phrase **counts only
when it makes a phrase with the phrase's nearer word by the rules above**:
"the", "of", "reduce" and other words that cannot be half of a phrase never
count. Then:

- **The middle of a longer term is dropped.** A phrase with the same word on
  both sides every time it appears: "quality monitoring" in "water quality
  monitoring system" (twice), "failure team" in "heart failure team NLI-HFTP"
  (twice).
- **Three words A B C are a term of their own** when, at least once, nothing
  stands in front of them and, at least once, nothing after them. Otherwise
  they are the middle of longer chains and their pairs stay as they are:
  "water quality monitoring system" gives **"water quality"** and
  **"monitoring system"**; "marine plastic pollution harms … coastal plastic
  pollution harms" keeps **"plastic pollution"**.
- **Such a term is offered only when it appears at least twice** (review
  round 2), instead of its pairs that only ever appear inside it:
  "perceived behavioral control" (twice in a real thesis), "climate change
  adaptation", "rice husk ash", "automated attendance system", "inventory
  management system". "climate change", which also appears alone, stays.
- **Seen once, only the stronger pair stays** (the higher TF-IDF score); on
  a tie the **right-hand** one, because an English term ends in its main
  noun: "The kit can measure water temperature." → "water temperature".
  Inside a longer once-seen chain the middle pair is dropped and the outer
  ones stay: "the system records student attendance in…" → "system records",
  "student attendance". So "measure water temperature", "system sends SMS",
  "helps fish farmers", "records student attendance" and "attendance records
  accurate" are never offered as terms. The pair that stays is not always a
  good one: "attendance records accurate" alone in a sentence gives "records
  accurate" (all three words equally rare; in the made-up RFID abstract,
  where "attendance" is frequent, it gives "attendance records"). And a
  once-seen term whose first word matters loses it on a tie: "Fall armyworm
  damage" → "armyworm damage", "lowland rice fields" → "rice fields",
  "Barcode scanning speeds up" → "scanning speeds" (§7).

A three-word term scores as its best part. One longer than a keyword may be
(60 characters) is not offered; only the stronger of its two parts is.

### The suggestions

`suggestKeywords()` ranks the candidates: learned ones first (highest
probability first, **at most 3**, so learned ones cannot crowd the abstract
out), then phrases. Learned ones only from **30** training studies (§4).
Never a keyword the study already has (compared by the normalised key, so
"Rices" counts as "rice"), never the same keyword twice, never one the
keyword rules would refuse (`validation.ts`: 2–60 characters, a letter, no
comma). `autoKeywords()` (§6) adds the best of this list by itself. Until
errata #80 the rest were shown as "Suggested keywords" chips to click
("learned from N studies" / "from this abstract"); now they are not shown,
because staff do not add keywords by hand.

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

**Learned keywords only from 30 studies with keywords** (`reliableFrom`,
errata #77). On the Register form no learned keyword is suggested or added
until the model has **30 training studies** (studies with keywords,
near-copies counted once). Proof it is needed: on 9 real theses (8 stored,
the 9th registered), the aviation study was offered "Marine Plastic
Pollution" and the nursing study "Climate change", learned from one study
each on another topic. 29 studies + an exact copy of one still count as 29.
The Statistics card is not held back by this rule (§5).

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

**Each fold's model is the real one** (errata #77): words once per study and
near-copies inside its training studies joined (the near-copies are found
once for the whole library and shared by every fold). Its suggestions are the
Register form's, **at most 3 learned of 6**, but **without the 30-study
rule**: the card measures the learned model, so below 30 it still shows how
the learned part would do. (Example: with 5 training studies the Register
form shows phrases only, while the card's Model column still counts the
learned ones.)

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

**How errata #77 changes the card's numbers.** "Training studies" counts
near-copy groups once, so it drops when the library holds copies; "known
keywords" usually stays. The leave-one-out folds are unchanged (each study
with keywords tested, its near-copies hidden), so "*N* studies tested, *M*
copies hidden" stay the same. The Model column changes through counting
words once, the junk filter, three-word terms and the 3-of-6 cap. On the 9
sample theses (5 with printed keywords): training 5 → 5, known keywords 18 →
18, 5 tested, 0 copies hidden; Model 20% → **40%** at least one correct,
precision 3% → 7%, recall 7% → 12%; baseline 0% both times. With every
sample stored twice: training 10 → **5** ("5 near-copies counted with their
originals"), 10 tested, 10 copies hidden, the same scores as above.

**Speed** (node, made-up libraries with 1 in 10 a near-copy, best of 3):

| | 300 studies | 1,000 studies |
|---|---|---|
| Register form, train once (before) | 41 ms | 111 ms |
| Register form, near-copies + train (after) | 66 ms | 237 ms |
| One set of suggestions / automatic keywords | 8 ms / 5 ms | 10 ms / 7 ms |
| The card's whole leave-one-out test (before → after) | 13.1 s → 11.4 s | 140 s → 107 s |

The near-copy search by comparing every pair took 1.9 s at 300 and 18.6 s at
1,000; `possibleDuplicates` takes 39 ms and 141 ms and gives the same lists
(`docs/14` §1f). The Register form builds the originality index anyway and
reuses it. The staff card runs the test after the Statistics tab has drawn
("Testing the model…"), once per data change.

### The staff card (Statistics tab)

"Keyword model": training studies (with keywords; with copies "*M*
near-copies counted with their originals"), known keywords; the
leave-one-out test with near-copies hidden — "*N* studies tested, *M* copies
hidden" — model next to baseline for the three measures; and, below 30
studies with keywords, **"Fewer than 30 studies with keywords — not reliable
yet."** Students do not see it.

---

## 6. Automatic keywords on the Register form (errata #77, #79, #80)

The professor asked for keywords chosen automatically, with staff reviewing
them and removing any. Since errata #80 that is the **only** way keywords get
into a new study: staff **cannot add one by hand** (no "Add a keyword" box, no
"+ Add", no "Suggested keywords" box); they only remove with ×, and can undo
that. `autoKeywords()` in `keywordModel.ts`; the form part is in
`RegisterForm.tsx`.

**When: a PDF read.** A **new** study, **once per PDF read**: when the save
step opens after a **successful** read whose abstract passes the abstract
check (`checkAbstract`: 50 words or more), and the e-library has loaded. If
the e-library fails to load, the abstract phrases alone are added (no learned
keyword can come from an empty model anyway). Going back with "Change PDF" (called "Edit details" before errata #82)
and continuing with the same PDF does not add again; reading another PDF
replaces the keywords with that PDF's own (as before) and adds once for it.
Never when a reloaded draft already had its add.

**When: a typed abstract (errata #80).** When the PDF could not be read, or
was read but gave no usable abstract (2022 CLARO-AZUCENA has none in its 136
pages; a PDF can also give only its keywords), staff type or paste the
abstract. **When they leave the abstract box** and it passes the abstract
check, the same automatic keywords are added, **once**, by the same rules as
for a PDF: the keywords the read did find stay first, room up to 5, never
past 8 in all, learned ones only from 30 studies, never a removed one. Under
50 words nothing is added; leaving the box again later with a longer abstract
adds them then. **Changing the abstract afterwards adds and removes nothing**
(running again would bring back or reshuffle keywords staff already checked).
The draft remembers it (`autoFor` = `"typed:"` + the failed read), so a
reload never adds twice. If the e-library has not loaded yet, nothing is
added on that leave; the next leave after it loads adds them.

**A pasted "Keywords:" line (errata #80).** If the typed or pasted abstract
has a line such as "Keywords: rice yield; drip irrigation, and Isabela farms."
(also "KEY WORDS —", the label alone with the list on the next line, or the
label right after the last sentence when the line break was lost), leaving the
box **moves that line out of the abstract** and lists its keywords as
**printed keywords**: no AUTO tag, before the automatic ones. The parsing is
the PDF reader's (`takeKeywordsLine` in `pdfText.ts`: wrapped lines joined,
split on , ; and "and", "self - efficacy" → "self-efficacy", at most 10). A
keyword staff removed is not added back from such a line. "Keywords are words
that…" (a sentence) and "these keywords: …" inside a sentence are left alone.
In **Edit study** the line is left in the abstract and nothing is added.

**Never in Edit study.** Edit study only removes: the saved keywords are
shown with ×, nothing is added by itself, not from a typed abstract either.
If staff choose the PDF again and **it prints keywords**, they replace the
list (they are the study's own); if it prints **none**, the saved keywords
stay.

**How many.** The PDF's own printed keywords stay first. Then the best
suggestions (the order of §3: learned first, at most **2**
learned), at most **5**, and never past **8** keywords in all, so 2 of the 10
places stay free (since errata #80 only a pasted Keywords line or a PDF
with more printed keywords can use them). Since errata #79 the room is **filled**; fewer are
added only when the study has no more suggestions:

| Printed keywords | 0 | 1–3 | 4 | 5 | 6 | 7 | 8–10 |
|---|---|---|---|---|---|---|---|
| Added automatically | 5 | 5 | 4 | 3 | 2 | 1 | 0 |

**Phrases seen twice first, then the room is filled** (errata #79; review
round 3 added only phrases seen twice). The professor asked that keywords
are included automatically and staff only remove or keep them, so the save
step now fills its room in two passes:

1. the learned ones (from 30 studies, §4; not counted) and the phrases that
   appear **at least twice in the title plus abstract** (`autoMinCount`),
   best first;
2. then, while there is room, the **other phrases in their usual order**
   (best TF-IDF score first, the order of §3).

`phraseCount()` counts with the same folding as `keywordKey()`: "fish
farmer" and "fish farmers" count together, a three-word term counts as
itself, nothing is counted across a full stop, comma, bracket or dash.
Example: in "Goat raisers sold goat milk. Goats, milk, goats, milk, … A solar
dryer was built; the solar dryer worked." the phrase "goat milk" scores
higher than "solar dryer" (goat and milk are frequent words), but "solar
dryer" is seen twice, so it is added first, then "goat milk", then "Goat
raisers"; with room for only 1, only "solar dryer". Why the repeated ones go
first: in review round 2 every junk automatic pick appeared once ("system
sends", "system records", "registrar approves", "system waters", "set
level", "posted daily", "percent rice", "lower compliance", "control
registration", "sustainable waste", "major corporations", "care quality"),
while the main terms repeat ("monitoring system" 3 times, "reduced tillage"
5, "heart failure" 12). Such once-seen picks can now come back, but only in
the places left after the repeated phrases; staff remove them (§7). Real
example, 2025 CALAMLAM (no printed keywords, test run with no title typed and
the other samples stored): before, only "DZLB Online" and "technical
elements" were added; now also "Radyo DZLB", "storytelling elements" and
"legacy format".

**No overlapping keywords** (review rounds 2 and 3). A suggestion that
contains a listed or already added keyword, is part of one, or has **the
same words in another order** (compared word by word on the normalised key)
is **not added**; the next one takes its place. The better one is the one
ranked first. Examples: "quality care" is added, "care quality" is not;
"nurse-patient interaction" is added, "patient interaction" is not;
"Control Management" is added, "Control Management System" is not;
with the printed "Marine Plastic Pollution" and "Plastic Waste Management",
"plastic pollution", "plastic waste" and "waste management" are not, and
with the printed "Climate change", "climate change adaptation" is not.

**What staff see.** Each added keyword has a small **AUTO** tag and a dashed
edge until the study is saved, and a note: "Keywords marked auto were chosen
automatically. Remove any that do not fit." Screen readers hear "…, added
automatically" and the × is "Remove keyword …, added automatically". The
suggestions not added are **not shown** (errata #80; until then a "Suggested
keywords" box offered them to click). With no keywords the line under
"Keywords" says why: "No keywords yet. They are added automatically from the
abstract when you leave the abstract box (50 words or more).", "Keywords are
added automatically once the e-library has loaded." or "No keywords were
found for this study. Keywords are optional." In Edit study: "Remove any
keyword that does not fit. Nothing is added here; a PDF chosen again that
prints keywords replaces them." Keywords stay **optional** for saving. Screen
readers also hear what leaving the abstract box added ("5 keywords were added
from the abstract: …").

**× and Undo (errata #80).** × removes a keyword (auto, printed or saved).
Under the list, **"Removed *keyword*. Undo"** appears for **8 seconds**; the
time waits while the mouse is on that line or Undo has keyboard focus, and
starts again in full when it leaves. **Undo** puts the keyword back **where it
was**, with its AUTO tag if it had one, and it may be added by itself again.
Only the latest removal can be undone (another × replaces the line). The line
is a polite live region (`role="status"`), so screen readers read it. After
a ×, keyboard focus goes to the × now in that place (or the one before), or to
Undo when the list is empty; after Undo, to the keyword put back. Undo is not
kept across a reload.

**Removed stays removed.** A keyword removed with its × (auto or not) is
remembered by its key and is **never added again by itself**: not when the
step opens again, not when the abstract changes, not for another PDF. It
can only come back with **Undo** (errata #80; before that, by clicking its
suggestion chip). **Printed keywords win:** if a newly read PDF prints a keyword that
staff removed earlier, it is listed, because the PDF's own keywords always
come first. Example: "drip irrigation" was added automatically and removed;
then a PDF whose keywords line says "Drip irrigation" is read → it is the
first keyword; it is never added *automatically* again.

**After a reload.** The unsaved draft (`draft.ts`) keeps the tags, the
removed keys and which PDF read (or typed abstract) already had its add, so a
reload adds nothing. A draft saved before #77 that had a read PDF counts as
done. A draft saved before #80 still loads: its keywords stay (they can be
removed); text typed in the old "Add a keyword" box but never added is
dropped, and a draft whose only change was that text counts as unchanged and
is cleared.

**Stray clicks.** The 1-second guard of errata #72 covers Save, × and Undo,
and starts again when leaving the abstract box adds keywords (the list grows
and Save moves down). A **Save** press inside that restarted second is not
taken, but **not silently**: "Keywords were added. Check them, then click
Save." appears under Save (a polite live region), at once when the abstract
box was left by pressing Save, and the **next** Save press (or the next Enter
/ Space) is taken. When the box was left by pressing Save, only that press is
turned down (a new press is taken, even if the first one missed Save as it
moved). Headless Chrome: leaving the box elsewhere and pressing Save inside
the second → not posted, the note shows, the next press posts once; pressing
Save straight from the box, by mouse or Tab + Enter → the same. After a removal or an Undo, × ignores
clicks for **0.5 s** (the double-click window): the next keyword slides
under the mouse, and the second click of a double-click must not remove it;
a normal second click after that removes it (headless Chrome: a second click
100 and 300 ms later removed nothing more, 600 ms later removed the next).

A double or triple click on "Read PDF & continue" never adds or removes a
keyword (0 of 24 runs). **Known limit, accepted (errata #80):** in 48 single
stray clicks or taps on the same spot **after** that second (at 1.2 s and 2 s,
6 window sizes, 2 study shapes), **none added** a keyword (there is nothing
left to add with; before #80: 10 of 48) and **2 removed one**: both on the
**390×844 phone**, 1 author and 4 printed keywords, a stray **tap about 1.2 s
after the step opened**, which Chrome's touch targeting snapped onto the × of
"Irrigation scheduling". Each time "Removed Irrigation scheduling. Undo" was
shown. **0 on desktop sizes, none posted the study.** No further guard is
used: a longer one would also ignore deliberate removals.

---

## 7. Limits

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
  the evidence rule exists, and why no percentage is shown to staff.
- **Phrases are two or three words and statistical, with word lists, not
  grammar:** the filter (§3) knows fixed lists of verbs and grammar words, so
  a verb outside them gets through, above all one ending in -s right after a
  noun, which looks like a plural noun ("system sends", "system records",
  "registrar approves", "system waters", "application helps", "saves
  water", "project addresses"), and a plain verb after a plural noun
  ("sensors measure"). Round 3 kept them out by adding only phrases seen
  twice; since errata #79 they **can be added again as fillers**, but only
  in the places left after the phrases seen twice. In the 14 made-up
  capstones 7 come back ("system records", "registrar approves", "lower
  compliance", "percent rice", "posted daily", "system waters", "set
  level"); in the 29 sample PDFs read, 4 clear ones ("practice
  adaptability", "proactive Park", "help PNOC", "developed protocol") and
  some weak ones ("Technology Leaders", "Stage-Gate Standard", "situ
  conservation", "major corporations", "efficient procedure", "applicable
  protocol"). The AUTO tag and × are there for them. No meaning — like
  similarity, it compares words, not ideas (`docs/14` §5).
- **A term seen only once is never a three-word keyword** (§3): "social media
  marketing", "milk tea shops", "soil organic matter" give their stronger pair
  ("social media", "tea shops", "organic matter"), and on a tie the
  right-hand pair can lose a good first word ("Fall armyworm" → "armyworm
  damage", "lowland rice" → "rice fields").
- **The room is filled** (errata #79): round 3 gave a short abstract 1 to 3
  automatic keywords, sometimes none; now each study gets its full room
  unless it runs out of suggestions. 14 made-up capstones 41 → 70 (5 each);
  29 sample PDFs read 69 → 108, 39 of them seen once. Only ALFONSO (9 printed)
  and LACAP (8 printed) get none: they have no room.
- **Good terms seen once are now added when there is room** ("stock levels",
  "grain yield", "elementary school", "feed conversion", "Radyo DZLB"), but
  they are not added when the repeated phrases and better-scoring ones fill
  the room first ("tertiary hospital", "Real-time monitoring"). **A junk
  filler can take a good term's place:** in the greenhouse capstone "system
  waters" and "set level" score above "Real-time monitoring", so they are
  added and it is not (since errata #80 it is not shown either).
- **A repeated fragment is still added:** "IoT-based water", "web-based
  inventory", "Fish fed", "Philippines University" each appear twice. The
  AUTO tag is there so staff can remove them.
- **Junk in the abstract becomes junk phrases:** a PDF's publisher lines
  ("Procedia Computer Science") can be suggested; the common ones are in
  `PHRASE_STOP_WORDS`.
- **A stray tap after the first second can remove a keyword on a phone** (§6,
  known limit, errata #80): 2 of 48 stray clicks or taps, both on a 390×844
  phone about 1.2 s after the step opened; "Removed … Undo" shown each time;
  0 on desktop sizes; never saved. Stray adds went from 10 of 48 to 0.
- **No keyword can be added by hand** (errata #80). A study whose PDF prints no
  keywords and whose abstract gives few phrases gets only what the model
  finds; a missing good term cannot be typed in. In Edit study nothing can be
  added at all, except by choosing a PDF that prints keywords.
- **A typed abstract gets its keywords once** (§6): if staff paste the wrong
  abstract first, then the right one, the keywords of the first stay (staff
  remove them) and none come from the second.

---

## Reference

McCallum, A., & Nigam, K. (1998). A comparison of event models for naive Bayes
text classification. In *AAAI-98 Workshop on Learning for Text Categorization*
(pp. 41–48). AAAI Press.
