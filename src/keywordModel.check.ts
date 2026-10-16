// Examples for keywordModel.ts. Run with:  node src/keywordModel.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// The studies below are fake, made up for these examples only — never stored anywhere.
import {
  KEYWORD_MODEL, evaluateKeywordModel, extractPhrases, keywordKey, leaveOneOutFolds, predictKeywords,
  suggestKeywords, suggestionSource, trainKeywordModel, type KeywordStudy,
} from "./keywordModel.ts";
import { addKeywords } from "./validation.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

const FISH =
  "Nile tilapia fingerlings were stocked in earthen ponds and fed floating pellets. " +
  "Fish weight, feed conversion and pond water quality were recorded every two weeks.";
const LIBRARY: KeywordStudy[] = [
  { id: "fish1", title: "Tilapia Growth in Earthen Ponds", keywords: ["Aquaculture", "tilapia"], abstract: FISH },
  { id: "fish2", title: "Feeding Rates for Pond Tilapia", keywords: ["aquaculture", "Tilapia"],
    abstract: "Three feeding rates were tested on tilapia in ponds. Fingerlings fed twice a day reached market weight sooner with better feed conversion and clear pond water." },
  { id: "fish3", title: "Fish Pond Water Quality", keywords: ["aquaculture", "Tilapias", "water quality"],
    abstract: "Dissolved oxygen and ammonia in tilapia ponds were logged daily. Fish growth slowed when pond water quality dropped after heavy feeding." },
  { id: "bridge1", title: "Load Testing of a Concrete Footbridge", keywords: ["bridge design", "concrete"],
    abstract: "A reinforced concrete footbridge was loaded with sandbags and its deflection measured with dial gauges. The beams stayed within the code limits." },
  { id: "bridge2", title: "Rebar Corrosion in Coastal Bridges", keywords: ["bridge design", "corrosion"],
    abstract: "Concrete cores from three coastal bridges were tested for chloride. Rebar corrosion was worst where the concrete cover was thinnest." },
  { id: "nokw", title: "Library Reservation App", keywords: [],
    abstract: "Students reserve library books from their phones and get a reminder before the due date." },
];
const NEW_FISH = {
  title: "Stocking Density of Tilapia in Ponds",
  abstract: "Tilapia fingerlings were stocked at two densities in earthen ponds. Fish fed floating pellets grew faster at the lower density, and pond water quality stayed good.",
  keywords: [] as string[],
};

console.log("── Keyword normalisation ──");
check('"Rice", " rice ", "Rices" are one keyword', ["Rice", " rice ", "Rices"].map(keywordKey), ["rice", "rice", "rice"]);
check('"Low-cost Sensors" → "low cost sensor"', keywordKey("Low-cost Sensors"), "low cost sensor");
const model = trainKeywordModel(LIBRARY);
const aqua = model.labels.find(l => l.key === "aquaculture");
check("Aquaculture / aquaculture learned as one keyword from 3 studies", aqua?.studies, 3);
check("…shown in its most used spelling (aquaculture ×2, Aquaculture ×1)", aqua?.keyword, "aquaculture");
const tilapia = model.labels.find(l => l.key === "tilapia");
check("tilapia / Tilapia / Tilapias: one keyword, 3 studies, first spelling kept on a tie", [tilapia?.studies, tilapia?.keyword], [3, "tilapia"]);
check("a study with no keywords is not a training study (5 of 6)", model.n, 5);
check("known keywords (aquaculture, tilapia, water quality, bridge design, concrete, corrosion)", model.labels.length, 6);

console.log("\n── Learned suggestions ──");
const fishSuggestions = suggestKeywords(model, NEW_FISH);
check("a fish-pond abstract gets aquaculture, learned first", fishSuggestions[0]?.key, "aquaculture");
check("…labelled with the studies it was learned from", suggestionSource(fishSuggestions[0]), "learned from 3 studies");
check("bridge keywords are not suggested for it", fishSuggestions.some(s => ["bridge design", "concrete", "corrosion"].includes(s.key)), false);
check("at most 6 suggestions, learned before extracted",
  [fishSuggestions.length <= KEYWORD_MODEL.maxSuggestions, fishSuggestions.findIndex(s => s.source === "abstract") >= fishSuggestions.filter(s => s.source === "learned").length],
  [true, true]);
const bridgeSuggestions = suggestKeywords(model, {
  title: "Deflection of Concrete Bridge Beams", keywords: [],
  abstract: "Concrete beams of two bridges were loaded and their deflection measured. Rebar cover and chloride were tested on cores from each bridge.",
});
check("a bridge abstract gets bridge design and concrete, not aquaculture",
  [bridgeSuggestions.some(s => s.key === "bridge design"), bridgeSuggestions.some(s => s.key === "concrete"), bridgeSuggestions.some(s => s.key === "aquaculture")],
  [true, true, false]);

