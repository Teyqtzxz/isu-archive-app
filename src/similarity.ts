// Pure document similarity: no React, no firebase. Examples in
// similarity.check.ts (node src/similarity.check.ts). The method, a worked
// example and the thresholds are explained in docs/14-similarity.md.
//
// Each study becomes a TF-IDF vector over its title, keywords and abstract;
// two studies are compared by the cosine of the angle between their vectors.
// Used for the originality check on Register / Edit study and for "Similar
// studies" in Study Details. Search ranking (search.ts) is not affected.
import { tokenize } from "./search.ts";
import type { Thesis } from "./types";

/** The fields similarity reads. A draft on the Register form has no id yet. */
export type SimilarityText = Pick<Thesis, "title" | "abstract" | "keywords">;
export type SimilarityDoc = SimilarityText & Pick<Thesis, "id">;

/** One word in the title counts 3 times, in the keywords 2, in the abstract
 *  once: the same field weights as search (FIELD_WEIGHTS in search.ts). */
export const SIMILARITY_WEIGHTS = { title: 3, keywords: 2, abstract: 1 } as const;

/** Percent cut-offs (docs/14 §4). Decided on the real e-library: copies of one
 *  PDF scored 86–100%, a copied abstract 88%, half a copied abstract 59–65%,
 *  different studies 10% or less. */
export const THRESHOLDS = {
  /** "Possible duplicate": staff must tick "I checked — register anyway". */
  duplicate: 80,
  /** "Very similar study found" (warning). */
  verySimilar: 50,
  /** "Related studies" (information). Below this the check shows nothing. */
  related: 30,
  /** "Similar studies" in Study Details. */
  similarStudies: 15,
} as const;

/** Most matches listed by the originality check and by Study Details. */
export const MAX_MATCHES = 3;
/** Most shared key terms shown per match. */
export const MAX_SHARED_TERMS = 5;

/** Very common words left out of the vectors. idf already gives them almost no
 *  weight (a word in every study gets none), but without this list "is", "we"
 *  and "an" would show up as shared key terms. "study" and "research" are in
 *  every abstract here, so they say nothing about the topic either. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "can", "could", "did", "do", "does",
  "for", "from", "had", "has", "have", "he", "she", "her", "his", "him", "how", "i", "if", "in", "into", "is",
  "it", "its", "may", "more", "most", "no", "not", "of", "on", "or", "so", "such", "than", "that", "the",
  "then", "there", "these", "this", "those", "to", "was", "were", "what", "when", "where", "which", "while",
  "who", "will", "with", "would", "also", "using", "used", "use", "among", "based", "between", "both", "each",
  "other", "over", "through", "under", "upon", "within", "without", "about", "after", "all", "any", "one",
  "two", "three", "study", "research",
  // Pronouns and determiners: "my" (from "my.Eskwela") showed up as a shared key term.
  "my", "our", "your", "their", "us", "we", "they", "them", "you", "me",
]);

/** Plural folding, so "students" and "student" count as one word, "studies"
 *  is "study" and "switches" is "switch". Short words and words ending in
 *  -ss, -us, -is ("process", "campus", "analysis") are left alone. Also used
 *  by keywordModel.ts, so "Rice" / "rices" are one keyword. */
export function foldPlural(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && /(ch|sh|x|z|ss)es$/.test(word)) return word.slice(0, -2);
  return word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word;
}

/** The words of `text` that similarity counts: tokenize() from search.ts (so
 *  case, punctuation and accents are handled the same way), plurals folded,
 *  minus one-letter words, plain numbers and STOP_WORDS (after folding, so
 *  "studies" is dropped like "study"). */
export function similarityTerms(text: string): string[] {
  return tokenize(text).map(foldPlural).filter(isCountedTerm);
}

/** A folded word that counts: not one letter, not a plain number, not in STOP_WORDS. */
export function isCountedTerm(t: string): boolean {
  return t.length > 1 && !/^\d+$/.test(t) && !STOP_WORDS.has(t);
}

/** Weighted count of each word: 3 × in the title + 2 × in the keywords + 1 × in the abstract. */
export function termCounts(doc: SimilarityText): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const t of similarityTerms(text)) counts.set(t, (counts.get(t) ?? 0) + weight);
  };
  add(doc.title, SIMILARITY_WEIGHTS.title);
  add(doc.keywords.join(" "), SIMILARITY_WEIGHTS.keywords);
  add(doc.abstract, SIMILARITY_WEIGHTS.abstract);
  return counts;
}

