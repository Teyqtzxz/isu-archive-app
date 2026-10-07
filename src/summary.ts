// Pure extractive summary: no React, no firebase, no network. It picks real
// sentences out of the abstracts already in memory; it never writes new prose.
//
// Method: Maximal Marginal Relevance (Carbonell & Goldstein, 1998). Each
// sentence's relevance is its BM25 score against the query (the same engine
// as search.ts) plus how central it is to the ticked theses as a group
// (LexRank-style, Erkan & Radev, 2004). Sentences are then picked one at a
// time, each penalised for repeating what was already picked.
import { bm25Score, buildIndex, computeDocFreq, tokenize } from "./search";
import type { Thesis } from "./types";

export interface SummarySentence {
  text: string;
  sourceIndex: number; // the thesis's visible rank = the [n] on its result card
}

/** A ticked result and the rank it was shown at. SearchScreen builds these —
 *  the rank is `index in results + 1`, NOT the position among ticked rows. */
export interface RankedThesis {
  thesis: Thesis;
  rank: number;
}

/* Splitting on every ". " shreds real thesis prose: "Dr. Maria Santos" becomes
   "Maria Santos", "Fig. 3" becomes "3". Thesis abstracts are full of adviser
   names, figure references and "et al.", so protect those periods first. */
const ABBREVIATION = new RegExp(
  String.raw`\b(?:Drs|Dr|Prof|Engr|Archd|Mr|Mrs|Ms|Mx|St|Sr|Jr|Fig|Figs|Eq|Eqs` +
    String.raw`|No|Nos|Vol|Ch|pp|ed|eds|al|i\.e|e\.g|vs|cf|approx|Inc|Ltd|Co|Dept|Univ)\.`,
  "gi",
);
/* Middle initials, as in "Maria L. Santos" or "Prof. J. Cruz". Case-sensitive on
   purpose: a lone capital before a period is almost always an initial. The cost is
   that a sentence ending in one ("…as Vitamin A. The…") is not split there. */
