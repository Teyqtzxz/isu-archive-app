// Keyword predictor: a small machine-learning model trained in the browser on
// the stored studies. Pure: no React, no firebase. Examples in
// keywordModel.check.ts (node src/keywordModel.check.ts). The method, a worked
// example by hand and the evaluation are explained in docs/15-keyword-model.md.
//
// Two parts:
//  - learned: Naive Bayes, one model per known keyword (one-vs-rest, Laplace
//    smoothing), trained on every stored study's title + abstract (features,
//    each word counted once per study) and its keywords (labels); near-copies
//    of one study count as one. It can only suggest keywords that earlier
//    studies already use, and the Register form shows none before
//    KEYWORD_MODEL.reliableFrom studies have keywords.
//  - extracted: the top TF-IDF two-word phrases of the new abstract (three
//    words when a term always comes as three), with junk phrases filtered out,
//    so there is something to suggest even with no training data.
// autoKeywords() picks the ones the Register form adds by itself (docs/15 §6).
// Word processing is similarity.ts's (tokenize, plurals folded, common words
// dropped), so a word is the same word in search, similarity and here.
import { tokenize } from "./search.ts";
import {
  buildOriginalityIndex, foldPlural, isCountedTerm, possibleDuplicates, similarityTerms, type OriginalityIndex,
} from "./similarity.ts";
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
  /** At most this many of them learned, so phrases of the abstract keep places. */
  maxLearned: 3,
  /** Below this many studies with keywords (near-copies counted once) the
   *  accuracy is "not reliable yet", and the Register form neither suggests
   *  nor adds learned keywords. The Statistics card still tests them. */
  reliableFrom: 30,
  /** New study, save step: at most this many keywords added by themselves… */
  autoMax: 5,
  /** …and never past this many keywords in all, so 2 of MAX_KEYWORDS (10) stay free. */
  autoTotal: 8,
  /** At most this many of the added ones learned. */
  autoMaxLearned: 2,
  /** Phrases of the abstract that appear at least this many times in the title
   *  plus abstract are added first; the room left is then filled with the
   *  other suggestions (errata #79; learned ones are not counted). */
  autoMinCount: 2,
} as const;

/** One keyword however it was typed: "Rice", "rice " and "rices" → "rice";
 *  "Low-cost sensors" → "low cost sensor". "" when it has no words. */
export function keywordKey(keyword: string): string {
  return tokenize(keyword).map(foldPlural).join(" ");
}

/** The different words of a study the model counts (title + abstract): each
 *  once, however often it is written. */
const wordSet = (doc: Pick<Thesis, "title" | "abstract">) => new Set(similarityTerms(`${doc.title} ${doc.abstract}`));

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
  /** Training studies that have this keyword (a near-copy group counts once). */
  studies: number;
  /** For each word: how many of those studies have it in the title or abstract. */
  counts: Map<string, number>;
  /** Sum of `counts`. */
  total: number;
}

export interface KeywordModel {
  /** Training studies: stored studies with at least one keyword, each group
   *  of near-copies counted once. */
  n: number;
  /** Studies with keywords not counted in `n` because they are a near-copy of another. */
  copiesMerged: number;
  /** Training studies containing each word. Its keys are the vocabulary. As
   *  each word counts once per study, this is also the word count. */
  df: Map<string, number>;
  /** Sum of df: the words of every training study, each once per study. */
  total: number;
  labels: LearnedKeyword[];
}

/** For each study id, the ids of its near-copies: the originality check's
 *  "Possible duplicate" (≥ 80%, similarity.ts). */
export type NearCopies = ReadonlyMap<string, readonly string[]>;

/** Near-copies of every study, by similarity.ts possibleDuplicates (the same
 *  answer as the originality check). `index`: buildOriginalityIndex(studies),
 *  when the caller already has it. Build once per data change. */
export function findNearCopies(studies: KeywordStudy[], index: OriginalityIndex = buildOriginalityIndex(studies)): NearCopies {
  const lists = possibleDuplicates(index);
  return new Map(index.overall.ids.map((id, i) => [id, lists[i]]));
}

/**
 * Trains the model. Only studies with at least one keyword are used (a study
 * with none is unlabelled, not an example of "no keyword"). `excludeId`: the
 * study being edited, which must never be learned from (it would "predict"
 * its own keywords). Near-copies (`nearCopies`, found here when not given)
 * are joined into one training study, their words and keywords together and
 * each once, so a PDF registered three times does not count three times.
 * Every word counts once per study, however often it is written. Build once
 * per data change (useMemo), never per keystroke.
 */
