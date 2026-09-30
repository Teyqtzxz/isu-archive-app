// Pure search: no React, no firebase. Move this file, do not rewrite it.
import type { Thesis } from "./types";

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
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

export function docTextOf(t: Thesis): string {
  return `${t.title} ${t.abstract} ${t.keywords.join(" ")}`;
}

/** Pre-tokenised corpus. Built once per result set, not once per keystroke. */

export interface SearchIndex {
  docTokens: string[][];
  avgDocLen: number;
  vocab: string[];
  postings: Map<string, number[]>;
}

export function buildIndex(theses: Thesis[]): SearchIndex {
  const docTokens = theses.map(t => tokenize(docTextOf(t)));
  const totalLen = docTokens.reduce((n, ts) => n + ts.length, 0);
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
    // Guard: an empty corpus must not produce NaN and poison every score.
    avgDocLen: docTokens.length > 0 ? totalLen / docTokens.length : 1,
    vocab: Array.from(postings.keys()),
    postings,
  };
}

/** Document frequency per query term, computed once per query. */

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
    df.set(term, seen.size);
  }
  return df;
}

/** Which field produced the match, for the "Why this rank?" breakdown. */

export function bestFieldFor(t: Thesis, queryTerm: string): string {
  if (tokenize(t.title).some(x => findMatchScore(queryTerm, x) > 0)) return "title";
  if (tokenize(t.keywords.join(" ")).some(x => findMatchScore(queryTerm, x) > 0)) return "keyword";
  return "abstract";
}

export function bm25Score(query: string, thesis: Thesis, docIndex: number, index: SearchIndex, df: Map<string, number>): { score: number; termScores: { term: string; score: number; field: string }[] } {
  const k1 = 1.5, b = 0.75;
  const N = index.docTokens.length;
  const docTokens = index.docTokens[docIndex];
  const docLen = docTokens.length;
  const termScores: { term: string; score: number; field: string }[] = [];
  let total = 0;
  for (const queryTerm of tokenize(query)) {
    const dfCount = df.get(queryTerm) ?? 0;
    if (dfCount === 0) continue;

    // Weighted term frequency: exact hits count 1.0, prefix 0.8, substring 0.6.
    let bestTf = 0;
    for (const dt of docTokens) {
      const m = findMatchScore(queryTerm, dt);
      if (m > 0) bestTf += m;
    }
    if (bestTf === 0) continue;

    const idf = Math.log((N - dfCount + 0.5) / (dfCount + 0.5) + 1);
    const tfNorm = (bestTf * (k1 + 1)) / (bestTf + k1 * (1 - b + b * (docLen / index.avgDocLen)));
    const s = idf * tfNorm;
    termScores.push({ term: queryTerm, score: s, field: bestFieldFor(thesis, queryTerm) });
    total += s;
  }
  return { score: total, termScores };
}
