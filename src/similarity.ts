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
    const overall = cosine(vOverall, index.overall.vectors[i]);
    const abstract = cosine(vAbstract, index.abstract.vectors[i]);
    const overallPercent = similarityPercent(overall.score);
    const abstractPercent = similarityPercent(abstract.score);
    const byAbstract = abstractPercent > overallPercent;
    const percent = byAbstract ? abstractPercent : overallPercent;
    const level = similarityLevel(percent);
    if (!level) return;
    matches.push({
      id, percent, basis: byAbstract ? "abstract" : "overall", overallPercent, abstractPercent,
      sharedTerms: (byAbstract ? abstract : overall).sharedTerms, level,
    });
  });
  return matches.sort((a, b) => b.percent - a.percent).slice(0, limit);
}

/** The short reason under a match: "Abstract 100% similar" or "91% similar overall". */
export function originalityReason(m: Pick<OriginalityMatch, "percent" | "basis">): string {
  return m.basis === "abstract" ? `Abstract ${m.percent}% similar` : `${m.percent}% similar overall`;
}
