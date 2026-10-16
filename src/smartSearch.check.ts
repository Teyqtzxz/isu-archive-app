// Examples for smartSearch.ts. Run with:  node src/smartSearch.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// The last section times the box at 300 synthetic studies.
import {
  applyCompletion, autocomplete, buildSmartSearch, didYouMean, searchPlan, wordSpans, type SmartSearchIndex,
} from "./smartSearch.ts";
import { bm25Score, buildIndex, computeDocFreq, tokenize, type SearchDoc } from "./search.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

function study(fields: Partial<SearchDoc>): SearchDoc {
  return { title: "", abstract: "", keywords: [], authors: [], adviser: "", year: 2024, ...fields };
}

// A small library shaped like the real one (docs/16 §6).
const library: SearchDoc[] = [
  study({
    title: "Low-cost soil moisture sensors for irrigation of small rice farms",
    abstract: "Small rice farms in Echague, Isabela often irrigate on a fixed schedule. The study of the sensors saved water.",
    keywords: ["soil moisture", "rice farming", "irrigation", "Isabela"],
    authors: ["Juan Dela Cruz"], adviser: "Engr. Liza Pagulayan",
  }),
  study({
    title: "Soil moisture and rice yield",
    abstract: "Irrigation timing and the rice harvest in Isabela.",
    keywords: ["soil moisture", "rice farming"],
    adviser: "Dr. Maria Santos",
  }),
  study({
    title: "Machine learning for crop yield prediction",
    abstract: "This study applies machine learning to crop yield in Isabela Province, at a low cost.",
    keywords: ["machine learning", "crop yield prediction", "palay"],
    authors: ["Jan Rhyanne Acosta", "Luigi Mindanao"], adviser: "Dr. Carmen Villanueva",
  }),
  study({
    title: "my.Eskwela: a learning management system",
    abstract: "Trust and confidence in new technology.",
    keywords: ["trust", "HCI"],
    authors: ["Orven Llantos"], adviser: "Prof. Elena Bulan", year: 2018,
  }),
  study({
    title: "Rainfall during El Niño years",
    abstract: "Drought and rainfall in Peñablanca, Cagayan.",
    keywords: ["El Niño"],
  }),
  // For the tie-breaks: "firm" is 1 edit from both "farm" and "form";
  // "past" is 1 edit from both "pest" and "post".
  study({ title: "Form design", abstract: "Pest control. Post harvest.", keywords: ["farm"] }),
  study({ title: "Form layout", abstract: "Notes." }),
];
const index = buildSmartSearch(library);

const texts = (q: string, ix: SmartSearchIndex = index) => autocomplete(ix, q).map(c => c.text);
const fixed = (q: string, ix: SmartSearchIndex = index) => didYouMean(ix, q)?.query ?? null;

console.log("— Words of the query (same as search's tokenize) —");
for (const q of ["Rice  FA", "soil, irr", "my.Eskwela", "El NIÑO 2024", "  "]) {
  check(`wordSpans = tokenize: “${q}”`, wordSpans(q).map(s => s.word), tokenize(q));
}