export interface TermVector {
  /** TF-IDF weight per word; words with weight 0 are left out. */
  weights: Map<string, number>;
  /** Length of the vector (√ of the sum of squared weights); 0 for an empty one. */
  norm: number;
}

/** The corpus: document frequencies and one vector per study. Build once per
 *  data change (useMemo on the studies), never per keystroke. */
export interface SimilarityIndex {
  /** Number of studies. */
  n: number;
  /** Studies containing each word. */
  df: Map<string, number>;
  ids: string[];
  vectors: TermVector[];
}

/** idf = ln((1 + N) / (1 + df)). A word in every study gets 0 (it cannot tell
 *  studies apart); a word in no stored study (only in a draft) gets the most. */
export function idf(index: Pick<SimilarityIndex, "n" | "df">, term: string): number {
  return Math.log((1 + index.n) / (1 + (index.df.get(term) ?? 0)));
}

/** TF-IDF vector of a study or a draft, measured against the corpus idf.
 *  tf is dampened (1 + ln count) so a word repeated 20 times does not swamp
 *  the rest. */
export function vectorOf(doc: SimilarityText, index: Pick<SimilarityIndex, "n" | "df">): TermVector {
  const weights = new Map<string, number>();
  let sumSq = 0;
  for (const [term, count] of termCounts(doc)) {
    const w = (1 + Math.log(count)) * idf(index, term);
    if (w <= 0) continue;
    weights.set(term, w);
    sumSq += w * w;
  }
  return { weights, norm: Math.sqrt(sumSq) };
}

