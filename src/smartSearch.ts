// Pure smart search box: no React, no firebase. Examples in
// smartSearch.check.ts (node src/smartSearch.check.ts). Method, examples and
// limits in docs/16-smart-search.md.
//
// Two helpers for the search box, built from the studies already loaded:
//   1. autocomplete()  — finishes the word being typed, from a Trie (trie.ts)
//   2. didYouMean()    — offers a corrected query when a typed word matches
//                        nothing, by Levenshtein distance (levenshtein.ts)
//   3. searchPlan()    — decides, per searched query, whether to search the
//                        correction at once ("Showing results for…"), only
//                        offer it as a button, or do nothing
// The search itself (search.ts, BM25F) is not changed: searchPlan only picks
// WHICH query it runs, and the box always keeps what the user typed.
//
// Words come from search.ts (tokenize, buildIndex, isNameTitle…), so a "word"
// here is exactly a word search can find.
import { FIELDS, buildIndex, findMatchScore, isNameTitle, tokenize, type Field, type SearchDoc } from "./search.ts";
import { STOP_WORDS } from "./similarity.ts";
import { Trie } from "./trie.ts";
import { lettersOf, levenshtein } from "./levenshtein.ts";

/** The numbers that tune the box. Change them here, with an example in
 *  smartSearch.check.ts. */
export const SMART_SEARCH = {
  /** At most this many autocomplete suggestions (fits a phone screen). */
  maxSuggestions: 6,
  /** Autocomplete starts once the last word has this many letters. The same
   *  minimum search uses: findMatchScore ignores 1-letter words. */
  minLetters: 2,
  /** Up to this many of the last words are matched against keyword phrases
   *  ("rice fa" → "rice farming"). */
  maxPhraseWords: 3,
  /** "Did you mean" leaves shorter words alone. With 3 letters almost any
   *  word is 1 edit from another real word, and most 3-letter words in
   *  research are acronyms ("GIS" was "corrected" to "gas"; "IoT", "ICT"). */
  minTypoLetters: 4,
  /** The search corrects itself only when every fixed word was typed with at
   *  least this many letters … */
  minAutoLetters: 5,
  /** … and is exactly this many edits from its fix. Anything else (2 edits,
   *  a 4-letter word) only gets the "Did you mean" button. */
  autoEdits: 1,
} as const;

/** How many edits a typed word may be from its correction: 1 for words of
 *  up to 4 letters, 2 for longer words. A short word with 2 edits is mostly
 *  a different word ("rice" → "risk"). */
export function maxDistanceFor(word: string): number {
  return lettersOf(word).length <= 4 ? 1 : 2;
}

/** Where a suggested word was found, shown on its row. */
export type SuggestionField = "title" | "keyword" | "author" | "adviser" | "abstract";

/** Search's field name → the label used here. */
const FIELD_LABEL: Record<Field, SuggestionField> = {
  title: "title", keywords: "keyword", authors: "author", adviser: "adviser", abstract: "abstract",
};

/** Lower is better: a word from a title says more about a study than a word
 *  that is only in an abstract. Used to keep the best field of each word. */
const FIELD_RANK: Record<SuggestionField, number> = { title: 0, keyword: 1, author: 2, adviser: 3, abstract: 4 };

/** One entry of the e-library's word list. */
export interface VocabWord {
  /** As search stores it: lowercase, accents kept ("niño"). A keyword phrase
   *  has spaces ("machine learning"). */
  text: string;
  /** The best field it appears in, over all studies. */
  field: SuggestionField;
  /** How many studies contain it. */
  studies: number;
  /** True for a whole keyword phrase of two or more words. */
  isPhrase: boolean;
}

/** Everything the box needs, built once per data change (useMemo in App.tsx). */
export interface SmartSearchIndex {
  /** Suggestion words and phrases, keyed by foldKey(text). */
  trie: Trie<VocabWord>;
  /** Single suggestion words grouped by letter count, so "Did you mean" only
   *  compares a typed word with words of a similar length. */
  wordsByLength: Map<number, VocabWord[]>;
  /** EVERY word search indexes, stop words included ("the", "of"). "Does this
   *  typed word match anything?" is asked against this list, not the curated
   *  suggestion list, so it gives the same answer search would. */
  searchWords: string[];
}

/** The lookup key for autocomplete: lowercase with accents removed, so "nin"
 *  and "Niñ" both reach "niño". Only for finding; the suggestion itself keeps
 *  its accents, because search matches "niño", not "nino". */
