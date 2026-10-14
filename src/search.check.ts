// Examples for search.ts (and the summary's use of it). Run with:  node src/search.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// The studies below are fake, made up for these examples only — never stored anywhere.
import {
  bestFieldFor, bm25Score, buildIndex, computeDocFreq, findMatchScore, isNameTitle, relevancePercent, textOnly, tokenize,
  type SearchDoc,
} from "./search.ts";
import { splitSentences, summarise } from "./summary.ts";
import type { Thesis } from "./types.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

function study(id: string, f: Pick<Thesis, "title" | "authors" | "adviser" | "year" | "keywords" | "abstract">): Thesis {
  return { id, department: "Agriculture", driveLink: "", status: "POSTED", registeredBy: "", registeredAt: null, ...f };
}

// Newest first, as subscribeToTheses() hands them over.
const STUDIES: Thesis[] = [
  study("irrigation", {
    title: "Irrigation Scheduling with Soil Moisture Sensors",
    authors: ["Juan Dela Cruz", "Ana Reyes"],
    adviser: "Dr. Maria Stone, PhD",
    year: 2024,
    keywords: ["irrigation", "soil moisture"],
    abstract:
      "This study built a low-cost soil moisture sensor for rice paddies in Echague. " +
      "Water was released only when the soil dried below a set level. " +
      "Over two seasons the farms used about a third less water with the same rice yield. " +
      "Farmers found the sensor easy to read and cheap to repair.",
  }),
  study("rice", {
    title: "Rice Yield Prediction Using Machine Learning",
    authors: ["Jan Acosta"],
    adviser: "Engr. Liza Pagulayan",
    year: 2023,
    keywords: ["machine learning", "crop yield"],
    abstract:
      "Gradient boosting models predicted palay yield from rainfall, soil and planting dates. " +
      "The model was trained on five years of municipal harvest records. " +
      "Farms with steady irrigation showed the most predictable yields. " +
      "Machine learning predictions were within ten percent of the actual harvest.",
  }),
  study("mangrove", {
    title: "Mangrove Cover in Palanan",
    authors: ["Rosa Peñaflor"],
    adviser: "Prof. Carmen Villanueva",
    year: 2025,
    keywords: ["mangroves", "coastal ecology"],
    abstract:
      "Satellite images from 2015 to 2024 were used to map mangrove cover along the Palanan coast. " +
      "Cover fell sharply after the El Niño drought and recovered within three years. " +
      "Community replanting sites recovered faster than untouched sites.",
  }),
  study("test", {
    title: "Test entry",
    authors: [],
    adviser: "Dr. Ramon Bautista",
    year: 2022,
    keywords: [],
    abstract: "This is a sample irrigation note written only for testing.",
  }),
];