export function buildSimilarityIndex(docs: SimilarityDoc[]): SimilarityIndex {
  const counts = docs.map(termCounts);
  const df = new Map<string, number>();
  for (const c of counts) for (const term of c.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const base = { n: docs.length, df };
  return { ...base, ids: docs.map(d => d.id), vectors: docs.map(d => vectorOf(d, base)) };
}

/** Cosine similarity, 0–1, and the words that add the most to it, biggest
 *  first. An empty vector (no countable words) is similar to nothing: 0,
 *  never a division by zero. */
export function cosine(a: TermVector, b: TermVector): { score: number; sharedTerms: string[] } {
  if (a.norm === 0 || b.norm === 0) return { score: 0, sharedTerms: [] };
  let dot = 0;
  const parts: [string, number][] = [];
  for (const [term, wa] of a.weights) {
    const wb = b.weights.get(term);
    if (wb === undefined) continue;
    dot += wa * wb;
    parts.push([term, wa * wb]);
  }
  parts.sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  // Rounding can put an identical pair a hair above 1.
  return { score: Math.min(1, dot / (a.norm * b.norm)), sharedTerms: parts.slice(0, MAX_SHARED_TERMS).map(p => p[0]) };
}

/** 0–1 → whole percent, as shown on screen. */
export function similarityPercent(score: number): number {
  return Math.round(score * 100);
}

export interface SimilarMatch {
  id: string;
  percent: number;
  sharedTerms: string[];
}

/**
 * The stored studies most similar to `doc`, best first: at least `min` percent,
 * at most `limit`. `excludeId` is the study itself (Study Details, Edit study),
 * which must never match itself. Equal percents keep the corpus order.
 */
export function similarStudies(
  index: SimilarityIndex,
  doc: SimilarityText,
  { excludeId, min = 0, limit = MAX_MATCHES }: { excludeId?: string; min?: number; limit?: number } = {},
): SimilarMatch[] {
  const v = vectorOf(doc, index);
  const matches: SimilarMatch[] = [];
  index.ids.forEach((id, i) => {
    if (id === excludeId) return;
    const { score, sharedTerms } = cosine(v, index.vectors[i]);
    const percent = similarityPercent(score);
    if (percent > 0 && percent >= min) matches.push({ id, percent, sharedTerms });
  });
  return matches.sort((a, b) => b.percent - a.percent).slice(0, limit);
}

export type SimilarityLevel = "duplicate" | "very-similar" | "related";

/** Which originality message a percent gets; null below THRESHOLDS.related. */
export function similarityLevel(percent: number): SimilarityLevel | null {
  if (percent >= THRESHOLDS.duplicate) return "duplicate";
  if (percent >= THRESHOLDS.verySimilar) return "very-similar";
  if (percent >= THRESHOLDS.related) return "related";
  return null;
}

// ─── Originality check (Register / Edit study) ──────────────────────────────
// The overall score weighs the title ×3 and keywords ×2, so an abstract copied
// word for word under a new title and no keywords scored only 69–76% on the
// real e-library: "Very similar", no checkbox. The check therefore also
// compares the abstracts alone (same TF-IDF method, idf over abstracts only)
// and uses whichever score is higher.

/** Both indexes the originality check reads. Build once per data change. */
export interface OriginalityIndex {
  overall: SimilarityIndex;
  /** The same studies with only their abstract: no title, no keywords. */
  abstract: SimilarityIndex;
}

const abstractOnly = (doc: SimilarityText): SimilarityText => ({ title: "", keywords: [], abstract: doc.abstract });

export function buildOriginalityIndex(docs: SimilarityDoc[]): OriginalityIndex {
  return {
    overall: buildSimilarityIndex(docs),
    abstract: buildSimilarityIndex(docs.map(d => ({ id: d.id, ...abstractOnly(d) }))),
  };
}

export interface OriginalityMatch {
  id: string;
  /** The score shown: the higher of the two. */
  percent: number;
  /** Which score `percent` is: "abstract" only when the abstract-only score
   *  is strictly higher ("Abstract 100% similar"), else "overall" ("91%
   *  similar overall"). An exact copy is 100% both ways and reads "overall". */
  basis: "overall" | "abstract";
  overallPercent: number;
  abstractPercent: number;
  /** Shared key terms of the score shown. */
  sharedTerms: string[];
  level: SimilarityLevel;
}

/**
 * The originality check: every stored study except `excludeId` (Edit study),
 * scored overall and by abstract alone; the level comes from the higher score,
 * so a copied abstract is a "Possible duplicate" whatever the title. Best
 * first, at least THRESHOLDS.related, at most `limit`.
 */
export function originalityCheck(
  index: OriginalityIndex,
  draft: SimilarityText,
  { excludeId, limit = MAX_MATCHES }: { excludeId?: string; limit?: number } = {},
): OriginalityMatch[] {
  const vOverall = vectorOf(draft, index.overall);
  const vAbstract = vectorOf(abstractOnly(draft), index.abstract);
  const matches: OriginalityMatch[] = [];
  index.overall.ids.forEach((id, i) => {
    if (id === excludeId) return;
    const m = originalityMatch(index, vOverall, vAbstract, i);
    if (m) matches.push(m);
  });
  return matches.sort((a, b) => b.percent - a.percent).slice(0, limit);
}

/** The draft's two vectors against stored study `i`: its match, or null below
 *  THRESHOLDS.related. The one scoring rule of originalityCheck and
 *  possibleDuplicates, so the two can never disagree. */
function originalityMatch(index: OriginalityIndex, vOverall: TermVector, vAbstract: TermVector, i: number): OriginalityMatch | null {
  const overall = cosine(vOverall, index.overall.vectors[i]);
  const abstract = cosine(vAbstract, index.abstract.vectors[i]);
  const overallPercent = similarityPercent(overall.score);
  const abstractPercent = similarityPercent(abstract.score);
  const byAbstract = abstractPercent > overallPercent;
  const percent = byAbstract ? abstractPercent : overallPercent;
  const level = similarityLevel(percent);
  if (!level) return null;
  return {
    id: index.overall.ids[i], percent, basis: byAbstract ? "abstract" : "overall", overallPercent, abstractPercent,
    sharedTerms: (byAbstract ? abstract : overall).sharedTerms, level,
  };
}

/** A score at or above this rounds to THRESHOLDS.duplicate percent (79.5 → 80),
 *  less a margin far above any rounding in the sums. Only used to skip pairs
 *  that cannot reach it; the level itself always comes from originalityMatch. */
const DUPLICATE_FLOOR = (THRESHOLDS.duplicate - 0.5) / 100 - 1e-6;

/** A vector as unit weights over word numbers (looking words up by their
 *  text was most of the time). `strong`: its strongest words, until the rest
 *  together could no longer reach DUPLICATE_FLOOR; on a tie at the cut every
 *  word of that weight, which can only add candidates. */
interface PackedVector { terms: Int32Array; weights: Float64Array; strong: number[] }

function packVectors(vectors: TermVector[], termNumber: (term: string) => number): PackedVector[] {
  return vectors.map(v => {
    const terms = new Int32Array(v.weights.size);
    const weights = new Float64Array(v.weights.size);
    if (v.norm === 0) return { terms, weights, strong: [] };
    let k = 0;
    for (const [t, w] of v.weights) {
      terms[k] = termNumber(t);
      weights[k++] = w / v.norm;
    }
    const sorted = weights.slice().sort();
    let rest = 1, cut = Infinity;
    for (let at = sorted.length - 1; at >= 0 && Math.sqrt(Math.max(0, rest)) >= DUPLICATE_FLOOR; at--) {
      cut = sorted[at];
      rest -= cut * cut;
    }
    const strong: number[] = [];
    for (let at = 0; at < terms.length; at++) if (weights[at] >= cut) strong.push(terms[at]);
    return { terms, weights, strong };
  });
}

/**
 * For every stored study (by index), the ids of the others that the
 * originality check calls a "Possible duplicate" of it: exactly what
 * originalityCheck(index, study, { excludeId: study.id, limit: Infinity })
 * filtered to "duplicate" gives, best first, but without scoring every pair
 * (that took 19 s at 1,000 studies). Why it is the same answer: with x and y
 * unit vectors and x split into its strong words P and the rest R,
 *   cos(x, y) = Σ over P + Σ over R ≤ Σ over P + |R| · |y| = Σ over P + |R|,
 * and |R| < DUPLICATE_FLOOR by the choice of P, so in an index where a pair
 * reaches the duplicate level y has one of x's strong words, and x one of
 * y's (weights are never negative). Only those pairs are scored, once each,
 * quickly first; the ones that can reach 79.5% are scored by
 * originalityMatch both ways, in both the overall and the abstract-only
 * index, exactly as originalityCheck does. docs/14 §1f.
 */
export function possibleDuplicates(index: OriginalityIndex): string[][] {
  const n = index.overall.ids.length;
  const numbers = new Map<string, number>();
  const termNumber = (t: string) => {
    let k = numbers.get(t);
    if (k === undefined) numbers.set(t, k = numbers.size);
    return k;
  };
  const parts = [index.overall, index.abstract].map(part => packVectors(part.vectors, termNumber));
  /** For each word number, the studies having it, per index. */
  const withWord = parts.map(packed => {
    const lists: number[][] = Array.from({ length: numbers.size }, () => []);
    packed.forEach((v, j) => { for (const t of v.terms) lists[t].push(j); });
    return lists;
  });
  /** Study i's unit weights by word number, while i is being compared. */
  const dense = new Float64Array(numbers.size);
  /** checked[p][j] === i + 1: the pair i, j was already looked at in index p;
   *  scored[j] === i + 1: it was already scored. */
  const checked = parts.map(() => new Int32Array(n));
  const scored = new Int32Array(n);
  const found: { j: number; m: OriginalityMatch }[][] = Array.from({ length: n }, () => []);
  const keep = (i: number, j: number) => {
    const m = originalityMatch(index, index.overall.vectors[i], index.abstract.vectors[i], j);
    if (m?.level === "duplicate") found[i].push({ j, m });
  };
  for (let i = 0; i < n; i++) {
    parts.forEach((packed, p) => {
      const x = packed[i];
      for (let k = 0; k < x.terms.length; k++) dense[x.terms[k]] = x.weights[k];
      for (const t of x.strong) {
        for (const j of withWord[p][t]) {
          if (j <= i || checked[p][j] === i + 1 || scored[j] === i + 1) continue;
          checked[p][j] = i + 1;
          const y = packed[j];
          if (!y.strong.some(s => dense[s] > 0)) continue;
          let dot = 0;
          for (let k = 0; k < y.terms.length; k++) dot += dense[y.terms[k]] * y.weights[k];
          if (dot < DUPLICATE_FLOOR) continue;
          scored[j] = i + 1;
          if (index.overall.ids[j] === index.overall.ids[i]) continue;
          keep(i, j);
          keep(j, i);
        }
      }
      for (const t of x.terms) dense[t] = 0;
    });
  }
  // Best first; equal percents in corpus order, as originalityCheck's stable sort leaves them.
  return found.map(list => list.sort((a, b) => b.m.percent - a.m.percent || a.j - b.j).map(x => x.m.id));
}

/** The short reason under a match: "Abstract 100% similar" or "91% similar overall". */
export function originalityReason(m: Pick<OriginalityMatch, "percent" | "basis">): string {
  return m.basis === "abstract" ? `Abstract ${m.percent}% similar` : `${m.percent}% similar overall`;
}
