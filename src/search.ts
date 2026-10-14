// Pure search: no React, no firebase. Examples in search.check.ts
// (node src/search.check.ts).
//
// Ranking is BM25F (Zaragoza, Craswell, Taylor, Saria & Robertson, 2004): each
// field's term count is weighted and length-normalised on its own, the fields
// are added up, and BM25's saturation is applied once to the sum (docs/05 §3).
import type { Thesis } from "./types";

/** Lowercased words. Letters are Unicode letters (\p{L}, plus combining marks
 *  \p{M}), so "niño" and "Peñablanca" stay whole; digits and "_" are kept as
 *  before. NFC makes an "é" copied from a PDF as e + accent match a typed "é". */
export function tokenize(text: string): string[] {
  return text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\d_\s]/gu, " ").split(/\s+/).filter(Boolean);
}

export function findMatchScore(queryTerm: string, docToken: string): number {
  if (queryTerm.length < 2) return 0;
  if (docToken === queryTerm) return 1;
  if (docToken.startsWith(queryTerm)) return 0.8;
  // A mid-token match is only trustworthy for longer terms. Without this guard
  // a 2–3 letter term matches inside almost every word — "ion" hits all 21 seed
  // theses, "dr" hits "hydrological" — and a thesis stuffed with those words
  // outranks the one that actually contains the term. Terms of 4+ letters still
  // match mid-word on purpose: "rate" finds "demonstrated" (docs/05 §3).
  if (queryTerm.length >= 4 && docToken.includes(queryTerm)) return 0.6;
  return 0;
}

/** The fields search reads. A Thesis is one; summary.ts scores single
 *  sentences through textOnly(), which leaves the people and the year empty. */
export type SearchDoc = Pick<Thesis, "title" | "abstract" | "keywords" | "authors" | "adviser"> & { year: number | null };

/** A document holding `text` as its abstract and nothing else: no title,
 *  keywords, authors, adviser or year. The summary scores each sentence with
 *  this, so a sentence never "matches" an author's name or the study's year. */
export function textOnly(text: string): SearchDoc {
  return { title: "", abstract: text, keywords: [], authors: [], adviser: "", year: null };
}

export type Field = "title" | "keywords" | "authors" | "adviser" | "abstract";
export const FIELDS: readonly Field[] = ["title", "keywords", "authors", "adviser", "abstract"];

/** How much one matching word in each field counts. The title is the author's
 *  own one-line summary, so one hit there says more than one hit in a long
 *  abstract; keywords are topic labels picked by staff; a name typed in the
 *  search box means the person is wanted. docs/05 §3 has the reasoning. */
export const FIELD_WEIGHTS: Readonly<Record<Field, number>> = { title: 3, keywords: 2, authors: 2, adviser: 2, abstract: 1 };

/** Length normalisation per field (BM25's b). 0 for the short fields, where
 *  length is not wordiness: a 5-word title is no less about "sample" than a
 *  2-word one. 0.75, BM25's usual value, for the abstract and keyword list. */
export const FIELD_B: Readonly<Record<Field, number>> = { title: 0, keywords: 0.75, authors: 0, adviser: 0, abstract: 0.75 };

/** A 4-digit query word equal to the study's Academic Year counts like a
 *  title hit. Exact only: "20" or "202" never match the year. */
export const YEAR_WEIGHT = 3;

/** True for a query word that can match the year field: exactly 4 digits. */
export function isYearTerm(term: string): boolean {
  return /^\d{4}$/.test(term);
}

/** Titles and degrees, left out of the author and adviser fields: otherwise
 *  "Dr. Santos" would match every "Dr." adviser (the old `dr` bug, docs/05 §3).
 *  The same titles and degrees validation.ts accepts, lowercased. */
const NAME_TITLES = new Set([
  "dr", "dra", "drs", "engr", "prof", "asst", "assoc", "mr", "mrs", "ms", "atty",
  "phd", "edd", "msc", "ma", "mit", "mba", "rn", "pe", "ce",
]);

/** True for a title or degree word ("Dr", "engr", "PhD"), any case: not
 *  searched, so the result card does not highlight it either. */
export function isNameTitle(word: string): boolean {
  return NAME_TITLES.has(word.normalize("NFC").toLowerCase());
}

function nameTokens(name: string): string[] {
  return tokenize(name).filter(t => !NAME_TITLES.has(t));
}

function fieldTokensOf(t: SearchDoc): Record<Field, string[]> {
  return {
    title: tokenize(t.title),
    keywords: tokenize(t.keywords.join(" ")),
    authors: t.authors.flatMap(nameTokens),
    adviser: nameTokens(t.adviser),
    abstract: tokenize(t.abstract),
  };
}

/** Every searchable word of a study as one string: title, abstract, keywords,
 *  authors and adviser (not the year, which is matched as a number). */
export function docTextOf(t: SearchDoc): string {
  return `${t.title} ${t.abstract} ${t.keywords.join(" ")} ${t.authors.join(" ")} ${t.adviser}`;
}

/** Pre-tokenised corpus. Built once per result set, not once per keystroke. */