const INITIAL = /\b[A-Z]\.(?= [A-Z])/g;
const DOT = "\u0001"; // sentinel, cannot occur in extracted PDF text

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .replace(ABBREVIATION, (m) => m.slice(0, -1) + DOT) // "Dr." → "Dr<DOT>"
    .replace(INITIAL, (m) => m[0] + DOT) // "J." → "J<DOT>"
    .split(/(?<=[.!?])\s+(?=[A-Z(“"'])/)
    .map((s) => s.split(DOT).join(".").trim()) // restore the protected periods
    .filter((s) => s.length > 20); // drop fragments too short to be useful
}

/* How much MMR favours relevance over novelty. 0.7 is the usual starting value
   in the literature: mostly relevance, with enough penalty to stop repeats. */
const LAMBDA = 0.7;
/* Cosine similarity at or above this counts as the same sentence (e.g. two
   records with a copied abstract) and is never picked twice. */
const NEAR_DUPLICATE = 0.8;

interface Candidate extends SummarySentence {
  position: number; // sentence number inside its abstract, for the final order
  relevance: number;
  vecIndex: number; // which TF-IDF vector belongs to this sentence
}

/** TF-IDF vector per sentence, scaled to length 1 so a dot product is the cosine. */
function tfidfVectors(docTokens: string[][], postings: Map<string, number[]>): Map<string, number>[] {
  const N = docTokens.length;
  return docTokens.map((tokens) => {
    const vec = new Map<string, number>();
    for (const t of tokens) vec.set(t, (vec.get(t) ?? 0) + 1);
    let norm = 0;
    for (const [t, tf] of vec) {
      // A word in every sentence ("the", "of") gets idf 0 and drops out, so no stopword list is needed.
      const w = tf * Math.log(N / postings.get(t)!.length);
      vec.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm);
    for (const [t, w] of vec) vec.set(t, norm > 0 ? w / norm : 0);
    return vec;
  });
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small) dot += w * (large.get(t) ?? 0);
  return dot;
}

/** One sentence per ticked thesis: the summary is as long as the selection,
 *  and no thesis is quoted twice. A thesis with no usable sentence (none
 *  matches the query, or its only match nearly copies one already chosen) is
 *  left out rather than another thesis being quoted again. Order of `results`
 *  does not matter; output is put back into rank order at the end. */
export function summarise(results: RankedThesis[], query: string): SummarySentence[] {
  const top = [...results].sort((a, b) => a.rank - b.rank);

  const sentences: { text: string; sourceIndex: number; position: number; thesis: Thesis }[] = [];
  for (const { thesis, rank } of top) {
    splitSentences(thesis.abstract).forEach((text, position) => {
      sentences.push({ text, sourceIndex: rank, position, thesis });
    });
  }
  if (sentences.length === 0) return [];

  // Each sentence becomes a tiny "document" so the real BM25 from search.ts can
  // score it. BM25's length normalisation also handles over-long sentences.
  const asDocs = sentences.map((s) => ({ ...s.thesis, title: "", keywords: [], abstract: s.text }));
  const index = buildIndex(asDocs);
  const terms = tokenize(query);
  const df = computeDocFreq(terms, index);
  const bm25 = asDocs.map((d, i) => (terms.length > 0 ? bm25Score(query, d, i, index, df).score : 0));

  // Centrality: average similarity to the sentences of the OTHER ticked theses,
  // i.e. how much this sentence says what the rest of the selection also says.
  // With a single thesis there are no others, so compare within its abstract.
  const vecs = tfidfVectors(index.docTokens, index.postings);
  const multiSource = new Set(sentences.map((s) => s.sourceIndex)).size > 1;
  const centrality = sentences.map((s, i) => {
    let sum = 0;
    let n = 0;
    sentences.forEach((o, j) => {
      if (j === i || (multiSource && o.sourceIndex === s.sourceIndex)) return;
      sum += cosine(vecs[i], vecs[j]);
      n++;
    });
    return n > 0 ? sum / n : 0;
  });

  // Relevance in 0..1. With a query: BM25 and centrality weighted equally, and
  // only sentences that match the query are eligible. With no query, or no
  // match anywhere: centrality alone, which is a generic summary of the group.
  const maxBm25 = Math.max(...bm25);
  const maxCentrality = Math.max(...centrality) || 1;
  const queryMatched = maxBm25 > 0;
  const candidates: Candidate[] = [];
  sentences.forEach((s, i) => {
    if (queryMatched && bm25[i] === 0) return;
    candidates.push({
      text: s.text,
      sourceIndex: s.sourceIndex,
      position: s.position,
      relevance: queryMatched
        ? (bm25[i] / maxBm25 + centrality[i] / maxCentrality) / 2
        : centrality[i] / maxCentrality,
      vecIndex: i,
    });
  });

  // MMR: repeatedly take the candidate with the best
  //   λ · relevance − (1 − λ) · (similarity to the closest sentence already picked),
  // only from theses not quoted yet, until every thesis that can be quoted is.
  const picked: Candidate[] = [];
  const pool = [...candidates];
  for (;;) {
    const choices = pool.filter((c) =>
      !picked.some((p) => p.sourceIndex === c.sourceIndex) &&
      !picked.some((p) => cosine(vecs[c.vecIndex], vecs[p.vecIndex]) >= NEAR_DUPLICATE));
    if (choices.length === 0) break;

    let best = choices[0];
    let bestScore = -Infinity;
    for (const c of choices) {
      const redundancy = Math.max(0, ...picked.map((p) => cosine(vecs[c.vecIndex], vecs[p.vecIndex])));
      const score = LAMBDA * c.relevance - (1 - LAMBDA) * redundancy;
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    picked.push(best);
    pool.splice(pool.indexOf(best), 1);
  }

  return picked
    // back into rank order, and abstract order within one thesis
    .sort((a, b) => a.sourceIndex - b.sourceIndex || a.position - b.position)
    .map(({ text, sourceIndex }) => ({ text, sourceIndex }));
}