export function foldKey(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** A word worth suggesting: 2+ letters, not a plain number, not a common
 *  word ("the", "of", "study" — the stop words similarity.ts drops). */
function isSuggestable(word: string): boolean {
  return lettersOf(word).length >= 2 && !/^\d+$/.test(word) && !STOP_WORDS.has(word);
}

// ---------------------------------------------------------------------------
// Building the word list
// ---------------------------------------------------------------------------

/** While building: the best field so far and which studies hold the word. */
interface Tally {
  field: SuggestionField;
  studyIndexes: Set<number>;
  isPhrase: boolean;
}

/** Builds the Trie, the length groups and the search word list from the
 *  studies. Run once per data change, never per keystroke. */
export function buildSmartSearch(studies: SearchDoc[]): SmartSearchIndex {
  // search.ts's own index: the same words search sees, with Dr./Engr. and
  // degrees already left out of the name fields.
  const index = buildIndex(studies);
  const tallies = new Map<string, Tally>();

  // 1. Single words from every field.
  for (let i = 0; i < studies.length; i++) {
    for (const field of FIELDS) {
      for (const word of index.fieldTokens[field][i]) {
        if (isSuggestable(word)) addWord(tallies, word, FIELD_LABEL[field], i, false);
      }
    }
  }

  // 2. Whole keyword phrases ("machine learning"), spelled the way search
  //    splits them, so picking one searches for exactly those words.
  for (let i = 0; i < studies.length; i++) {
    for (const keyword of studies[i].keywords) {
      const words = tokenize(keyword);
      if (words.length >= 2) addWord(tallies, words.join(" "), "keyword", i, true);
    }
  }

  // 3. Turn the tallies into the Trie and the length groups.
  const trie = new Trie<VocabWord>();
  const wordsByLength = new Map<number, VocabWord[]>();
  for (const [text, tally] of tallies) {
    const word: VocabWord = { text, field: tally.field, studies: tally.studyIndexes.size, isPhrase: tally.isPhrase };
    trie.insert(foldKey(text), word);
    if (!word.isPhrase) addToLengthGroup(wordsByLength, word);
  }

  return { trie, wordsByLength, searchWords: index.vocab };
}

/** Counts one more appearance of `text` in study `studyIndex`, keeping the
 *  best field it has been seen in. */
function addWord(tallies: Map<string, Tally>, text: string, field: SuggestionField, studyIndex: number, isPhrase: boolean): void {
  const tally = tallies.get(text);
  if (!tally) {
    tallies.set(text, { field, studyIndexes: new Set([studyIndex]), isPhrase });
    return;
  }
  tally.studyIndexes.add(studyIndex);
  if (FIELD_RANK[field] < FIELD_RANK[tally.field]) tally.field = field;
}

function addToLengthGroup(groups: Map<number, VocabWord[]>, word: VocabWord): void {
  const length = lettersOf(word.text).length;
  const group = groups.get(length);
  if (group) group.push(word);
  else groups.set(length, [word]);
}

// ---------------------------------------------------------------------------
// Words of the query, with their place in the typed text
// ---------------------------------------------------------------------------

/** One word of the query as typed, and where it sits in the text. */
export interface WordSpan {
  /** Exactly as typed ("FA", "Niño"). */
  raw: string;
  /** As search reads it: NFC, lowercase ("fa", "niño"). */
  word: string;
  start: number;
  end: number;
}

/** The words of `query` with their positions. A word is a run of letters,
 *  accents, digits and "_" — the same rule as tokenize() in search.ts, so
 *  the words here are tokenize(query) in the same order. Positions let a
 *  suggestion replace only the words it matched and keep the rest as typed. */
export function wordSpans(query: string): WordSpan[] {
  const spans: WordSpan[] = [];
  for (const m of query.matchAll(/[\p{L}\p{M}\d_]+/gu)) {
    const start = m.index ?? 0;
    spans.push({ raw: m[0], word: m[0].normalize("NFC").toLowerCase(), start, end: start + m[0].length });
  }
  return spans;
}

// ---------------------------------------------------------------------------
// 1. Autocomplete
// ---------------------------------------------------------------------------

/** One autocomplete suggestion. */
export interface Completion extends VocabWord {
  /** How many words at the end of the query it replaces: 1 for a single word,
   *  2 or 3 when the last words were matched against a keyword phrase. */
  replaces: number;
}

/** Up to SMART_SEARCH.maxSuggestions words or keyword phrases that finish the
 *  word being typed — the LAST word, and only while it is still being typed
 *  (a query ending in a space or punctuation gets none). Phrase matches of
 *  the last 2–3 words come first ("rice fa" → "rice farming"), then words
 *  and phrases that start with the last word. Within each group: words found
 *  in a title, keyword, author or adviser before words found only in
 *  abstracts; then more studies; then A–Z. A word typed out in full is not
 *  offered back. */
export function autocomplete(index: SmartSearchIndex, query: string): Completion[] {
  const spans = wordSpans(query);
  const last = spans[spans.length - 1];
  if (!last || last.end !== query.length) return [];
  if (lettersOf(last.word).length < SMART_SEARCH.minLetters) return [];

  const found: Completion[] = [];
  const seen = new Set<string>();
  const longest = Math.min(SMART_SEARCH.maxPhraseWords, spans.length);
  // Longest ending first: "rice fa" (2 words) before "fa" (1 word).
  for (let n = longest; n >= 1; n--) {
    const typed = spans.slice(-n).map(s => s.word).join(" ");
    const matches = index.trie.withPrefix(foldKey(typed))
      .filter(w => w.text !== typed && !seen.has(w.text))
      .sort(compareSuggestions);
    for (const w of matches) {
      seen.add(w.text);
      found.push({ ...w, replaces: n });
    }
  }
  return found.slice(0, SMART_SEARCH.maxSuggestions);
}

/** Order of suggestions:
 *    1. two groups — words seen in a title, keyword, author or adviser first,
 *       words seen only in abstracts last (abstracts are full of filler
 *       words: "many", "far");
 *    2. inside each group, more studies first ("ma" → machine (8 studies)
 *       before management (1));
 *    3. then A–Z, so the order never depends on the order studies loaded. */
function compareSuggestions(a: VocabWord, b: VocabWord): number {
  const groupA = isAbstractOnly(a) ? 1 : 0;
  const groupB = isAbstractOnly(b) ? 1 : 0;
  if (groupA !== groupB) return groupA - groupB;
  if (a.studies !== b.studies) return b.studies - a.studies;
  return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
}

/** True when the word's best field is the abstract: no study has it in a
 *  title, keyword, author or adviser. */
function isAbstractOnly(word: VocabWord): boolean {
  return word.field === "abstract";
}

/** The query after picking `c`: the words it matched are replaced by the
 *  suggestion, everything typed before them is kept exactly as typed (case,
 *  extra spaces), and a space is added so the next word can be typed.
 *  "Rice  fa" + "farming" → "Rice  farming "; + "rice farming" → "rice farming ". */
export function applyCompletion(query: string, c: Pick<Completion, "text" | "replaces">): string {
  const spans = wordSpans(query);
  const first = spans[spans.length - c.replaces];
  if (!first) return query;
  return query.slice(0, first.start) + c.text + " ";
}

// ---------------------------------------------------------------------------
// 2. "Did you mean…?"
// ---------------------------------------------------------------------------

/** A corrected query: the whole text, and the same text in parts so the
 *  changed words can be shown in bold. A changed part also keeps the word
 *  as it was typed (`from`, lowercase), so searchPlan() can measure it. */
export interface Correction {
  query: string;
  parts: { text: string; changed: boolean; from?: string }[];
}

/** The query with each misspelled word replaced by its closest e-library
 *  word, or null when nothing needs (or can be given) a correction. Words
 *  that are fine, and everything between words, are kept as typed. Picking
 *  it gives a query whose words all match, so it never offers a second one. */
export function didYouMean(index: SmartSearchIndex, query: string): Correction | null {
  const parts: Correction["parts"] = [];
  let position = 0;
  let anyChanged = false;

  for (const span of wordSpans(query)) {
    // The text before this word (spaces, punctuation) stays as typed.
    if (span.start > position) parts.push({ text: query.slice(position, span.start), changed: false });
    const fix = correctionFor(index, span.word);
    if (fix) {
      parts.push({ text: fix, changed: true, from: span.word });
      anyChanged = true;
    } else {
      parts.push({ text: span.raw, changed: false });
    }
    position = span.end;
  }
  if (position < query.length) parts.push({ text: query.slice(position), changed: false });

  if (!anyChanged) return null;
  return { query: parts.map(p => p.text).join(""), parts };
}

/** The correction for one typed word, or null. */
export function correctionFor(index: SmartSearchIndex, word: string): string | null {
  if (isLeftAlone(word)) return null;
  if (matchesSomething(index, word)) return null;
  return closestWord(index, word);
}

/** Words "Did you mean" never touches: short words, numbers and years
 *  ("2024"), titles and degrees ("Dr", "Engr", "PhD") and common words
 *  ("the", "of"), whether or not any study contains them. */
function isLeftAlone(word: string): boolean {
  if (lettersOf(word).length < SMART_SEARCH.minTypoLetters) return true;
  if (/^\d+$/.test(word)) return true;
  if (isNameTitle(word)) return true;
  return STOP_WORDS.has(word);
}

/** True when search would find this word somewhere: an exact word, a word
 *  it starts ("socialnes" → "socialness") or, for 4+ letters, a word it is
 *  inside. findMatchScore is search's own rule, so the two always agree. */
function matchesSomething(index: SmartSearchIndex, word: string): boolean {
  for (const indexed of index.searchWords) {
    if (findMatchScore(word, indexed) > 0) return true;
  }
  return false;
}

/** The suggestion word closest to `word`, within maxDistanceFor(word).
 *  Only words whose length differs by at most that distance are compared —
 *  a longer or shorter word needs at least that many additions or removals.
 *  Ties are broken by isCloser(). */
function closestWord(index: SmartSearchIndex, word: string): string | null {
  const max = maxDistanceFor(word);
  const length = lettersOf(word).length;
  let best: { word: VocabWord; distance: number } | null = null;

  for (let len = length - max; len <= length + max; len++) {
    for (const candidate of index.wordsByLength.get(len) ?? []) {
      const distance = levenshtein(word, candidate.text, max);
      if (distance > max) continue;
      const option = { word: candidate, distance };
      if (!best || isCloser(word, option, best)) best = option;
    }
  }
  return best ? best.word.text : null;
}

/** True when option `a` is a better correction for `typed` than option `b`:
 *    1. fewer edits;
 *    2. starts with the same letter as the typed word — people rarely get the
 *       first letter wrong ("acosat" → "acosta", not "cost": both 2 edits);
 *    3. length closer to the typed word;
 *    4. found in more studies;
 *    5. A–Z, so the answer never depends on the order studies were loaded. */
function isCloser(typed: string, a: { word: VocabWord; distance: number }, b: { word: VocabWord; distance: number }): boolean {
  if (a.distance !== b.distance) return a.distance < b.distance;

  const firstA = sameFirstLetter(typed, a.word.text);
  const firstB = sameFirstLetter(typed, b.word.text);
  if (firstA !== firstB) return firstA;

  const typedLength = lettersOf(typed).length;
  const gapA = Math.abs(lettersOf(a.word.text).length - typedLength);
  const gapB = Math.abs(lettersOf(b.word.text).length - typedLength);
  if (gapA !== gapB) return gapA < gapB;

  if (a.word.studies !== b.word.studies) return a.word.studies > b.word.studies;
  return a.word.text < b.word.text;
}

function sameFirstLetter(x: string, y: string): boolean {
  return lettersOf(x)[0] === lettersOf(y)[0];
}

// ---------------------------------------------------------------------------
// 3. Search the correction at once, offer it, or do nothing
// ---------------------------------------------------------------------------

/** What the Search screen does with one searched query:
 *    "as-typed"        search it as typed; show nothing extra;
 *    "auto-corrected"  search `correction.query` instead, and show
 *                      "Showing results for …  Search instead for …";
 *    "suggest"         search it as typed, and show the "Did you mean" button. */
export type SearchMode = "as-typed" | "auto-corrected" | "suggest";

export interface SearchPlan {
  /** The query to actually search. Everything after the search uses it:
   *  the result line, highlights, snippets, relevance %, the summary. */
  query: string;
  mode: SearchMode;
  /** The correction to show (fixed words in bold); null for "as-typed". */
  correction: Correction | null;
}

/** Decides how to search `query` (docs/16 §7). The search corrects itself
 *  only when ALL three are true:
 *    (a) the query as typed finds 0 results with the current filters;
 *    (b) every fixed word was typed with 5+ letters and is exactly 1 edit
 *        from its fix;
 *    (c) the corrected query finds at least 1 result with the same filters.
 *  Otherwise a correction, if didYouMean() finds one, is only offered as the
 *  button.
 *  `countResults` runs the real search (with the screen's filters) and says
 *  how many studies it found, so this file needs neither React nor the
 *  filters. `exact` is true after "Search instead for …": the typed words are
 *  searched with no correction, and nothing is shown. */
export function searchPlan(
  index: SmartSearchIndex,
  query: string,
  countResults: (query: string) => number,
  options: { exact?: boolean } = {},
): SearchPlan {
  const asTyped: SearchPlan = { query, mode: "as-typed", correction: null };
  if (options.exact) return asTyped;

  const correction = didYouMean(index, query);
  // Every word is fine (or is left alone): exactly as before.
  if (!correction) return asTyped;

  const suggest: SearchPlan = { query, mode: "suggest", correction };
  // (b) first: it needs no search, so it is the cheapest test.
  if (!everyFixIsSafe(correction)) return suggest;
  // (a) the typed query finds something: the user may have meant it.
  if (countResults(query) > 0) return suggest;
  // (c) the fix would find nothing either: no point switching to it.
  if (countResults(correction.query) === 0) return suggest;

  return { query: correction.query, mode: "auto-corrected", correction };
}

/** Rule (b): every changed word was typed with SMART_SEARCH.minAutoLetters
 *  or more letters, and is exactly SMART_SEARCH.autoEdits edit from its fix. */
function everyFixIsSafe(correction: Correction): boolean {
  for (const part of correction.parts) {
    if (!part.changed) continue;
    const typed = part.from ?? "";
    if (lettersOf(typed).length < SMART_SEARCH.minAutoLetters) return false;
    if (levenshtein(typed, part.text) !== SMART_SEARCH.autoEdits) return false;
  }
  return true;
}
