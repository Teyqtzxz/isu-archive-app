// The short abstract snippet on a search result card, and the word matching
// that the highlighting shares with it. Pure: no React, no Firebase — like
// citation.ts, so it can be checked on its own (node src/snippet.check.ts).
//
// It takes the abstract already split into sentences (splitSentences() in
// summary.ts, the same split the combined summary uses), picks the sentence
// that contains the most query words, and cuts a long one down to about
// SNIPPET_MAX characters around the first query word, marking each cut with
// "…". A query word matches a word that STARTS with it ("learn" → "learning",
// "Bio" → "Biodiversity"), as search does (findMatchScore()); words under 2
// letters are ignored, as search ignores them. highlightKw() in
// components/shared.tsx marks words with the same rule (queryTerms() and
// queryWordPattern() below), so every snippet shown has a highlighted word.
//
// "./search.ts" with its extension so `node src/snippet.check.ts` can load it.
import { tokenize } from "./search.ts";

/** About how long a snippet may be, in characters, before "…" is added. */
export const SNIPPET_MAX = 160;

/** The query's words, lowercased, each once, without words under 2 letters. */
export function queryTerms(query: string): string[] {
  return [...new Set(tokenize(query))].filter(t => t.length >= 2);
}

/** Matches a whole word that starts with one of `terms` (case-insensitive),
 *  e.g. all of "Learning" for "learn". The word is capture group 1, so
 *  `text.split()` puts the matched words at the odd positions. `terms` must
 *  be non-empty and come from queryTerms(): tokenize() leaves only letters,
 *  digits and "_", so nothing in them needs escaping. */
export function queryWordPattern(terms: string[]): RegExp {
  return new RegExp(`\\b((?:${terms.join("|")})\\w*)`, "gi");
}

/** The best sentence for `query`, cut to about `max` characters, or "" when
 *  no sentence contains a query word (the card then shows no snippet). */
export function abstractSnippet(sentences: string[], query: string, max = SNIPPET_MAX): string {
  const terms = queryTerms(query);
  if (terms.length === 0) return "";

  // Most distinct query words wins; on a tie the earlier sentence wins.
  let best = "";
  let bestCount = 0;
  for (const s of sentences) {
    const words = tokenize(s);
    const count = terms.filter(t => words.some(w => w.startsWith(t))).length;
    if (count > bestCount) { best = s; bestCount = count; }
  }
  if (bestCount === 0) return "";
  return cutAround(best.trim(), terms, max);
}

/** `sentence` if it fits, otherwise about `max` characters of it starting a
 *  little before the first query word, cut at spaces, with "…" at each cut. */
function cutAround(sentence: string, terms: string[], max: number): string {
  if (sentence.length <= max) return sentence;
  const first = queryWordPattern(terms).exec(sentence)?.index ?? 0;
  // A little lead-in before the first query word, so it reads as a phrase.
  let start = Math.max(0, first - Math.floor(max / 4));
  let end = Math.min(sentence.length, start + max);
  start = Math.max(0, end - max);
  // Never cut through a word: move each cut to the nearest space inside the window.
  if (start > 0) {
    const sp = sentence.indexOf(" ", start);
    if (sp !== -1 && sp < first) start = sp + 1;
  }
  if (end < sentence.length) {
    const sp = sentence.lastIndexOf(" ", end);
    if (sp > start) end = sp;
  }
  const cut = sentence.slice(start, end).trim().replace(/[,;:]$/, "");
  return `${start > 0 ? "…" : ""}${cut}${end < sentence.length ? "…" : ""}`;
}