console.log("\n— Autocomplete: what is suggested —");
check("“irr” → irrigation, irrigate (title before abstract)", texts("irr"), ["irrigation", "irrigate"]);
check("“mac” → machine, then the phrase machine learning", texts("mac"), ["machine", "machine learning"]);
check("“soi” → soil (2 studies), soil moisture", texts("soi"), ["soil", "soil moisture"]);
check("an author: “acos” → acosta", texts("acos"), ["acosta"]);
check("an adviser: “pag” → pagulayan", texts("pag"), ["pagulayan"]);
check("mixed case: “IRRIG” = “irrig”", texts("IRRIG"), texts("irrig"));
check("accents: “nin” → niño", texts("nin"), ["niño"]);
check("accents: “Niñ” → niño too", texts("Niñ"), ["niño"]);
check("accent-only: “nino” typed in full → niño (a different word)", texts("nino"), ["niño"]);
check("phrase: “rice fa” → rice farming first", texts("rice fa")[0], "rice farming");
check("phrase: “crop yield pr” → the phrase first, then words", texts("crop yield pr"), ["crop yield prediction", "prediction", "province"]);
check("phrase: “crop yield p” → [] (the last word needs 2 letters)", texts("crop yield p"), []);
check("a word typed in full is not offered back: “machine”", texts("machine"), ["machine learning"]);
check("Dr./Engr. are never suggested: “dr” → drought only", texts("dr"), ["drought"]);
check("common words are never suggested: “th” → nothing", texts("th"), []);
check("a prefix that matches nothing: “zzz” → []", texts("zzz"), []);
check("one letter is too short: “i” → []", texts("i"), []);
check("empty box → []", texts(""), []);
check("ends in a space (word finished) → []", texts("rice "), []);
check("ends in punctuation → []", texts("rice,"), []);
check("a number: “20” → [] (years are not suggested)", texts("20"), []);
check("at most 6 suggestions", autocomplete(index, "s").length <= 6 && autocomplete(index, "so").length <= 6, true);
// Order: two groups (title / keyword / author / adviser first, abstract-only
// last); inside each group more studies first, then A–Z.
const orderLibrary = buildSmartSearch([
  study({ title: "A learning management system", abstract: "Many users." }),
  study({ title: "Notes", keywords: ["machine"], abstract: "Massive data." }),
  study({ title: "Notes", keywords: ["machine"] }),
  study({ title: "Notes", keywords: ["machine"], abstract: "Many farms." }),
]);
check("order: “ma” → machine (3 studies) before management (1), abstract-only words last",
  texts("ma", orderLibrary), ["machine", "management", "many", "massive"]);
check("order: an abstract-only word in more studies still comes last: “man” → management, many",
  texts("man", orderLibrary), ["management", "many"]);
check("each suggestion says its field and study count", autocomplete(index, "soi")[0],
  { text: "soil", field: "title", studies: 2, isPhrase: false, replaces: 1 });

console.log("\n— Autocomplete: picking replaces only the matched words —");
check("“rice fa” + rice farming → “rice farming ”", applyCompletion("rice fa", { text: "rice farming", replaces: 2 }), "rice farming ");
check("“Rice  FA” + farming → earlier word kept as typed", applyCompletion("Rice  FA", { text: "farming", replaces: 1 }), "Rice  farming ");
check("“Rice  FA” + the phrase → both matched words replaced", applyCompletion("Rice  FA", { text: "rice farming", replaces: 2 }), "rice farming ");
check("“SOIL  Rice  fa” + the phrase → “SOIL  ” kept", applyCompletion("SOIL  Rice  fa", { text: "rice farming", replaces: 2 }), "SOIL  rice farming ");
check("punctuation before the word kept: “soil, irr”", applyCompletion("soil, irr", { text: "irrigation", replaces: 1 }), "soil, irrigation ");
check("the real list's first pick for “Rice  fa”", applyCompletion("Rice  fa", autocomplete(index, "Rice  fa")[0]), "rice farming ");

console.log("\n— Did you mean: corrections —");
check("“irigation” → irrigation", fixed("irigation"), "irrigation");
check("“moistrue” → moisture (2 edits)", fixed("moistrue"), "moisture");
check("“machne lerning” → machine learning", fixed("machne lerning"), "machine learning");
check("“Isabella” → isabela", fixed("Isabella"), "isabela");
check("results through “rice” still get the fix: “rice irigation”", fixed("rice irigation"), "rice irrigation");
check("words around a fix stay as typed: “RICE  irigation!”", fixed("RICE  irigation!"), "RICE  irrigation!");
check("“Engr. Pagulyan” → Engr. kept, surname fixed", fixed("Engr. Pagulyan"), "Engr. pagulayan");
check("accent-only: “nino” (no study has it) → niño", fixed("nino"), "niño");
check("changed words are marked for bold", didYouMean(index, "rice irigation")?.parts,
  [{ text: "rice", changed: false }, { text: " ", changed: false }, { text: "irrigation", changed: true, from: "irigation" }]);

console.log("\n— Did you mean: tie-breaks —");
check("same distance (2): same first letter wins — “Acosat” → acosta, not cost", fixed("Acosat"), "acosta");
check("same distance and first letter: more studies wins — “firm” → form (2) over farm (1)", fixed("firm"), "form");
check("all equal: A–Z — “past” → pest before post", fixed("past"), "pest");

