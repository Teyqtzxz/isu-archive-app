// Keyword predictor: a small machine-learning model trained in the browser on
// the stored studies. Pure: no React, no firebase. Examples in
// keywordModel.check.ts (node src/keywordModel.check.ts). The method, a worked
// example by hand and the evaluation are explained in docs/15-keyword-model.md.
//
// Two parts:
//  - learned: multinomial Naive Bayes, one model per known keyword (one-vs-rest,
//    Laplace smoothing), trained on every stored study's title + abstract
//    (features) and its keywords (labels). It can only suggest keywords that
//    earlier studies already use.
//  - extracted: the top TF-IDF two-word phrases of the new abstract, so there
//    is something to suggest even with no training data.
// Word processing is similarity.ts's (tokenize, plurals folded, common words
// dropped), so a word is the same word in search, similarity and here.
import { tokenize } from "./search.ts";
import { buildOriginalityIndex, foldPlural, isCountedTerm, originalityCheck, similarityTerms } from "./similarity.ts";
import { cleanKeyword, keywordProblem } from "./validation.ts";
import type { Thesis } from "./types";

/** What the model reads from a study. A draft on the Register form has no id. */
export type KeywordText = Pick<Thesis, "title" | "abstract" | "keywords">;
export type KeywordStudy = KeywordText & Pick<Thesis, "id">;

/** Settings, decided on the real e-library (docs/15 §4). */
export const KEYWORD_MODEL = {
  /** A learned keyword is suggested only at this Naive Bayes probability or more… */
  minProbability: 0.9,
  /** …and only when at least this many different words of the study point to it
   *  (seen in that keyword's studies, more likely with it than without). */
  minEvidence: 5,
  /** Most suggestions shown, learned ones first. */
  maxSuggestions: 6,
  /** Below this many studies with keywords the accuracy is "not reliable yet". */
  reliableFrom: 30,
} as const;

/** One keyword however it was typed: "Rice", "rice " and "rices" → "rice";
 *  "Low-cost sensors" → "low cost sensor". "" when it has no words. */
export function keywordKey(keyword: string): string {
  return tokenize(keyword).map(foldPlural).join(" ");
}

/** Words of a study the model counts (title + abstract), repeats kept. */
const featureWords = (doc: Pick<Thesis, "title" | "abstract">) => similarityTerms(`${doc.title} ${doc.abstract}`);

/** A keyword the form would accept exactly as typed: validation.ts rules, and
 *  no , or ; (the Keywords box splits on those). The cleaned text, or null. */
function acceptable(text: string): string | null {
  const k = cleanKeyword(text);
  return k && !/[,;]/.test(k) && keywordProblem(k) === null ? k : null;
}

/** The distinct valid keyword keys of a study, with their spelling. */
function studyLabels(keywords: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of keywords ?? []) {
    const spelling = acceptable(raw);
    const key = spelling ? keywordKey(spelling) : "";
    if (key && !out.has(key)) out.set(key, spelling!);
  }
  return out;
}

export interface LearnedKeyword {
  key: string;
  /** The spelling shown: the most used one, first seen on a tie. */
  keyword: string;
  /** Training studies that have this keyword. */
  studies: number;
  /** Word counts over those studies' titles and abstracts. */
  counts: Map<string, number>;
  /** Sum of `counts`. */
  total: number;
}

export interface KeywordModel {
  /** Training studies: stored studies with at least one keyword. */
  n: number;
  /** Training studies containing each word. Its keys are the vocabulary. */
  df: Map<string, number>;
  /** Word counts over every training study, and their sum. */
  counts: Map<string, number>;
  total: number;
  labels: LearnedKeyword[];
}

/**
 * Trains the model. Only studies with at least one keyword are used (a study
 * with none is unlabelled, not an example of "no keyword"). `excludeId`: the
 * study being edited, which must never be learned from (it would "predict"
 * its own keywords). Build once per data change (useMemo), never per keystroke.
 */
