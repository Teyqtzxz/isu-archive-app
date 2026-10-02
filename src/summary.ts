// Pure extractive summary: no React, no firebase, no network. It picks real
// sentences out of the abstracts already in memory; it never writes new prose.
import { tokenize } from "./search";
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

function scoreSentence(sentence: string, terms: string[], isFirstInAbstract: boolean): number {
  const lower = sentence.toLowerCase();
  let score = 0;

  for (const t of terms) {
    if (lower.includes(t)) {
      score += 2; // matched a query term
      score += lower.split(t).length - 1; // +1 per extra occurrence
    }
  }

  if (isFirstInAbstract) score += 1; // opening sentences usually state the aim
  const words = sentence.split(" ").length;
  if (words < 5) score -= 2; // too short to be useful
  if (words > 60) score -= 1; // too long to read

  return score;
}

/** Every ticked result is used — the user chose them. Order does not matter;
 *  output is put back into rank order at the end. */
export function summarise(results: RankedThesis[], query: string, maxSentences = 4): SummarySentence[] {
  const top = [...results].sort((a, b) => a.rank - b.rank);
  const terms = tokenize(query);

  // Only sentences that contain a query word are candidates. The opening-sentence
  // bonus in scoreSentence is a tie-breaker between those; on its own it would
  // let every abstract's first line in, whatever it is about.
  const candidates: (SummarySentence & { score: number; position: number })[] = [];
  top.forEach(({ thesis, rank }) => {
    splitSentences(thesis.abstract).forEach((s, sIdx) => {
      const lower = s.toLowerCase();
      if (!terms.some((t) => lower.includes(t))) return;
      candidates.push({
        text: s,
        sourceIndex: rank,
        score: scoreSentence(s, terms, sIdx === 0),
        position: sIdx,
      });
    });
  });

  // Fallback: no query, or nothing matched. Use the opening sentence of the
  // top results in rank order so the panel is never empty.
  if (terms.length === 0 || !candidates.some((c) => c.score > 0)) {
    return top
      .map(({ thesis, rank }) => {
        const first = splitSentences(thesis.abstract)[0];
        return first ? { text: first, sourceIndex: rank } : null;
      })
      .filter((x): x is SummarySentence => x !== null)
      .slice(0, maxSentences);
  }

  return candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    // back into rank order, and abstract order within one thesis
    .sort((a, b) => a.sourceIndex - b.sourceIndex || a.position - b.position)
    .map(({ text, sourceIndex }) => ({ text, sourceIndex }));
}