console.log("\n— Did you mean: never shown —");
check("a correct rare word (1 study): “eskwela”", fixed("eskwela"), null);
check("a year: “2024”", fixed("2024"), null);
check("a year not in the library: “1999”", fixed("1999"), null);
check("“the” (in the abstracts) → never", fixed("the"), null);
check("“of” → never", fixed("of"), null);
check("“the of” → never", fixed("the of"), null);
const noStopWords = buildSmartSearch([study({ title: "Soil sensors", abstract: "Sensors measure soil." })]);
check("“the” even in a library without it (common word)", fixed("the", noStopWords), null);
check("“and” even in a library without it", fixed("and", noStopWords), null);
check("a title: “Dr. Villanueva” → never", fixed("Dr. Villanueva"), null);
check("a prefix of a real word: “villanuev” (search finds it)", fixed("villanuev"), null);
check("inside a word, 4+ letters: “ediction” (search finds it in “prediction”)", fixed("ediction"), null);
check("case: “Rice” is a known word", fixed("Rice"), null);
check("too short: “ri”", fixed("ri"), null);
// 3-letter words are never corrected: most are acronyms. With 3 letters
// almost any word is 1 edit from a real one ("GIS" → "gas" before this rule).
const acronymDocs = [study({ title: "Gas leak sensors", abstract: "A lot of ice. The act was passed." })];
const acronymLibrary = buildSmartSearch(acronymDocs);
for (const q of ["GIS", "IoT", "ICT", "gis"]) {
  check(`3 letters, an acronym: “${q}” is never changed (gas, lot, ice, act are 1 edit away)`, fixed(q, acronymLibrary), null);
}
check("4 letters is the shortest corrected word: “firm” → form", fixed("firm"), "form");
check("nothing close: “xylophone”", fixed("xylophone"), null);
check("a very long word: 60 letters", fixed("q".repeat(60)), null);
check("empty query", fixed(""), null);

console.log("\n— Did you mean: no loop —");
for (const q of ["irigation", "machne lerning", "rice irigation", "Isabella", "Acosat", "nino", "Engr. Pagulyan", "machne xylophone"]) {
  const once = fixed(q);
  check(`after picking the fix for “${q}”, none is offered again`, once === null ? "no fix" : fixed(once), once === null ? "no fix" : null);
}

console.log("\n— Search plan: correct at once, offer a button, or nothing —");
// The real search (search.ts BM25F, as the Search screen runs it) over
// `docs`: how many studies a query finds. Passing fewer docs = a filter.
function counter(docs: SearchDoc[]): (q: string) => number {
  const searchIndex = buildIndex(docs);
  return (q: string) => {
    const df = computeDocFreq(tokenize(q), searchIndex);
    let found = 0;
    for (let i = 0; i < docs.length; i++) {
      if (bm25Score(q, docs[i], i, searchIndex, df).score > 0) found++;
    }
    return found;
  };
}
const countAll = counter(library);
const plan = (q: string, count = countAll, exact = false) => searchPlan(index, q, count, { exact });
const modeOf = (q: string, count = countAll, exact = false) => {
  const p = plan(q, count, exact);
  return { query: p.query, mode: p.mode };
};

check("“machne lerning” (0 results, 1 edit each, 5+ letters) → auto-corrected",
  modeOf("machne lerning"), { query: "machine learning", mode: "auto-corrected" });
check("“irigation” (0 results) → auto-corrected", modeOf("irigation"), { query: "irrigation", mode: "auto-corrected" });
check("“Isabella” (0 results) → auto-corrected", modeOf("Isabella"), { query: "isabela", mode: "auto-corrected" });
check("as typed they find 0; corrected they find studies",
  [countAll("machne lerning"), countAll("irigation"), countAll("Isabella"), countAll("machine learning") > 0, countAll("irrigation") > 0, countAll("isabela") > 0],
  [0, 0, 0, true, true, true]);
check("the note shows the fixed words in bold", plan("irigation").correction?.parts,
  [{ text: "irrigation", changed: true, from: "irigation" }]);
check("“rice irigation” (“rice” already finds studies) → suggest (button), typed query searched",
  modeOf("rice irigation"), { query: "rice irigation", mode: "suggest" });
check("“moistrue” (2 edits) → suggest (button)", modeOf("moistrue"), { query: "moistrue", mode: "suggest" });
check("a 4-letter typo, 1 edit: “firm” → suggest (button)", modeOf("firm"), { query: "firm", mode: "suggest" });
check("one safe fix and one 2-edit fix: “machne moistrue” → suggest (every fix must be safe)",
  modeOf("machne moistrue"), { query: "machne moistrue", mode: "suggest" });