export function trainKeywordModel(studies: KeywordStudy[], { excludeId }: { excludeId?: string } = {}): KeywordModel {
  const df = new Map<string, number>();
  const counts = new Map<string, number>();
  let total = 0;
  const byKey = new Map<string, LearnedKeyword & { spellings: Map<string, number> }>();
  let n = 0;
  for (const s of studies) {
    if (s.id === excludeId) continue;
    const labels = studyLabels(s.keywords);
    if (labels.size === 0) continue;
    n++;
    const words = featureWords(s);
    const own = new Map<string, number>();
    for (const w of words) own.set(w, (own.get(w) ?? 0) + 1);
    for (const [w, c] of own) {
      df.set(w, (df.get(w) ?? 0) + 1);
      counts.set(w, (counts.get(w) ?? 0) + c);
    }
    total += words.length;
    for (const [key, spelling] of labels) {
      let l = byKey.get(key);
      if (!l) byKey.set(key, l = { key, keyword: spelling, studies: 0, counts: new Map(), total: 0, spellings: new Map() });
      l.studies++;
      l.spellings.set(spelling, (l.spellings.get(spelling) ?? 0) + 1);
      for (const [w, c] of own) l.counts.set(w, (l.counts.get(w) ?? 0) + c);
      l.total += words.length;
    }
  }
  const labels = [...byKey.values()].map(({ spellings, ...l }) => {
    let best = l.keyword;
    for (const [s, c] of spellings) if (c > (spellings.get(best) ?? 0)) best = s;
    return { ...l, keyword: best };
  });
  return { n, df, counts, total, labels };
}

export interface KeywordPrediction {
  key: string;
  keyword: string;
  studies: number;
  /** Naive Bayes P(keyword | study), 0–1. */
  probability: number;
  /** Different words of the study seen with this keyword and more likely with it than without. */
  evidence: number;
}

/**
 * Naive Bayes, one-vs-rest, for every known keyword k (docs/15 §2):
 *   P(w | k)  = (count of w in studies with k    + 1) / (words in studies with k    + |V|)
 *   P(w | ¬k) = (count of w in studies without k + 1) / (words in studies without k + |V|)
 *   z = ln((n_k + 1) / (N − n_k + 1)) + Σ over the study's words [ln P(w|k) − ln P(w|¬k)]
 *   P(k | study) = 1 / (1 + e^−z)
 * Words not in the vocabulary are skipped (no evidence either way). Sums of
 * logs, so hundreds of small probabilities never round to 0. Best first.
 */
export function predictKeywords(model: KeywordModel, doc: Pick<Thesis, "title" | "abstract">): KeywordPrediction[] {
  const v = model.df.size;
  const words = featureWords(doc).filter(w => model.df.has(w));
  const distinct = new Set(words);
  return model.labels.map(l => {
    const negTotal = model.total - l.total;
    const logRatio = (w: string) => {
      const pos = l.counts.get(w) ?? 0;
      const neg = (model.counts.get(w) ?? 0) - pos;
      return Math.log((pos + 1) / (l.total + v)) - Math.log((neg + 1) / (negTotal + v));
    };
    let z = Math.log((l.studies + 1) / (model.n - l.studies + 1));
    for (const w of words) z += logRatio(w);
    let evidence = 0;
    for (const w of distinct) if ((l.counts.get(w) ?? 0) > 0 && logRatio(w) > 0) evidence++;
    // Logistic function, written so a large |z| never overflows.
    const probability = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
    return { key: l.key, keyword: l.keyword, studies: l.studies, probability, evidence };
  }).sort((a, b) => b.probability - a.probability || b.evidence - a.evidence || b.studies - a.studies || a.key.localeCompare(b.key));
}

/** Words that make poor keyword phrases on their own ("model achieved",
 *  "results showed", the publisher lines of a journal PDF). Applied to single
 *  words only, so "low-cost" is still a word. */
export const PHRASE_STOP_WORDS: ReadonlySet<string> = new Set([
  "achieved", "revealed", "showed", "show", "shown", "found", "offer", "offered", "discussed", "investigate",
  "investigated", "evaluated", "measured", "compared", "tested", "conducted", "provide", "provided", "result",
  "finding", "paper", "work", "article", "author", "published", "conference", "procedia", "elsevier", "license",
  "access", "open", "new", "high", "low", "total", "primary", "second", "first", "current", "similar", "well",
  "less", "extra",
]);

/** A word of the abstract as written: letters/digits, hyphen-joined parts kept
 *  together ("low-cost"). */
const WORD = /[\p{L}\p{M}\d_]+(?:[-‐][\p{L}\p{M}\d_]+)*/gu;

/** The folded words of one written word if it can be half of a phrase, else null. */
function phraseWord(written: string): string[] | null {
  const parts = tokenize(written).map(foldPlural);
  if (parts.length === 1) {
    const [t] = parts;
    return isCountedTerm(t) && t.length >= 3 && /\p{L}/u.test(t) && !PHRASE_STOP_WORDS.has(t) ? parts : null;
  }
  return parts.length > 1 && parts.every(isCountedTerm) ? parts : null;
}