export interface SearchIndex {
  /** Each document's words over every field — the summary's TF-IDF reads these. */
  docTokens: string[][];
  avgDocLen: number;
  fieldTokens: Record<Field, string[][]>;
  avgFieldLen: Record<Field, number>;
  years: (number | null)[];
  vocab: string[];
  postings: Map<string, number[]>;
}

export function buildIndex(theses: SearchDoc[]): SearchIndex {
  const perDoc = theses.map(fieldTokensOf);
  const docTokens = perDoc.map(f => FIELDS.flatMap(name => f[name]));
  const fieldTokens = {} as Record<Field, string[][]>;
  const avgFieldLen = {} as Record<Field, number>;
  for (const name of FIELDS) {
    fieldTokens[name] = perDoc.map(f => f[name]);
    avgFieldLen[name] = averageLength(fieldTokens[name]);
  }
  const postings = new Map<string, number[]>();
  docTokens.forEach((ts, i) => {
    for (const tok of new Set(ts)) {
      const list = postings.get(tok);
      if (list) list.push(i);
      else postings.set(tok, [i]);
    }
  });
  return {
    docTokens,
    avgDocLen: averageLength(docTokens),
    fieldTokens,
    avgFieldLen,
    years: theses.map(t => t.year),
    vocab: Array.from(postings.keys()),
    postings,
  };
}

/** Guard: an empty corpus — or a field nobody filled in — must not produce
 *  NaN (0 / 0) and poison every score. Falls back to 1. */
function averageLength(lists: string[][]): number {
  const total = lists.reduce((n, ts) => n + ts.length, 0);
  return total > 0 ? total / lists.length : 1;
}

/** Document frequency per query term, computed once per query: the studies
 *  with a matching word in any field, plus — for a 4-digit term — the studies
 *  whose Academic Year is that year, so a year query gets a sensible idf. */

export function computeDocFreq(tokens: string[], index: SearchIndex): Map<string, number> {
  const df = new Map<string, number>();
  for (const term of tokens) {
    if (df.has(term)) continue;
    const seen = new Set<number>();
    for (const v of index.vocab) {
      if (findMatchScore(term, v) > 0) {
        for (const i of index.postings.get(v)!) seen.add(i);
      }
    }
    if (isYearTerm(term)) {
      index.years.forEach((y, i) => { if (y === Number(term)) seen.add(i); });
    }
    df.set(term, seen.size);
  }
  return df;
}

/** Which field produced the match (kept for the removed "Why this rank?" panel):
 *  title, year, keyword, author, adviser, else abstract. Reads the prebuilt
 *  index — bm25Score calls this per term per study on every search, so it
 *  must never tokenise anything. */

export function bestFieldFor(index: SearchIndex, docIndex: number, queryTerm: string): string {
  const hits = (field: Field) => index.fieldTokens[field][docIndex].some(x => findMatchScore(queryTerm, x) > 0);
  if (hits("title")) return "title";
  if (isYearTerm(queryTerm) && index.years[docIndex] === Number(queryTerm)) return "year";
  if (hits("keywords")) return "keyword";
  if (hits("authors")) return "author";
  if (hits("adviser")) return "adviser";
  return "abstract";
}

/** `_thesis` is not read — scoring uses only the prebuilt index — but stays in
 *  the signature (query, thesis, docIndex, index, df) that callers use (docs/00). */
export function bm25Score(query: string, _thesis: SearchDoc, docIndex: number, index: SearchIndex, df: Map<string, number>): { score: number; termScores: { term: string; score: number; field: string }[] } {
  const k1 = 1.5;
  const N = index.docTokens.length;
  const termScores: { term: string; score: number; field: string }[] = [];
  let total = 0;
  for (const queryTerm of tokenize(query)) {
    const dfCount = df.get(queryTerm) ?? 0;
    if (dfCount === 0) continue;

    // BM25F: per field, the weighted term frequency (exact hits count 1.0,
    // prefix 0.8, substring 0.6) times the field weight, divided by that
    // field's length normalisation; then added up over the fields.
    let tf = 0;
    for (const name of FIELDS) {
      const tokens = index.fieldTokens[name][docIndex];
      let fieldTf = 0;
      for (const dt of tokens) fieldTf += findMatchScore(queryTerm, dt);
      if (fieldTf === 0) continue;
      const b = FIELD_B[name];
      tf += (FIELD_WEIGHTS[name] * fieldTf) / (1 - b + b * (tokens.length / index.avgFieldLen[name]));
    }
    if (isYearTerm(queryTerm) && index.years[docIndex] === Number(queryTerm)) tf += YEAR_WEIGHT;
    if (tf === 0) continue;

    const idf = Math.log((N - dfCount + 0.5) / (dfCount + 0.5) + 1);
    const s = idf * (tf * (k1 + 1)) / (tf + k1);
    termScores.push({ term: queryTerm, score: s, field: bestFieldFor(index, docIndex, queryTerm) });
    total += s;
  }
  return { score: total, termScores };
}

/** Relevance badge: the top result shows 97%, never 100% — a search engine
 *  cannot claim a perfect match (docs/05 §4). The 0.01 floor stops a division
 *  by zero when nothing matched. `maxScore` is the top result's score. */
export function relevancePercent(score: number, maxScore: number): number {
  return Math.round((score / Math.max(maxScore, 0.01)) * 93) + 4;
}