const acronymCount = counter(acronymDocs);
for (const q of ["GIS", "IoT", "ICT"]) {
  const p = searchPlan(acronymLibrary, q, acronymCount);
  check(`“${q}” → as-typed, nothing shown`, { query: p.query, mode: p.mode, correction: p.correction }, { query: q, mode: "as-typed", correction: null });
}
for (const q of ["the 2024 eskwela", "rice farming", "machine learning", ""]) {
  const p = plan(q);
  check(`correctly spelled “${q}” → as-typed, nothing shown`, { query: p.query, mode: p.mode, correction: p.correction }, { query: q, mode: "as-typed", correction: null });
}
// A filter that leaves only the 2018 study: "irrigation" finds nothing there.
const only2018 = counter(library.filter(d => d.year === 2018));
check("the correction would also find 0 (filters) → no auto-correct, only the button",
  modeOf("irigation", only2018), { query: "irigation", mode: "suggest" });
const exactPlan = plan("irigation", countAll, true);
check("exact: true (“Search instead for …”) → as-typed, nothing shown",
  { query: exactPlan.query, mode: exactPlan.mode, correction: exactPlan.correction },
  { query: "irigation", mode: "as-typed", correction: null });
let counted = 0;
plan("rice farming", (q: string) => { counted++; return countAll(q); });
check("a correctly spelled query runs no extra search", counted, 0);
for (const q of ["machne lerning", "irigation", "Isabella", "rice irigation", "moistrue", "firm"]) {
  const first = plan(q);
  const next = plan(first.correction?.query ?? q);
  check(`picking the correction for “${q}” never offers a second one`, next.mode, "as-typed");
}

console.log("\n— Timing at 300 synthetic studies —");
// Pseudo-words from a fixed-seed generator, so the run is repeatable.
let seed = 2026;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(xs: T[]): T {
  return xs[Math.floor(random() * xs.length)];
}
const syllables = ["ri", "ce", "so", "il", "ma", "chi", "ne", "lu", "ga", "to", "pa", "lay", "ir", "ra", "tion", "sen", "sor", "da", "ta", "ño"];
const pool: string[] = [];
for (let i = 0; i < 3000; i++) {
  let w = "";
  const parts = 2 + Math.floor(random() * 3);
  for (let p = 0; p < parts; p++) w += pick(syllables);
  pool.push(w);
}
const words = (n: number) => Array.from({ length: n }, () => pick(pool)).join(" ");
const synthetic: SearchDoc[] = [];
for (let i = 0; i < 300; i++) {
  synthetic.push(study({
    title: words(10),
    abstract: `${words(200)}. The study of the ${words(40)}.`,
    keywords: [words(2), words(1), words(3), words(1), words(2)],
    authors: [`${words(1)} ${words(1)}`, `${words(1)} ${words(1)}`],
    adviser: `Dr. ${words(1)} ${words(1)}`,
    year: 2000 + (i % 26),
  }));
}

let t0 = performance.now();
const big = buildSmartSearch(synthetic);
const buildMs = performance.now() - t0;
const vocabSize = big.searchWords.length;

const prefixes = Array.from({ length: 1000 }, () => pick(pool).slice(0, 2 + Math.floor(random() * 4)));
t0 = performance.now();
for (const p of prefixes) autocomplete(big, p);
const perKey = (performance.now() - t0) / prefixes.length;

// A typo: one letter changed somewhere inside a real word.
const typos = Array.from({ length: 100 }, () => {
  const w = pick(pool);
  const at = Math.floor(random() * w.length);
  return w.slice(0, at) + "q" + w.slice(at + 1);
});
t0 = performance.now();
for (const q of typos) didYouMean(big, q);
const perTypo = (performance.now() - t0) / typos.length;

console.log(`      ${synthetic.length} studies, ${vocabSize} distinct words search indexes`);
console.log(`      build once:          ${buildMs.toFixed(1)} ms`);
console.log(`      autocomplete:        ${perKey.toFixed(3)} ms per keystroke (1000 prefixes)`);
console.log(`      did you mean:        ${perTypo.toFixed(3)} ms per query (100 typos)`);
check("build once under 500 ms", buildMs < 500, true);
check("autocomplete under 5 ms per keystroke", perKey < 5, true);
check("did you mean under 50 ms per query (runs after the 300 ms debounce)", perTypo < 50, true);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