export function trainKeywordModel(
  studies: KeywordStudy[],
  { excludeId, nearCopies }: { excludeId?: string; nearCopies?: NearCopies } = {},
): KeywordModel {
  const labelled = studies.filter(s => s.id !== excludeId && studyLabels(s.keywords).size > 0);
  // Groups of near-copies (union-find). A study left out never links two others.
  const copies = nearCopies ?? findNearCopies(studies);
  const at = new Map(labelled.map((s, i) => [s.id, i]));
  const parent = labelled.map((_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  labelled.forEach((s, i) => {
    for (const id of copies.get(s.id) ?? []) {
      const j = at.get(id);
      if (j === undefined) continue;
      const a = root(i), b = root(j);
      if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
    }
  });
  const groups = new Map<number, KeywordStudy[]>();
  labelled.forEach((s, i) => {
    const r = root(i);
    const g = groups.get(r);
    if (g) g.push(s);
    else groups.set(r, [s]);
  });

  const df = new Map<string, number>();
  let total = 0;
  const byKey = new Map<string, LearnedKeyword & { spellings: Map<string, number> }>();
  for (const group of groups.values()) {
    const words = new Set<string>();
    const labels = new Map<string, string>();
    for (const s of group) {
      for (const w of wordSet(s)) words.add(w);
      for (const [key, spelling] of studyLabels(s.keywords)) if (!labels.has(key)) labels.set(key, spelling);
    }
    for (const w of words) df.set(w, (df.get(w) ?? 0) + 1);
    total += words.size;
    for (const [key, spelling] of labels) {
      let l = byKey.get(key);
      if (!l) byKey.set(key, l = { key, keyword: spelling, studies: 0, counts: new Map(), total: 0, spellings: new Map() });
      l.studies++;
      l.spellings.set(spelling, (l.spellings.get(spelling) ?? 0) + 1);
      for (const w of words) l.counts.set(w, (l.counts.get(w) ?? 0) + 1);
      l.total += words.size;
    }
  }
  const labels = [...byKey.values()].map(({ spellings, ...l }) => {
    let best = l.keyword;
    for (const [s, c] of spellings) if (c > (spellings.get(best) ?? 0)) best = s;
    return { ...l, keyword: best };
  });
  return { n: groups.size, copiesMerged: labelled.length - groups.size, df, total, labels };
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
 * Naive Bayes, one-vs-rest, for every known keyword k (docs/15 §2). Every
 * word counts once per study, in training and in the study being scored:
 *   P(w | k)  = (studies with k having w    + 1) / (words of studies with k    + |V|)
 *   P(w | ¬k) = (studies without k having w + 1) / (words of studies without k + |V|)
 *   z = ln((n_k + 1) / (N − n_k + 1)) + Σ over the study's different words [ln P(w|k) − ln P(w|¬k)]
 *   P(k | study) = 1 / (1 + e^−z)
 * Words not in the vocabulary are skipped (no evidence either way). Sums of
 * logs, so hundreds of small probabilities never round to 0. Best first.
 */
export function predictKeywords(model: KeywordModel, doc: Pick<Thesis, "title" | "abstract">): KeywordPrediction[] {
  const v = model.df.size;
  const words = [...wordSet(doc)].filter(w => model.df.has(w));
  return model.labels.map(l => {
    const negTotal = model.total - l.total;
    const logRatio = (w: string) => {
      const pos = l.counts.get(w) ?? 0;
      const neg = (model.df.get(w) ?? 0) - pos;
      return Math.log((pos + 1) / (l.total + v)) - Math.log((neg + 1) / (negTotal + v));
    };
    let z = Math.log((l.studies + 1) / (model.n - l.studies + 1));
    for (const w of words) z += logRatio(w);
    let evidence = 0;
    for (const w of words) if ((l.counts.get(w) ?? 0) > 0 && logRatio(w) > 0) evidence++;
    // Logistic function, written so a large |z| never overflows.
    const probability = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
    return { key: l.key, keyword: l.keyword, studies: l.studies, probability, evidence };
  }).sort((a, b) => b.probability - a.probability || b.evidence - a.evidence || b.studies - a.studies || a.key.localeCompare(b.key));
}

// ─── Junk-phrase filter (docs/15 §3) ────────────────────────────────────────
// Real abstracts gave "Nurses should", "participants reported", "providing
// quality", "documents internally", "specific plastic". The rules below only
// decide which written words may be half of a keyword phrase; similarity.ts
// STOP_WORDS (and so search and the originality check) are not changed.

/** Grammar words similarity.ts keeps (it only drops the commonest ones):
 *  modal verbs, prepositions, linking words. Never in a phrase. */
const GRAMMAR_WORDS: ReadonlySet<string> = new Set([
  "should", "must", "might", "shall", "cannot", "during", "along", "across", "toward", "towards", "via", "per",
  "despite", "including", "regarding", "concerning", "around", "before", "beyond", "against", "throughout",
  "until", "since", "onto", "whether", "very", "just", "even", "often", "however", "therefore", "thus",
  "hence", "although", "though", "because", "unless", "whereas", "yet", "still", "already", "always", "never",
  "like", "near", "behind", "above", "below", "besides", "beside", "amongst", "amid", "whom", "whose",
  "itself", "themselves", "here", "now", "every", "either", "neither", "some", "much", "another", "once",
  "twice", "again", "only", "further", "rather", "quite", "almost", "etc",
]);

/** Verbs of report writing that are not also common keyword nouns ("process",
 *  "project", "control", "change", "report", "design" are left out on
 *  purpose). Their base and -s forms are never in a phrase ("handle
 *  projects", "process involves"). Their -ed and -ing forms often are part of
 *  a real term ("automated attendance", "reduced tillage", "monitoring
 *  system"), so those follow the position rules in extractPhrases instead. */
const VERBS = [
  "adopt", "affect", "aim", "allow", "analyse", "analyze", "appear", "assess", "assist", "automate",
  "believe", "collect", "comprise", "conclude", "consider", "consist", "contribute", "demonstrate", "depend", "describe",
  "determine", "emphasise", "emphasize", "employ", "enable", "encourage", "engage", "enhance", "ensure",
  "establish", "examine", "exclude", "exist", "explain", "explore", "facilitate", "gather", "generate",
  "handle", "highlight", "identify", "implement", "improve", "include", "indicate", "intend", "involve",
  "maintain", "manage", "mitigate", "monitor", "obtain", "observe", "organise", "organize", "perform",
  "prefer", "present", "propose", "provide", "recommend", "reduce", "remain", "require", "seek", "select",
  "seem", "serve", "streamline", "suggest", "tend", "utilise", "utilize",
];
/** Forms that do not follow verbForms(), and "born" ("students born"). */
const IRREGULAR_VERB_FORMS = [
  "made", "making", "make", "held", "hold", "holding", "sought", "became", "become", "becoming", "gave",
  "given", "give", "giving", "took", "taken", "take", "taking", "done", "began", "begun", "brought", "chose",
  "chosen", "kept", "sent", "spent", "told", "thought", "understood", "wrote", "written", "born", "rose", "fell",
  "grew", "saw", "went", "came", "felt", "paid", "sold", "buy", "buys", "bought", "taught", "transmit",
  "transmitted", "transmitting", "submit", "submitted", "submitting", "admit", "admitted",
  // "applied" is left out: "applied mathematics".
  "apply", "applies", "applying",
];
/** The base and -s form of a regular verb ("provide", "provides"). */
const verbBase = (base: string) => [base, /[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ies` : `${base}s`];
/** Its -ing form ("providing", "monitoring"). */
const verbIng = (base: string) => (base.endsWith("e") ? `${base.slice(0, -1)}ing` : `${base}ing`);
/** Never in a phrase: the base and -s forms of VERBS, and IRREGULAR_VERB_FORMS. */
const VERB_FORMS: ReadonlySet<string> = new Set([...VERBS.flatMap(verbBase), ...IRREGULAR_VERB_FORMS]);
/** The -ing forms of VERBS: "monitoring system" is a term, "in providing quality care" is not (extractPhrases). */
const VERB_ING: ReadonlySet<string> = new Set(VERBS.map(verbIng));
/** Right after one of these, a VERBS -ing form is a verb: "in providing quality care", "for monitoring water". */
const PREPOSITIONS: ReadonlySet<string> = new Set([
  "in", "on", "for", "by", "with", "of", "from", "to", "at", "into", "through", "without", "about", "after",
  "before", "upon", "via", "during", "toward", "towards", "among", "between", "within", "while",
]);
/** Nouns similarity drops as common words; an -ed word right after them is a verb too ("this study assessed"). */
const DROPPED_NOUNS: ReadonlySet<string> = new Set(["study", "research"]);

/** Words ending in -ly that are adverbs without one of the usual endings below. */
const ADVERBS: ReadonlySet<string> = new Set([
  "only", "highly", "mainly", "mostly", "largely", "merely", "rarely", "fairly", "nearly", "newly", "poorly",
  "properly", "quickly", "slightly", "strongly", "truly", "widely", "clearly", "closely", "deeply", "greatly",
  "firmly", "freely", "partly", "simply", "solely", "likely", "directly", "entirely", "completely", "extremely",
  "namely", "purely", "barely", "hardly", "surely", "safely", "jointly", "overly", "roughly", "briefly",
  "shortly", "really", "exactly", "correctly", "strictly", "heavily", "easily", "readily", "steadily", "badly",
]);
/** An adverb: "internally", "significantly", "effectively", "particularly",
 *  "possibly", "primarily", or one of ADVERBS. Nouns and adjectives such as
 *  "family", "supply", "assembly", "elderly", "early", "monthly" do not match. */
export function isAdverb(word: string): boolean {
  return ADVERBS.has(word) || (word.length >= 6 && /(?:al|ful|ous|ive|ent|ant|ic|ate|ing|less|ish|ed|[ui]lar|[ai]b|ari)ly$/.test(word));
}

/** Vague words that cannot start a phrase ("specific plastic", "various
 *  documents", "existing waste") nor end one ("producing various", "plastic
 *  types several"), errata #79. */
const NOT_FIRST: ReadonlySet<string> = new Set([
  "specific", "various", "different", "several", "certain", "particular", "existing", "numerous", "many", "few",
  "overall", "same", "own", "such", "respective", "corresponding", "pertinent", "relevant",
]);

/** A word ending in -ed: "reported", "perceived". Nouns ending in -eed
 *  ("need", "seed") and "hundred" are not. */
const isEdForm = (word: string) => word.length >= 5 && word.endsWith("ed") && !word.endsWith("eed") && word !== "hundred";

/** A past form cannot end a phrase: "participants reported", "proponent
 *  excluded", "nurses held". An -ed word may start one ("perceived
 *  behavioral", "integrated farming", "reduced tillage"), but not right after
 *  a noun, where it is the verb of the sentence ("irrigation saved water",
 *  "this study assessed students"); right after another -ed word it may
 *  ("practiced reduced tillage"). */
function isPastForm(word: string): boolean {
  return isEdForm(word) || VERB_FORMS.has(word);
}

/** A roman page number up to 99 ("xiii Nurse-Patient"). Without m and d, so
 *  "mix" and "dim" are words. */
const isRomanNumeral = (word: string) => word.length >= 2 && /^(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/.test(word);

/** Fixed two-word terms whose second word must never start a phrase right
 *  after the first: in "the use case suite and the test case suite" there is
 *  no "case suite". "use" is a common word similarity drops, so the phrase
 *  reader cannot see "use case" by itself; "test case" needs it once a term
 *  seen only once keeps its right-hand pair (docs/15 §3). */
const FIXED_TERMS: ReadonlyMap<string, ReadonlySet<string>> = new Map([["case", new Set(["use", "test"])]]);

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

/** The folded words of one written word if it can be half of a phrase, else
 *  null. A single word must be counted by similarity.ts, 3+ characters with a
 *  letter, and none of: PHRASE_STOP_WORDS, a grammar word, a verb form, an
 *  adverb, a roman numeral. A hyphenated word ("low-cost", "game-based")
 *  only needs one part counted. */
function phraseWord(written: string): string[] | null {
  const parts = tokenize(written).map(foldPlural);
  if (parts.length === 1) {
    const [t] = parts;
    const plain = tokenize(written)[0];
    return isCountedTerm(t) && t.length >= 3 && /\p{L}/u.test(t) && !PHRASE_STOP_WORDS.has(t)
      && !GRAMMAR_WORDS.has(t) && !VERB_FORMS.has(t) && !VERB_FORMS.has(plain) && !isAdverb(t) && !isRomanNumeral(t)
      ? parts : null;
  }
  return parts.length > 1 && parts.some(t => isCountedTerm(t) && /\p{L}/u.test(t)) ? parts : null;
}

export interface ExtractedPhrase {
  key: string;
  /** As written in the abstract (the most used spelling): "low-cost sensors". */
  text: string;
  score: number;
}

/**
 * Keyword phrases of `abstract`, best first (docs/15 §3).
 *
 * Two words form a phrase only when nothing but spaces stands between them,
 * so a phrase never crosses a full stop, comma, bracket or dash; only when
 * they are not the same word ("rice rice", "Niño niños"); and only when the
 * first may start a phrase (not NOT_FIRST, and not an -ed word right after a
 * phrase word) and the second may end one (not a past form, not NOT_FIRST).
 * Scored by TF-IDF:
 *   w(word)        = (1 + ln tf) × (1 + ln((1 + N) / (1 + df)))     (tf in this abstract,
 *                                                                    df over the training studies)
 *   score(phrase)  = (1 + ln tf(phrase)) × (w(first) + w(second))
 * A hyphenated word counts with its strongest part. The +1 on idf keeps the
 * scores above 0 with an empty library (then tf alone decides).
 *
 * Three-word terms (docs/15 §3). A word next to a phrase counts only when it
 * makes a phrase with the phrase's nearer word by the rules above (so "the",
 * "of", "reduce" and other words that cannot be half of a phrase never count).
 *  - A phrase with the same word on both sides every time is the middle of
 *    a longer term and is dropped ("quality monitoring" in "water quality
 *    monitoring system", "failure team" in "heart failure team NLI-HFTP").
 *  - Three words A B C are a term of their own when, at least once, nothing
 *    stands in front of them and, at least once, nothing after them; else
 *    they are the middle of longer chains and their pairs stay as they are
 *    ("water quality" and "monitoring system" in "water quality monitoring
 *    system"; "plastic pollution" between "marine …/coastal …" and "harms").
 *  - Such a term whose pair "A B" or "B C" only ever appears inside it is
 *    offered instead of that pair when the three appear at least twice
 *    ("perceived behavioral control", "rice husk ash"). Seen once, only the
 *    stronger of "A B" and "B C" stays, the right-hand one on a tie, where
 *    an English term ends ("measure water temperature" → "water temperature").
 * A three-word term scores as its best part; one longer than a keyword may be
 * (60 characters) is not offered, and only the stronger of its parts is.
 */
export function extractPhrases(model: Pick<KeywordModel, "n" | "df">, abstract: string): ExtractedPhrase[] {
  const text = abstract.normalize("NFC");
  const tf = new Map<string, number>();
  for (const t of similarityTerms(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  const weight = (t: string) =>
    (1 + Math.log(tf.get(t) ?? 1)) * (1 + Math.log((1 + model.n) / (1 + (model.df.get(t) ?? 0))));
  const wordWeight = (parts: string[]) => Math.max(...parts.map(weight));

  const tokens = [...text.matchAll(WORD)].map(m => {
    const parts = phraseWord(m[0]);
    const start = m.index ?? 0;
    return { written: m[0], parts, key: parts?.join(" ") ?? "", folded: tokenize(m[0]).map(foldPlural).join(" "), start, end: start + m[0].length };
  });
  const single = (i: number) => (tokens[i].parts?.length === 1 ? tokens[i].key : "");
  /** A one-word plural as written: "nurses" (folds to "nurse"), not "process" or "analysis". */
  const isPlural = (t: (typeof tokens)[number]) => !t.written.includes("-") && t.written.toLowerCase() !== t.folded && /s$/i.test(t.written);
  /** Tokens i and i + 1 make a phrase. */
  const pairAt = (i: number): boolean => {
    if (i < 0 || i + 1 >= tokens.length) return false;
    const a = tokens[i], b = tokens[i + 1];
    if (!a.parts || !b.parts || a.key === b.key || !/^\s+$/.test(text.slice(a.end, b.start))) return false;
    if (NOT_FIRST.has(single(i)) || NOT_FIRST.has(single(i + 1)) || isPastForm(single(i + 1))) return false;
    const prev = i > 0 && /^\s+$/.test(text.slice(tokens[i - 1].end, a.start)) ? tokens[i - 1] : null;
    // "Drip irrigation saved water", "this study assessed students": after a noun, the -ed word is the verb.
    if (isEdForm(single(i)) && prev && (prev.parts ? !isEdForm(prev.key) : DROPPED_NOUNS.has(prev.folded))) return false;
    // "nurses providing care", "in providing quality care", "for monitoring water": a verb, not a term.
    if (VERB_ING.has(single(i + 1)) && isPlural(a)) return false;
    if (VERB_ING.has(single(i)) && prev && (PREPOSITIONS.has(prev.folded) || isPlural(prev))) return false;
    // "case" right after "use" or "test" (spaces only) is the end of that term.
    const heads = FIXED_TERMS.get(a.key);
    return !(heads && prev && heads.has(prev.folded));
  };

  interface Found {
    count: number; first: number; spellings: Map<string, number>; parts: [string[], string[]];
    /** The word in front / after at each appearance (its key), or null. */
    before: (string | null)[];
    after: (string | null)[];
  }
  const found = new Map<string, Found>();
  /** Three neighbouring words that make two phrases, A B + B C. */
  interface Three {
    count: number; spellings: Map<string, number>; left: string; right: string;
    before: (string | null)[];
    after: (string | null)[];
  }
  const threes = new Map<string, Three>();
  let order = 0;
  for (let i = 0; i + 1 < tokens.length; i++) {
    if (!pairAt(i)) continue;
    const a = tokens[i], b = tokens[i + 1];
    const key = `${a.key} ${b.key}`;
    const written = `${a.written} ${b.written}`;
    let f = found.get(key);
    if (!f) found.set(key, f = { count: 0, first: order++, spellings: new Map(), parts: [a.parts!, b.parts!], before: [], after: [] });
    f.count++;
    f.spellings.set(written, (f.spellings.get(written) ?? 0) + 1);
    f.before.push(pairAt(i - 1) ? tokens[i - 1].key : null);
    f.after.push(pairAt(i + 1) ? tokens[i + 2].key : null);
    if (pairAt(i + 1)) {
      const c = tokens[i + 2];
      const threeKey = `${key} ${c.key}`;
      let t = threes.get(threeKey);
      if (!t) threes.set(threeKey, t = { count: 0, spellings: new Map(), left: key, right: `${b.key} ${c.key}`, before: [], after: [] });
      t.count++;
      t.spellings.set(`${written} ${c.written}`, (t.spellings.get(`${written} ${c.written}`) ?? 0) + 1);
      t.before.push(pairAt(i - 1) ? tokens[i - 1].key : null);
      t.after.push(pairAt(i + 2) ? tokens[i + 3].key : null);
    }
  }

  const mostUsed = (spellings: Map<string, number>) => {
    let best = "";
    for (const [s, c] of spellings) if (c > (spellings.get(best) ?? 0)) best = s;
    return best;
  };
  /** The same word on that side at every appearance. */
  const fixed = (side: (string | null)[]) => side.every(x => x !== null && x === side[0]);

  type Out = { key: string; text: string; score: number; first: number };
  const own = new Map<string, Out>();
  for (const [key, f] of found) {
    own.set(key, {
      key, text: mostUsed(f.spellings), first: f.first,
      score: (1 + Math.log(f.count)) * (wordWeight(f.parts[0]) + wordWeight(f.parts[1])),
    });
  }
  const dropped = new Set<string>();
  // The middle of one longer term: the same word on both sides every time ("quality monitoring"
  // in "water quality monitoring system", "failure team" in "heart failure team NLI-HFTP").
  for (const [key, f] of found) if (fixed(f.before) && fixed(f.after)) dropped.add(key);

  const terms: Out[] = [];
  for (const [key, t] of threes) {
    const left = found.get(t.left)!, right = found.get(t.right)!;
    // A term of its own only if, at least once, nothing stands in front of the three and, at
    // least once, nothing after them. Otherwise it is the middle of longer word chains
    // ("water quality monitoring" + system, "plastic pollution harms" between other words):
    // its pairs stay as they are.
    if (!t.before.includes(null) || !t.after.includes(null)) continue;
    // Its pairs that only ever appear inside it; with neither, the two pairs are separate phrases.
    const inside = [t.left, t.right].filter(k => found.get(k)!.count === t.count);
    if (inside.length === 0) continue;
    const text = mostUsed(t.spellings);
    const l = own.get(t.left)!, r = own.get(t.right)!;
    if (t.count >= 2 && acceptable(text)) {
      terms.push({ key, text, score: Math.max(l.score, r.score), first: Math.min(left.first, right.first) });
      inside.forEach(k => dropped.add(k));
    } else {
      // Seen once (or too long): only the stronger pair; on a tie the right-hand one, where
      // an English term ends ("water temperature", not "measure water").
      const weaker = l.score > r.score ? t.right : t.left;
      if (inside.includes(weaker)) dropped.add(weaker);
    }
  }

  const out = new Map<string, Out>();
  const put = (o: Out) => {
    const had = out.get(o.key);
    if (!had || o.score > had.score) out.set(o.key, had ? { ...o, first: Math.min(o.first, had.first) } : o);
  };
  for (const [key, o] of own) if (!dropped.has(key)) put(o);
  terms.forEach(put);
  return [...out.values()].sort((a, b) => b.score - a.score || a.first - b.first)
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

export interface SuggestOptions {
  /** Most suggestions (default KEYWORD_MODEL.maxSuggestions). */
  limit?: number;
  /** Learned keywords only when the model has at least this many training
   *  studies (default KEYWORD_MODEL.reliableFrom; the Statistics card's test uses 0). */
  learnedFrom?: number;
  /** Most learned ones among them (default KEYWORD_MODEL.maxLearned). */
  maxLearned?: number;
  /** Keyword keys never to offer, as if the study had them. */
  exclude?: Iterable<string>;
}

/**
 * Up to `limit` keywords for a study: learned ones first (probability ≥
 * minProbability and evidence ≥ minEvidence, at most `maxLearned`, none
 * below `learnedFrom` training studies), then phrases of its abstract. Never
 * a keyword the study already has, never the same keyword twice (compared by
 * keywordKey), never one the Keywords box would refuse.
 */
export function suggestKeywords(model: KeywordModel, doc: KeywordText, {
  limit = KEYWORD_MODEL.maxSuggestions, learnedFrom = KEYWORD_MODEL.reliableFrom,
  maxLearned = KEYWORD_MODEL.maxLearned, exclude = [],
}: SuggestOptions = {}): KeywordSuggestion[] {
  const taken = new Set([...doc.keywords.map(keywordKey), ...exclude]);
  const out: KeywordSuggestion[] = [];
  const offer = (key: string, text: string, source: KeywordSuggestion["source"], studies: number) => {
    const keyword = acceptable(text);
    if (out.length >= limit || !keyword || !key || taken.has(key)) return false;
    taken.add(key);
    out.push({ key, keyword, source, studies });
    return true;
  };
  if (model.n >= learnedFrom) {
    let learned = 0;
    for (const p of predictKeywords(model, doc)) {
      if (learned >= maxLearned) break;
      if (p.probability >= KEYWORD_MODEL.minProbability && p.evidence >= KEYWORD_MODEL.minEvidence
        && offer(p.key, p.keyword, "learned", p.studies)) learned++;
    }
  }
  for (const p of extractPhrases(model, doc.abstract)) offer(p.key, p.text, "abstract", 0);
  return out;
}

/**
 * How many times a keyword (by its keywordKey) appears in a study's title plus
 * abstract, folded the same way: "fish farmer" and "fish farmers" count
 * together, "nurse-patient interaction" matches "nurse patient interaction".
 * Never across a full stop, comma, bracket or dash, as phrases are read.
 */
export function phraseCount(doc: Pick<Thesis, "title" | "abstract">, key: string): number {
  const want = key.split(" ").filter(Boolean);
  if (want.length === 0) return 0;
  let count = 0;
  for (const text of [doc.title, doc.abstract]) {
    const t = text.normalize("NFC");
    let run: string[] = [];
    let end = -1;
    const scan = () => {
      for (let i = 0; i + want.length <= run.length; i++) if (want.every((w, j) => run[i + j] === w)) count++;
    };
    for (const m of t.matchAll(WORD)) {
      const start = m.index ?? 0;
      if (end >= 0 && !/^\s+$/.test(t.slice(end, start))) { scan(); run = []; }
      run.push(...tokenize(m[0]).map(foldPlural));
      end = start + m[0].length;
    }
    scan();
  }
  return count;
}

/** How many keywords the save step adds by itself to a study that has `has`:
 *  autoMax, but never past autoTotal in all. 0 → 5, 3 → 5, 4 → 4, 7 → 1, 8+ → 0. */
export function autoKeywordRoom(has: number): number {
  return Math.max(0, Math.min(KEYWORD_MODEL.autoMax, KEYWORD_MODEL.autoTotal - has));
}

/**
 * The keywords the Register form adds by itself to a new study (docs/15 §6),
 * once: when the save step opens after a PDF was read, or, with no usable
 * abstract read, when staff leave the abstract box with a typed one (errata
 * #80). Staff only remove keywords, never add them. The best suggestions after
 * the study's own keywords, autoKeywordRoom() of them (fewer only when
 * the suggestions run out), at most autoMaxLearned learned (none below reliableFrom),
 * never one in `removed` (keys staff took off; one removed never comes back
 * by itself), never one that contains, is part of, or has the same words as
 * a listed or added keyword. Order (errata #79): first the learned ones and
 * the phrases seen at least KEYWORD_MODEL.autoMinCount times in the title
 * plus abstract (phraseCount), best first; then, while there is room, the
 * other phrases in their usual order (best score first). The suggestions
 * left over are not shown (errata #80).
 */
export function autoKeywords(model: KeywordModel, doc: KeywordText, removed: Iterable<string> = []): KeywordSuggestion[] {
  const room = autoKeywordRoom(doc.keywords.length);
  if (room === 0) return [];
  // Never one inside another listed or added keyword, or the other way round
  // ("patient interaction" with "nurse-patient interaction"), nor the same
  // words in another order ("quality care" with "care quality"): the better
  // one (earlier in the list) is added, the other is not.
  const listed = doc.keywords.map(keywordKey).filter(Boolean);
  const sameWords = (a: string, b: string) => a.split(" ").sort().join(" ") === b.split(" ").sort().join(" ");
  const overlaps = (a: string, b: string) => ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `) || sameWords(a, b);
  const all = suggestKeywords(model, doc, { limit: Infinity, maxLearned: KEYWORD_MODEL.autoMaxLearned, exclude: removed });
  // A phrase seen once is more often a sentence fragment ("system sends", "set level"),
  // so the ones seen twice (and the learned ones) go first; the once-seen ones only fill the room left.
  const repeated = (s: KeywordSuggestion) => s.source === "learned" || phraseCount(doc, s.key) >= KEYWORD_MODEL.autoMinCount;
  const out: KeywordSuggestion[] = [];
  for (const s of [...all.filter(repeated), ...all.filter(s => !repeated(s))]) {
    if (out.length >= room) break;
    if ([...listed, ...out.map(o => o.key)].some(k => overlaps(k, s.key))) continue;
    out.push(s);
  }
  return out;
}

/**
 * Undo after the × on the Register / Edit save step (errata #80): `keyword`
 * back at `index` (or at the end, if the list got shorter). null when it is
 * listed again already (same keywordKey) or the list holds `max` keywords.
 */
export function reinsertKeyword(list: readonly string[], keyword: string, index: number, max: number): string[] | null {
  const key = keywordKey(keyword);
  if (list.length >= max || list.some(k => keywordKey(k) === key)) return null;
  const at = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), keyword, ...list.slice(at)];
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
export function leaveOneOutFolds(
  studies: KeywordStudy[],
  { hideNearCopies = true, nearCopies }: { hideNearCopies?: boolean; nearCopies?: NearCopies } = {},
): KeywordFold[] {
  const near = hideNearCopies ? nearCopies ?? findNearCopies(studies) : null;
  return studies.filter(s => studyLabels(s.keywords).size > 0).map(test => {
    const copies = [...(near?.get(test.id) ?? [])];
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
 * PDFs registered several times). Each fold's model also counts the
 * near-copies inside its training studies once, as the real model does. The
 * suggestions are the Register form's (learned at most maxLearned of them)
 * but without the reliableFrom rule: the card measures the learned model.
 */
export function evaluateKeywordModel(
  studies: KeywordStudy[],
  { hideNearCopies = true, nearCopies }: { hideNearCopies?: boolean; nearCopies?: NearCopies } = {},
): KeywordEvaluation {
  const near = nearCopies ?? findNearCopies(studies);
  const folds = leaveOneOutFolds(studies, { hideNearCopies, nearCopies: near });
  const sum = { model: { hits: 0, correct: 0, shown: 0, recall: 0 }, baseline: { hits: 0, correct: 0, shown: 0, recall: 0 } };
  for (const { test: s, training } of folds) {
    const truth = new Set(studyLabels(s.keywords).keys());
    const model = trainKeywordModel(training, { nearCopies: near });
    const shownByModel = suggestKeywords(model, { title: s.title, abstract: s.abstract, keywords: [] }, { learnedFrom: 0 }).map(x => x.key);
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