export interface ExtractedPhrase {
  key: string;
  /** As written in the abstract (the most used spelling): "low-cost sensors". */
  text: string;
  score: number;
}

/**
 * Two-word phrases of `abstract`, best first (docs/15 §3). Two words form a
 * phrase only when nothing but spaces stands between them, so a phrase never
 * crosses a full stop, comma, bracket or dash, and only when they are not the
 * same word ("rice rice", "Niño niños"). Scored by TF-IDF:
 *   w(word)        = (1 + ln tf) × (1 + ln((1 + N) / (1 + df)))     (tf in this abstract,
 *                                                                    df over the training studies)
 *   score(phrase)  = (1 + ln tf(phrase)) × (w(first) + w(second))
 * A hyphenated word counts with its strongest part. The +1 on idf keeps the
 * scores above 0 with an empty library (then tf alone decides).
 */
export function extractPhrases(model: Pick<KeywordModel, "n" | "df">, abstract: string): ExtractedPhrase[] {
  const text = abstract.normalize("NFC");
  const tf = new Map<string, number>();
  for (const t of similarityTerms(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const weight = (t: string) =>
    (1 + Math.log(tf.get(t) ?? 1)) * (1 + Math.log((1 + model.n) / (1 + (model.df.get(t) ?? 0))));
  const wordWeight = (parts: string[]) => Math.max(...parts.map(weight));

  const found = new Map<string, { count: number; first: number; spellings: Map<string, number>; parts: [string[], string[]] }>();
  let prev: { parts: string[] | null; written: string; end: number } | null = null;
  let order = 0;
  for (const m of text.matchAll(WORD)) {
    const parts = phraseWord(m[0]);
    const start = m.index ?? 0;
    // Both halves must differ once folded: "rice rice" / "rice rices" is no phrase.
    if (prev?.parts && parts && /^\s+$/.test(text.slice(prev.end, start)) && prev.parts.join(" ") !== parts.join(" ")) {
      const key = [...prev.parts, ...parts].join(" ");
      const written = `${prev.written} ${m[0]}`;
      let f = found.get(key);
      if (!f) found.set(key, f = { count: 0, first: order++, spellings: new Map(), parts: [prev.parts, parts] });
      f.count++;
      f.spellings.set(written, (f.spellings.get(written) ?? 0) + 1);
    }
    prev = { parts, written: m[0], end: start + m[0].length };
  }
  return [...found].map(([key, f]) => {
    let text = "";
    for (const [s, c] of f.spellings) if (c > (f.spellings.get(text) ?? 0)) text = s;
    return { key, text, first: f.first, score: (1 + Math.log(f.count)) * (wordWeight(f.parts[0]) + wordWeight(f.parts[1])) };
  }).sort((a, b) => b.score - a.score || a.first - b.first)
    .map(({ key, text, score }) => ({ key, text, score }));
}

export interface KeywordSuggestion {
  key: string;
  /** Passes validation.ts as typed; clicking the chip adds it through addKeywords(). */
  keyword: string;
  source: "learned" | "abstract";
  /** Learned: the training studies with this keyword. Abstract: 0. */
  studies: number;
}

/**
 * Up to KEYWORD_MODEL.maxSuggestions keywords for a study: learned ones first
 * (probability ≥ minProbability and evidence ≥ minEvidence), then phrases of
 * its abstract. Never a keyword the study already has, never the same keyword
 * twice (compared by keywordKey), never one the Keywords box would refuse.
 */
export function suggestKeywords(model: KeywordModel, doc: KeywordText, limit: number = KEYWORD_MODEL.maxSuggestions): KeywordSuggestion[] {
  const taken = new Set(doc.keywords.map(keywordKey));
  const out: KeywordSuggestion[] = [];
  const offer = (key: string, text: string, source: KeywordSuggestion["source"], studies: number) => {
    const keyword = acceptable(text);
    if (out.length >= limit || !keyword || !key || taken.has(key)) return;
    taken.add(key);
    out.push({ key, keyword, source, studies });
  };
  for (const p of predictKeywords(model, doc)) {
    if (p.probability >= KEYWORD_MODEL.minProbability && p.evidence >= KEYWORD_MODEL.minEvidence) {
      offer(p.key, p.keyword, "learned", p.studies);
    }
  }
  for (const p of extractPhrases(model, doc.abstract)) offer(p.key, p.text, "abstract", 0);
  return out;
}

/** "learned from 3 studies" / "from this abstract", under each chip. */
export function suggestionSource(s: Pick<KeywordSuggestion, "source" | "studies">): string {
  return s.source === "abstract" ? "from this abstract" : `learned from ${s.studies} ${s.studies === 1 ? "study" : "studies"}`;
}

// ─── Evaluation: leave-one-out cross-validation ─────────────────────────────

export interface KeywordScores {
  /** Studies with at least one real keyword among the suggestions, 0–1. */
  hitRate: number;
  /** Correct suggestions ÷ suggestions shown, 0–1 (0 when none were shown). */
  precision: number;
  /** Average share of each study's real keywords that were suggested, 0–1. */
  recall: number;
}

export interface KeywordEvaluation {
  /** Studies with keywords, each tested once. */
  tested: number;
  /** Studies left out of some test because they are a near-copy (≥ 80%
   *  similar, the "Possible duplicate" level) of the study being tested. */
  copiesHidden: number;
  model: KeywordScores;
  /** Always suggesting the most used keywords of the training studies. */
  baseline: KeywordScores;
}

export interface KeywordFold {
  /** The study being tested; its keywords are the answer. */
  test: KeywordStudy;
  /** Everything the fold's model may learn from: never `test`, never `copies`. */
  training: KeywordStudy[];
  /** Ids of the test study's near-copies left out with it. */
  copies: string[];
}

/** One fold per study with keywords. `hideNearCopies`: also leave out every
 *  study ≥ 80% similar to it (similarity.ts "Possible duplicate"). */
export function leaveOneOutFolds(studies: KeywordStudy[], { hideNearCopies = true }: { hideNearCopies?: boolean } = {}): KeywordFold[] {
  const copyIndex = hideNearCopies ? buildOriginalityIndex(studies) : null;
  return studies.filter(s => studyLabels(s.keywords).size > 0).map(test => {
    const copies = copyIndex
      ? originalityCheck(copyIndex, test, { excludeId: test.id, limit: Infinity }).filter(m => m.level === "duplicate").map(m => m.id)
      : [];
    const hide = new Set([test.id, ...copies]);
    return { test, training: studies.filter(x => !hide.has(x.id)), copies };
  });
}

/**
 * Leave-one-out (docs/15 §5): each study with keywords in turn has its
 * keywords hidden, a NEW model is trained from scratch on the other studies
 * (keywords, vocabulary, word counts and phrase df — nothing of the tested
 * study), and its suggestions are compared with the real keywords. The
 * baseline suggests the same number of the training studies' most used
 * keywords. `hideNearCopies`: also leave out the tested study's near-copies,
 * otherwise the model only remembers the copy (the e-library holds the same
 * PDFs registered several times).
 */
export function evaluateKeywordModel(studies: KeywordStudy[], options: { hideNearCopies?: boolean } = {}): KeywordEvaluation {
  const folds = leaveOneOutFolds(studies, options);
  const sum = { model: { hits: 0, correct: 0, shown: 0, recall: 0 }, baseline: { hits: 0, correct: 0, shown: 0, recall: 0 } };
  for (const { test: s, training } of folds) {
    const truth = new Set(studyLabels(s.keywords).keys());
    const model = trainKeywordModel(training);
    const shownByModel = suggestKeywords(model, { title: s.title, abstract: s.abstract, keywords: [] }).map(x => x.key);
    const shownByBaseline = [...model.labels]
      .sort((a, b) => b.studies - a.studies || a.key.localeCompare(b.key))
      .slice(0, KEYWORD_MODEL.maxSuggestions).map(l => l.key);
    for (const [name, shown] of [["model", shownByModel], ["baseline", shownByBaseline]] as const) {
      const correct = shown.filter(k => truth.has(k)).length;
      const t = sum[name];
      t.hits += correct > 0 ? 1 : 0;
      t.correct += correct;
      t.shown += shown.length;
      t.recall += correct / truth.size;
    }
  }
  const tested = folds.length;
  const scores = (t: typeof sum.model): KeywordScores => ({
    hitRate: tested ? t.hits / tested : 0,
    precision: t.shown ? t.correct / t.shown : 0,
    recall: tested ? t.recall / tested : 0,
  });
  const copiesHidden = new Set(folds.flatMap(f => f.copies)).size;
  return { tested, copiesHidden, model: scores(sum.model), baseline: scores(sum.baseline) };
}