/** What SearchScreen does: index once, df once per query, score, drop zeros, best first. */
function search(query: string, docs: Thesis[] = STUDIES): { id: string; score: number }[] {
  const index = buildIndex(docs);
  const df = computeDocFreq(tokenize(query), index);
  return docs
    .map((t, i) => ({ id: t.id, score: bm25Score(query, t, i, index, df).score }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
const ids = (query: string, docs?: Thesis[]) => search(query, docs).map(r => r.id);
const idx = buildIndex(STUDIES);

console.log("— Field weights: a title hit counts more than an abstract hit —");
const filler = "Farm records from four barangays were compared across two dry seasons in Isabela.";
const pair = [
  study("abstract-hit", { title: "Survey of Rice Farms", authors: [], adviser: "", year: 2024, keywords: [],
    abstract: `${filler} A sample set of farms was visited.` }),
  study("title-hit", { title: "Sample Survey of Rice Farms", authors: [], adviser: "", year: 2024, keywords: [],
    abstract: `${filler} A random set of farms was visited.` }),
];
check("“sample” in the title beats “sample” in the abstract", ids("sample", pair), ["title-hit", "abstract-hit"]);
const sameAbstract = (id: string, title: string) =>
  study(id, { title, authors: [], adviser: "", year: 2024, keywords: [], abstract: filler });
const lengths = search("sample", [sameAbstract("short", "thesis sample 2"), sameAbstract("long", "Sample Thesis for pdf reader")]);
check("a longer title is not penalised: equal scores (newest-first order kept)",
  [lengths.map(r => r.id), lengths[0].score === lengths[1].score], [["short", "long"], true]);
check("a keyword hit beats an abstract-only hit (“irrigation”)", ids("irrigation"), ["irrigation", "test", "rice"]);

console.log("\n— Authors and adviser are searchable —");
check("“Acosta” (an author) finds his study", ids("Acosta"), ["rice"]);
check("“Stone” (an adviser) finds her study", ids("Stone"), ["irrigation"]);
check("“Dr. Stone” finds Stone's study first", ids("Dr. Stone")[0], "irrigation");
check("“Peñaflor” (with ñ) finds her study", ids("Peñaflor"), ["mangrove"]);
check("titles are not indexed: “dr” does not find “Dr. Ramon Bautista” (only abstract words like “dried”)",
  ids("dr").includes("test"), false);
check("degrees are not indexed: “PhD” finds nothing", ids("PhD"), []);
check("“Bautista” finds the adviser's study", ids("Bautista"), ["test"]);

check("every title and degree the Register form accepts is left out (any case, with or without the dot)",
  ["Dr.", "Engr.", "Prof.", "Asst.", "Assoc.", "Mr.", "Mrs.", "Ms.", "Atty.", "PhD", "EdD", "MSc", "MS", "MA", "MIT", "MBA", "RN", "PE", "CE"]
    .map(w => tokenize(w)[0]).filter(w => !isNameTitle(w)), []);
check("isNameTitle: a real name is not a title", ["Stone", "Pedro", "Maria"].some(isNameTitle), false);

console.log("\n— Which field matched (termScores.field), read from the index —");
const fieldOf = (query: string, id: string) => {
  const i = STUDIES.findIndex(t => t.id === id);
  return bm25Score(query, STUDIES[i], i, idx, computeDocFreq(tokenize(query), idx)).termScores.map(t => t.field);
};
check("title, year, keyword, author, adviser, abstract",
  [fieldOf("irrigation", "irrigation"), fieldOf("2024", "irrigation"), fieldOf("crop", "rice"),
   fieldOf("Acosta", "rice"), fieldOf("Stone", "irrigation"), fieldOf("dried", "irrigation")],
  [["title"], ["year"], ["keyword"], ["author"], ["adviser"], ["abstract"]]);
check("bestFieldFor reads the index, not a study", bestFieldFor(idx, 1, "acosta"), "author");

console.log("\n— A 4-digit word matches the Academic Year —");
check("“2024”: the 2024 study first, then the one with “2024” only in its text", ids("2024"), ["irrigation", "mangrove"]);
check("“2022”: found by its year alone (no text says 2022)", ids("2022"), ["test"]);
check("df counts year matches as well as text hits: “2024” → 2 studies, “2023” → 1",
  [computeDocFreq(["2024"], idx).get("2024"), computeDocFreq(["2023"], idx).get("2023")], [2, 1]);
check("exact only: “202” never matches a year field (only text such as “2015”, “2024”)", ids("202"), ["mangrove"]);
check("a year and a topic add up: “irrigation 2024” puts the 2024 irrigation study first", ids("irrigation 2024")[0], "irrigation");

console.log("\n— ñ and accents are letters —");
check("“El Niño drought” → three words", tokenize("El Niño drought"), ["el", "niño", "drought"]);
check("before this change it was “ni” + “o”; now one word", tokenize("niño"), ["niño"]);
check("an ñ from a PDF (n + combining ~) equals a typed ñ", tokenize("Niño"), ["niño"]);
check("“niño” finds the study that mentions El Niño", ids("niño"), ["mangrove"]);
check("accents are not folded: “nino” is a different word", ids("nino"), []);
check("digits and “_” are still kept", tokenize("Web 2.0 snake_case"), ["web", "2", "0", "snake_case"]);

console.log("\n— Must survive (docs/00) —");
check("findMatchScore: exact 1, prefix 0.8, substring 0.6, none 0",
  [findMatchScore("rice", "rice"), findMatchScore("bio", "biodiversity"), findMatchScore("diver", "biodiversity"), findMatchScore("x", "x")],
  [1, 0.8, 0.6, 0]);
check("the length >= 4 guard: “ion” finds nothing mid-word", ids("ion"), []);
check("4+ letters still match mid-word: “gation” finds the irrigation studies", ids("gation"), ["irrigation", "test", "rice"]);
// bm25Score reads the prebuilt index, never re-tokenises the study: give it an
// empty study at the irrigation study's position and it still scores from the index.
check("bm25Score scores from the index, not from the study passed in",
  bm25Score("irrigation", textOnly(""), 0, idx, computeDocFreq(["irrigation"], idx)).score > 0, true);
check("bm25Score keeps its 5 arguments (query, thesis, docIndex, index, df)", bm25Score.length, 5);
const empty = buildIndex([]);
check("empty corpus: avgDocLen and every field average fall back to 1",
  [empty.avgDocLen, ...Object.values(empty.avgFieldLen)], [1, 1, 1, 1, 1, 1]);
const noKeywords = STUDIES.filter(t => t.keywords.length === 0);
check("a field nobody filled (no keywords anywhere): average 1, scores are numbers, not NaN",
  [buildIndex(noKeywords).avgFieldLen.keywords, search("sample", noKeywords).every(r => Number.isFinite(r.score))], [1, true]);
check("relevance: the top result shows 97%, never 100%; half the top score → 51%",
  [relevancePercent(8.2, 8.2), relevancePercent(4.1, 8.2)], [97, 51]);
check("relevance: nothing matched (top score 0) → no division by zero", relevancePercent(0, 0), 4);

console.log("\n— The combined summary scores sentence text only —");
// The summary scores each sentence with bm25Score. If a sentence carried its
// study's authors, adviser or year, every sentence would "match" them.
const sentences = STUDIES.flatMap(t => splitSentences(t.abstract).map(text => ({ t, text })));
const sentenceScores = (query: string, docs: SearchDoc[]) => {
  const index = buildIndex(docs);
  const df = computeDocFreq(tokenize(query), index);
  return docs.map((d, i) => Number(bm25Score(query, d, i, index, df).score.toFixed(6)));
};
const naive = sentences.map(s => ({ ...s.t, title: "", keywords: [], abstract: s.text }));
check("the trap: sentences built as { ...thesis, title: \"\", keywords: [] } would all match “Stone”",
  sentenceScores("Stone", naive).some(s => s > 0), true);
const asText = sentences.map(s => textOnly(s.text));
check("with textOnly(): no sentence matches “Stone”, “Acosta” or “2024” by name or year",
  [sentenceScores("Stone", asText).some(s => s > 0), sentenceScores("Acosta", asText).some(s => s > 0),
   sentenceScores("2024", asText).filter(s => s > 0).length], [false, false, 1]);

// Recorded with the code on main before this change (search.ts + summary.ts of
// merge 24397e9), on the studies above WITHOUT the mangrove study: its "El Niño"
// used to be two words ("ni" + "o") and is now one, which changes the average
// sentence length and so every score a little — the tokenizer change, on
// purpose. On text without ñ or accents the new scoring must give the same.
const plain = sentences.filter(s => s.t.id !== "mangrove").map(s => textOnly(s.text));
const BEFORE_SCORES: Record<string, number[]> = {
  "irrigation": [0, 0, 0, 0, 0, 0, 1.550894, 0, 1.48732],
  "rice yield": [1.277802, 0, 2.097712, 0, 1.040984, 0, 1.031934, 0, 0],
  "machine learning": [0, 0, 0, 0, 0, 0, 0, 3.910447, 0],
  "Stone": [0, 0, 0, 0, 0, 0, 0, 0, 0],
  "2024": [0, 0, 0, 0, 0, 0, 0, 0, 0],
  "sample": [0, 0, 0, 0, 0, 0, 0, 0, 2.035372],
  "Stone irrigation": [0, 0, 0, 0, 0, 0, 1.550894, 0, 1.48732],
  "rice 2024": [1.277802, 0, 1.193722, 0, 0, 0, 0, 0, 0],
};
for (const [query, want] of Object.entries(BEFORE_SCORES)) {
  check(`every sentence's score is unchanged for “${query}” (text without ñ)`, sentenceScores(query, plain), want);
}
check("the one sentence with “El Niño” is now one word shorter (13 words, was 14)",
  buildIndex([textOnly("Cover fell sharply after the El Niño drought and recovered within three years.")]).docTokens[0].length, 13);

// The summary's final picks, recorded the same way on all four studies.

const S1 = "1: Over two seasons the farms used about a third less water with the same rice yield.";
const S2 = "2: Gradient boosting models predicted palay yield from rainfall, soil and planting dates.";
const S3 = "3: Satellite images from 2015 to 2024 were used to map mangrove cover along the Palanan coast.";
const S4 = "4: This is a sample irrigation note written only for testing.";
const BEFORE_SUMMARY: Record<string, string[]> = {
  "irrigation": [S1, "2: Farms with steady irrigation showed the most predictable yields.", S3, S4],
  "rice yield": [S1, S2, S3, S4],
  "machine learning": [S1, "2: Machine learning predictions were within ten percent of the actual harvest.", S3, S4],
  "Stone": [S1, S2, S3, S4],
  "Acosta": [S1, S2, S3, S4],
  "2024": [S1, S2, S3, S4],
  "sample": [S1, S2, S3, S4],
  "": [S1, S2, S3, S4],
};
const ticked = STUDIES.map((thesis, i) => ({ thesis, rank: i + 1 }));
for (const [query, want] of Object.entries(BEFORE_SUMMARY)) {
  check(`the summary is unchanged for “${query}”`,
    summarise(ticked, query).map(s => `${s.sourceIndex}: ${s.text}`), want);
}

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