console.log("\n── Confidence guard (P ≥ 0.9 AND ≥ 5 evidence words) ──");
// Only two words seen in the fish studies, repeated: Naive Bayes is sure, but
// two words are not enough evidence (the my.Eskwela case in docs/15 §4).
const thin = { title: "Tilapia Pond Survey", keywords: [], abstract: "Tilapia pond tilapia pond tilapia pond tilapia pond. Barangay officials answered a survey about permits." };
const thinTop = predictKeywords(model, thin).find(p => p.key === "aquaculture")!;
check("aquaculture: probability ≥ 0.9 …", thinTop.probability >= 0.9, true);
check("… but fewer than 5 evidence words", thinTop.evidence < KEYWORD_MODEL.minEvidence, true);
check("→ not suggested as learned", suggestKeywords(model, thin).filter(s => s.source === "learned").map(s => s.key), []);

console.log("\n── Unseen data → extraction only ──");
const empty = trainKeywordModel([]);
const fromNothing = suggestKeywords(empty, NEW_FISH);
check("empty library: every suggestion comes from the abstract", fromNothing.every(s => s.source === "abstract") && fromNothing.length > 0, true);
check("…labelled 'from this abstract'", suggestionSource(fromNothing[0]), "from this abstract");
const offTopic = suggestKeywords(model, {
  title: "Mobile Library Reservation", keywords: [],
  abstract: "Students reserve library books from their phones. Librarians approve each reservation and students get a reminder before the due date.",
});
check("an off-topic abstract gets no learned keyword", offTopic.filter(s => s.source === "learned").length, 0);

console.log("\n── Never a keyword the study already has, never twice ──");
const has = suggestKeywords(model, { ...NEW_FISH, keywords: ["Aquaculture", "Tilapias"] });
check("existing Aquaculture / Tilapias (any spelling) not suggested", has.some(s => s.key === "aquaculture" || s.key === "tilapia"), false);
check("no keyword suggested twice", new Set(fishSuggestions.map(s => s.key)).size, fishSuggestions.length);
const learnedAndInText = suggestKeywords(model, { ...NEW_FISH, abstract: NEW_FISH.abstract + " Water quality was good." });
check('"water quality" learned and also in the text → once', learnedAndInText.filter(s => s.key === "water quality").length, 1);

console.log("\n── Every chip passes the Keywords box rules ──");
check("each suggestion is accepted by addKeywords() exactly as shown",
  [...fishSuggestions, ...fromNothing].every(s => { const r = addKeywords([], s.keyword); return !r.error && r.list.length === 1 && r.list[0] === s.keyword; }), true);
const longWord = "Agro-silvo-pastoral-hydro-meteorological-socio-economic-assessment";
check("a phrase over 60 characters is never suggested",
  suggestKeywords(empty, { title: "", keywords: [], abstract: `${longWord} frameworks were tested.` }).some(s => s.keyword.length > 60), false);
const badLabels = trainKeywordModel([{ id: "b", title: "Rice", abstract: "Rice farms.", keywords: ["x", "rice, corn", "  "] }]);
check('stored keywords the box would refuse ("x", "rice, corn") are not learned', badLabels.labels.map(l => l.key), []);

console.log("\n── Phrase rules ──");
const phrases = (text: string) => extractPhrases(empty, text).map(p => p.text);
check("hyphenated words kept as written", phrases("Low-cost sensors were installed."), ["Low-cost sensors"]);
check("no phrase across a full stop", phrases("Farmers checked soil moisture. Rice yield rose.").includes("moisture Rice"), false);
check("no phrase across a comma or brackets", phrases("We used sensors, drones (aerial) cameras.").some(p => /sensors drones|drones aerial|aerial cameras/.test(p)), false);
check("no phrase across a spaced dash", phrases("solar pumps - water tanks").includes("pumps water"), false);
check('no phrase of one word twice ("rice rice", "Niño niños", "Rice rices"), compared folded',
  phrases("Rice rice paddies. Niño niños fishing. Rice rices"), ["rice paddies", "niños fishing"]);
check('a common word breaks a phrase ("use of solar pumps" → "solar pumps")', phrases("the use of solar pumps"), ["solar pumps"]);
check("a repeated phrase ranks first, in its first spelling on a tie", phrases("Drip irrigation saves water. Farm owners like drip irrigation.")[0], "Drip irrigation");

console.log("\n── Edit study: never learns from itself ──");
const EDITED: KeywordStudy = { id: "vermi", title: "Vermicompost from Market Waste", keywords: ["vermicompost"],
  abstract: "African nightcrawlers turned market vegetable waste into vermicompost within six weeks." };
const withEdited = [...LIBRARY, EDITED];
const editModel = trainKeywordModel(withEdited, { excludeId: "vermi" });
check("its keyword is not a known keyword", editModel.labels.some(l => l.key === "vermicompost"), false);
check("its words are not in the vocabulary", ["nightcrawler", "vermicompost", "african"].some(w => editModel.df.has(w)), false);
check("so it is not suggested back to it", suggestKeywords(editModel, { ...EDITED, keywords: [] }).some(s => s.source === "learned" && s.key === "vermicompost"), false);
check("without excludeId it would be (the leak this prevents)", trainKeywordModel(withEdited).labels.some(l => l.key === "vermicompost"), true);

console.log("\n── Leave-one-out: nothing of the tested study is learned ──");
const COPY: KeywordStudy = { ...LIBRARY[0], id: "fish1-copy", title: "Tilapia Growth in Earthen Ponds (copy)" };
const lib = [...LIBRARY, EDITED, COPY];
const folds = leaveOneOutFolds(lib);
check("one fold per study with keywords (7 of 8)", folds.length, 7);
const leaks = folds.filter(f => {
  const m = trainKeywordModel(f.training);
  const own = new Set(f.test.abstract.toLowerCase().match(/\p{L}+/gu));
  const others = new Set(f.training.flatMap(s => `${s.title} ${s.abstract}`.toLowerCase().match(/\p{L}+/gu) ?? []));
  const onlyInTest = [...own].filter(w => !others.has(w) && m.df.has(w));
  return f.training.some(s => s.id === f.test.id) || onlyInTest.length > 0;
});
check("no fold trains on its test study or has its own words in vocabulary/df", leaks.map(f => f.test.id), []);
const vermiFold = folds.find(f => f.test.id === "vermi")!;
const vermiModel = trainKeywordModel(vermiFold.training);
check("…e.g. the vermicompost fold: not in df, not a label",
  [vermiModel.df.has("vermicompost"), vermiModel.df.has("nightcrawler"), vermiModel.labels.some(l => l.key === "vermicompost")], [false, false, false]);
check("a near-copy is hidden with its original", folds.find(f => f.test.id === "fish1")?.copies, ["fish1-copy"]);
check("plain leave-one-out keeps the copy", leaveOneOutFolds(lib, { hideNearCopies: false }).find(f => f.test.id === "fish1")?.copies, []);
const ev = evaluateKeywordModel(lib);
check("evaluation: 7 tested, 2 copies hidden (fish1 and its copy)", [ev.tested, ev.copiesHidden], [7, 2]);
check("a keyword used on only one study cannot be learned when that study is tested (vermicompost)",
  suggestKeywords(vermiModel, { ...EDITED, keywords: [] }).some(s => s.source === "learned"), false);
check("scores are fractions 0–1",
  [ev.model.hitRate, ev.model.precision, ev.model.recall, ev.baseline.hitRate, ev.baseline.precision, ev.baseline.recall].every(x => x >= 0 && x <= 1), true);
// Three rice studies with different words: the baseline always suggests "rice"
// (the only keyword it knows), so it is right every time — checkable by hand.
const RICE: KeywordStudy[] = [
  { id: "r1", title: "Rice Seed Storage", keywords: ["rice"], abstract: "Seed kept in sealed jars stayed viable longer." },
  { id: "r2", title: "Rice Straw Mushrooms", keywords: ["Rice"], abstract: "Straw beds grew oyster mushrooms in four weeks." },
  { id: "r3", title: "Rice Hull Ash Bricks", keywords: ["rices"], abstract: "Hull ash replaced part of the cement in bricks." },
];
check("baseline on three rice studies: 3/3 correct, precision 1, recall 1",
  evaluateKeywordModel(RICE).baseline, { hitRate: 1, precision: 1, recall: 1 });

console.log("\n── Empty library is safe ──");
check("train on nothing", [empty.n, empty.labels.length, empty.df.size], [0, 0, 0]);
check("suggest for an empty draft", suggestKeywords(empty, { title: "", abstract: "", keywords: [] }), []);
check("evaluate nothing", evaluateKeywordModel([]), {
  tested: 0, copiesHidden: 0, model: { hitRate: 0, precision: 0, recall: 0 }, baseline: { hitRate: 0, precision: 0, recall: 0 },
});

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
