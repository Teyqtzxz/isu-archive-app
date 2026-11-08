// Examples for keywordModel.ts. Run with:  node src/keywordModel.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// The studies below are fake, made up for these examples only — never stored anywhere.
import {
  KEYWORD_MODEL, autoKeywordRoom, autoKeywords, evaluateKeywordModel, extractPhrases, findNearCopies, isAdverb,
  keywordKey, leaveOneOutFolds, phraseCount, predictKeywords, suggestKeywords, suggestionSource, trainKeywordModel,
  type KeywordStudy,
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

console.log("\n── Learned suggestions (30-study rule off: this library has 5) ──");
/** The model itself, without the Register form's reliableFrom rule. */
const LEARN = { learnedFrom: 0 };
const fishSuggestions = suggestKeywords(model, NEW_FISH, LEARN);
check("a fish-pond abstract gets aquaculture, learned first", fishSuggestions[0]?.key, "aquaculture");
check("…labelled with the studies it was learned from", suggestionSource(fishSuggestions[0]), "learned from 3 studies");
check("bridge keywords are not suggested for it", fishSuggestions.some(s => ["bridge design", "concrete", "corrosion"].includes(s.key)), false);
check("at most 6 suggestions, learned before extracted",
  [fishSuggestions.length <= KEYWORD_MODEL.maxSuggestions, fishSuggestions.findIndex(s => s.source === "abstract") >= fishSuggestions.filter(s => s.source === "learned").length],
  [true, true]);
const bridgeSuggestions = suggestKeywords(model, {
  title: "Deflection of Concrete Bridge Beams", keywords: [],
  abstract: "Concrete beams of two bridges were loaded and their deflection measured. Rebar cover and chloride were tested on cores from each bridge.",
}, LEARN);
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
check("→ not suggested as learned", suggestKeywords(model, thin, LEARN).filter(s => s.source === "learned").map(s => s.key), []);

console.log("\n── Unseen data → extraction only ──");
const empty = trainKeywordModel([]);
const fromNothing = suggestKeywords(empty, NEW_FISH);
check("empty library: every suggestion comes from the abstract", fromNothing.every(s => s.source === "abstract") && fromNothing.length > 0, true);
check("…labelled 'from this abstract'", suggestionSource(fromNothing[0]), "from this abstract");
const offTopic = suggestKeywords(model, {
  title: "Mobile Library Reservation", keywords: [],
  abstract: "Students reserve library books from their phones. Librarians approve each reservation and students get a reminder before the due date.",
}, LEARN);
check("an off-topic abstract gets no learned keyword", offTopic.filter(s => s.source === "learned").length, 0);

console.log("\n── Never a keyword the study already has, never twice ──");
const has = suggestKeywords(model, { ...NEW_FISH, keywords: ["Aquaculture", "Tilapias"] }, LEARN);
check("existing Aquaculture / Tilapias (any spelling) not suggested", has.some(s => s.key === "aquaculture" || s.key === "tilapia"), false);
check("no keyword suggested twice", new Set(fishSuggestions.map(s => s.key)).size, fishSuggestions.length);
const learnedAndInText = suggestKeywords(model, { ...NEW_FISH, abstract: NEW_FISH.abstract + " Water quality was good." }, LEARN);
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

console.log("\n── Each word counts once per study ──");
const REPEAT: KeywordStudy[] = [
  { id: "rep1", title: "Goat Feed", keywords: ["goat"], abstract: "Napier napier napier napier napier napier napier napier grass fed goats." },
  { id: "rep2", title: "Goat Shelter", keywords: ["goat"], abstract: "Raised slatted floors kept goats dry during rain." },
];
const repModel = trainKeywordModel(REPEAT);
check("a word written 8 times in one study counts 1 (napier)", repModel.labels[0].counts.get("napier"), 1);
check("…and df is that word count: studies having it", [repModel.df.get("napier"), repModel.df.get("goat")], [1, 2]);
check("the words total counts each word once per study", repModel.total, [...repModel.df.values()].reduce((a, b) => a + b, 0));
const once = predictKeywords(model, { title: "", abstract: "Tilapia ponds." })[0];
const many = predictKeywords(model, { title: "", abstract: "Tilapia tilapia tilapia tilapia tilapia ponds ponds ponds." })[0];
check("repeating words in the new study does not raise the probability", [many.key, many.probability], [once.key, once.probability]);

console.log("\n── Near-copies count as one training study ──");
const withCopy = [...LIBRARY, { ...LIBRARY[0], id: "fish1-again" }];
const copyModel = trainKeywordModel(withCopy);
check("a copy of fish1: still 5 training studies, 1 copy merged", [copyModel.n, copyModel.copiesMerged], [5, 1]);
check("aquaculture is still learned from 3 studies, not 4", copyModel.labels.find(l => l.key === "aquaculture")?.studies, 3);
check("the copy (same title and abstract) changes no word count", [...copyModel.df].join(), [...model.df].join());
check("findNearCopies finds it both ways", [findNearCopies(withCopy).get("fish1"), findNearCopies(withCopy).get("fish1-again")], [["fish1-again"], ["fish1"]]);
// a and b are each a copy of e, but not of each other: leaving e out (Edit e) keeps a and b apart.
const chain: KeywordStudy[] = ["a", "b", "e"].map(id => ({ id, title: `Study ${id}`, keywords: [`kw ${id}`], abstract: `Words of study ${id}.` }));
const chainLinks = new Map([["a", ["e"]], ["b", ["e"]], ["e", ["a", "b"]]]);
check("a study left out never joins two others", [trainKeywordModel(chain, { nearCopies: chainLinks }).n, trainKeywordModel(chain, { nearCopies: chainLinks, excludeId: "e" }).n], [1, 2]);
check("near-copies without keywords change nothing", trainKeywordModel([...LIBRARY, { ...LIBRARY[0], id: "x", keywords: [] }]).n, 5);

console.log("\n── Learned keywords on the Register form only from 30 studies with keywords ──");
// Distinct made-up studies: shared topic words, then words of their own, so no two are near-copies.
const own = (i: number, k: number) => Array.from({ length: k }, (_, j) => `zq${i}x${j}`).join(" ");
const fishStudy = (i: number): KeywordStudy => ({ id: `f${i}`, title: `Pond study ${own(i, 2)}`, keywords: ["aquaculture"],
  abstract: `Tilapia fingerlings in earthen ponds were fed floating pellets and pond water quality was logged. ${own(i, 30)}.` });
const roadStudy = (i: number): KeywordStudy => ({ id: `r${i}`, title: `Road study ${own(100 + i, 2)}`, keywords: ["road safety"],
  abstract: `Traffic counts at a barangay crossing were taken before and after speed humps were built. ${own(100 + i, 30)}.` });
const libraryOf = (n: number) => Array.from({ length: n }, (_, i) => (i % 2 ? roadStudy(i) : fishStudy(i)));
const learnedKeys = (lib: KeywordStudy[]) => suggestKeywords(trainKeywordModel(lib), NEW_FISH).filter(s => s.source === "learned").map(s => s.key);
check("reliableFrom is 30", KEYWORD_MODEL.reliableFrom, 30);
check("29 studies with keywords: no learned suggestion", learnedKeys(libraryOf(29)), []);
check("30 studies with keywords: aquaculture is suggested, learned", learnedKeys(libraryOf(30)), ["aquaculture"]);
check("…and added automatically", autoKeywords(trainKeywordModel(libraryOf(30)), NEW_FISH).filter(s => s.source === "learned").map(s => s.key), ["aquaculture"]);
check("29 studies + an exact copy of one = 30 stored, but 29 count: still none",
  learnedKeys([...libraryOf(29), { ...fishStudy(0), id: "f0-copy" }]), []);
check("29 studies + 1 with no keywords: still none", learnedKeys([...libraryOf(29), { ...fishStudy(99), keywords: [] }]), []);
check("the Statistics card's test is not held back by the rule (learnedFrom 0)",
  suggestKeywords(trainKeywordModel(libraryOf(29)), NEW_FISH, LEARN).some(s => s.key === "aquaculture"), true);

console.log("\n── Learned keywords cannot crowd out the abstract ──");
const FIVE_KW = ["aquaculture", "tilapia", "fish pond", "pond water", "fish feed"];
const richLib = Array.from({ length: 30 }, (_, i) => (i % 2 ? roadStudy(i) : { ...fishStudy(i), keywords: FIVE_KW }));
const richModel = trainKeywordModel(richLib);
check("the model would offer all 5 fish keywords",
  predictKeywords(richModel, NEW_FISH).filter(p => p.probability >= KEYWORD_MODEL.minProbability && p.evidence >= KEYWORD_MODEL.minEvidence).length, 5);
const richSuggestions = suggestKeywords(richModel, NEW_FISH);
check("suggestions: at most 3 learned of 6, the rest from the abstract",
  [richSuggestions.filter(s => s.source === "learned").length, richSuggestions.length], [3, 6]);
const richAuto = autoKeywords(richModel, NEW_FISH);
check("added automatically: at most 2 learned, first; the abstract's phrases fill the other 3 places (errata #79)",
  richAuto.map(s => s.source), ["learned", "learned", "abstract", "abstract", "abstract"]);

console.log("\n── How many are added automatically ──");
check("printed 0, 1, 3, 4, 5, 7, 8, 9, 10 → added 5, 5, 5, 4, 3, 1, 0, 0, 0",
  [0, 1, 3, 4, 5, 7, 8, 9, 10].map(autoKeywordRoom), [5, 5, 5, 4, 3, 1, 0, 0, 0]);
check("settings: at most 5, never past 8 in all", [KEYWORD_MODEL.autoMax, KEYWORD_MODEL.autoTotal], [5, 8]);
const RICH = "Farmers in Isabela tested drip irrigation on hybrid corn. Drip irrigation saved water on every farm. " +
  "Soil moisture sensors told farmers when to water, and soil moisture sensors cost less each year. Hybrid corn yields " +
  "rose where soil moisture stayed high. Crop insurance and farm credit helped small farmers buy the sensors. Crop " +
  "insurance also covered typhoon losses, and farm credit came from the cooperative. Market prices for hybrid corn stayed " +
  "stable, and market prices for fertilizer fell.";
const printed = (k: number) => ["alpha keyword", "beta keyword", "gamma keyword", "delta keyword", "epsilon keyword",
  "zeta keyword", "eta keyword", "theta keyword", "iota keyword", "kappa keyword"].slice(0, k);
for (const k of [0, 3, 4, 5, 6, 7, 8, 10]) {
  const got = autoKeywords(empty, { title: "", abstract: RICH, keywords: printed(k) });
  check(`${k} printed keywords → ${autoKeywordRoom(k)} added, none of them already there, all from the abstract`,
    [got.length, got.some(s => printed(k).map(keywordKey).includes(s.key)), got.every(s => s.source === "abstract")], [autoKeywordRoom(k), false, true]);
}
const first = autoKeywords(empty, { title: "", abstract: RICH, keywords: [] });
const richOrder = suggestKeywords(empty, { title: "", abstract: RICH, keywords: [] }, { limit: 20 }).map(s => s.key);
check("the best phrases are added, in the order shown as suggestions (skipping an overlapping one: soil moisture sensors)",
  [first.map(s => s.key), first.every((s, i) => i === 0 || richOrder.indexOf(s.key) > richOrder.indexOf(first[i - 1].key))],
  [["hybrid corn", "soil moisture", "farm credit", "drip irrigation", "crop insurance"], true]);
const removedTwo = [first[0].key, first[2].key];
const again = autoKeywords(empty, { title: "", abstract: RICH, keywords: [] }, removedTwo);
check("removed ones are never added again; the next ones fill their places: market price (seen twice), then sensor cost (seen once)",
  [again.map(s => s.key), again.map(s => phraseCount({ title: "", abstract: RICH }, s.key)), again.some(s => removedTwo.includes(s.key))],
  [["soil moisture", "drip irrigation", "crop insurance", "market price", "sensor cost"], [3, 2, 2, 2, 1], false]);
check("…but stay available as suggestions to click (the undo)",
  removedTwo.every(k => suggestKeywords(empty, { title: "", abstract: RICH, keywords: [] }).some(s => s.key === k)), true);
check("each added keyword passes the Keywords box rules as shown",
  first.every(s => { const r = addKeywords([], s.keyword); return !r.error && r.list[0] === s.keyword; }), true);
check("nothing to add from an empty abstract", autoKeywords(empty, { title: "", abstract: "", keywords: [] }), []);

console.log("\n── Junk phrases (made-up abstracts with the patterns found in real theses) ──");
const NURSING = "Filipino nurses in public hospitals were surveyed about heart failure care. Nurses should receive " +
  "training on heart failure. Participants reported long shifts. Older adults with heart failure were often readmitted. " +
  "Filipino nurses providing quality care to older adults asked for more staff.";
const COAST = "Climate change threatens coastal towns. The team measured plastic pollution on beaches and the waste " +
  "management of each town. Residents with knowledge along the coast sorted specific plastic types. Marine plastic " +
  "pollution was worst near the river, and towns that reduce plastic pollution had better waste management. Climate change " +
  "and plastic pollution were linked.";
const OFFICE = "The data center keeps a record of every visitor. The proponent excluded paper forms. A document management " +
  "system now stores documents internally. The process involves scanning each form, and the project implements a use case " +
  "suite and a test case suite. Staff who handle projects schedule during weekends. The data center and document management " +
  "modules were tested.";
const allPhrases = [NURSING, COAST, OFFICE].flatMap(a => extractPhrases(empty, a).map(p => p.text.toLowerCase()));
const JUNK = ["schedule during", "knowledge along", "process involves", "project implements", "handle projects",
  "nurses should", "participants reported", "proponent excluded", "providing quality", "documents internally",
  "specific plastic", "case suite"];
// Not even inside a longer term ("nurses should receive"); "test case suite" is a fine term, so "case suite" is checked alone.
for (const j of JUNK) check(`"${j}" is not offered${j === "case suite" ? "" : ", alone or inside a longer term"}`,
  allPhrases.filter(p => (j === "case suite" ? p === j : ` ${p} `.includes(` ${j} `))), []);
const GOOD = ["climate change", "heart failure", "older adults", "data center", "document management", "plastic pollution",
  "waste management", "filipino nurses"];
for (const g of GOOD) check(`"${g}" is still offered`, allPhrases.includes(g), true);
check("and they are among the suggestions", ["filipino nurses", "heart failure", "older adults"].every(g =>
  suggestKeywords(empty, { title: "", abstract: NURSING, keywords: [] }).some(s => s.keyword.toLowerCase() === g)), true);
check("words like family, supply, elderly, early still make phrases",
  phrases("Family planning, supply chain, elderly patients and early detection."),
  ["Family planning", "supply chain", "elderly patients", "early detection"]);
check("so do applied mathematics, nursing care, learning management, data mining",
  phrases("applied mathematics; nursing care; learning management; data mining"),
  ["applied mathematics", "nursing care", "learning management", "data mining"]);
check("adverbs: internally, significantly, particularly, possibly yes; family, assembly, monthly no",
  ["internally", "significantly", "particularly", "possibly", "family", "assembly", "monthly"].map(isAdverb),
  [true, true, true, true, false, false, false]);
check('a page number is no word: "xiii Nurse-Patient interaction"', phrases("xiii Nurse-Patient interaction"), ["Nurse-Patient interaction"]);
const team = phrases("The heart failure team NLI-HFTP met. Heart failure patients and the heart failure team NLI-HFTP agreed.").map(p => p.toLowerCase());
check('a tail with the same word in front and a word after it is dropped, not made longer: no "failure team" in any term; "heart failure" stays',
  [team.some(p => p.includes("failure team")), team.includes("heart failure")], [false, true]);
check("a past form may start a phrase but not end one", phrases("Perceived stress. Nurses reported."), ["Perceived stress"]);
check('…and not right after a noun, where it is the verb ("irrigation saved water", "prices stayed stable")',
  phrases("Drip irrigation saved water. Corn prices stayed stable. The integrated farming.").sort(),
  ["Corn prices", "Drip irrigation", "integrated farming"]);
check('"use case" stays one term: no phrase starts on its "case"', phrases("A use case suite."), []);

console.log("\n── Three-word terms ──");
const TPB = "Perceived behavioral control predicted intention. Attitude and perceived behavioral control were " +
  "measured, and perceived behavioral control was the strongest predictor of intention.";
const tpb = phrases(TPB).map(p => p.toLowerCase());
check('"perceived behavioral" + "behavioral control" → one term "perceived behavioral control"',
  [tpb.includes("perceived behavioral control"), tpb.includes("perceived behavioral"), tpb.includes("behavioral control")], [true, false, false]);
check("…offered once", tpb.filter(p => p === "perceived behavioral control").length, 1);
const marineReduce = phrases("Marine plastic pollution harms reefs. Towns that reduce plastic pollution save fish.").map(p => p.toLowerCase());
check('"plastic pollution" after "marine" and after "reduce" stays a phrase', marineReduce.includes("plastic pollution"), true);
const twoAdjectives = phrases("Marine plastic pollution harms reefs. Coastal plastic pollution harms towns.").map(p => p.toLowerCase());
check('"plastic pollution" after two different adjectives stays a phrase', twoAdjectives.includes("plastic pollution"), true);
check("…and no three-word term is made of it: each appears once, or always between other words",
  ["marine plastic pollution", "coastal plastic pollution", "plastic pollution harms"].map(p => twoAdjectives.includes(p)),
  [false, false, false]);
check('"plastic pollution" with the same word after it every time but different words in front stays',
  phrases("Marine plastic pollution harms reefs. Coastal plastic pollution harms towns.").map(p => p.toLowerCase()).includes("plastic pollution"), true);
const adaptation = phrases("Students joined climate change adaptation. Climate change worried them, so climate change adaptation became a club.").map(p => p.toLowerCase());
check('"change adaptation", always after "climate", becomes "climate change adaptation"; "climate change" stays',
  [adaptation.includes("climate change adaptation"), adaptation.includes("change adaptation"), adaptation.includes("climate change")], [true, false, true]);
const longTerm = "The bioremediation-assisted phytoremediation-enhanced groundwater. Bioremediation-assisted phytoremediation-enhanced groundwater worked.";
const longOut = phrases(longTerm).map(p => p.toLowerCase());
check("a three-word term over 60 characters is not offered, only its stronger part",
  [longOut.some(p => p.split(" ").length === 3 && p.includes("groundwater") && p.startsWith("bioremediation")),
    ["bioremediation-assisted phytoremediation-enhanced", "phytoremediation-enhanced groundwater"].filter(p => longOut.includes(p)).length],
  [false, 1]);

console.log("\n── Review round 2: verb forms that are part of real terms ──");
const lost = (text: string) => phrases(text).map(p => p.toLowerCase());
const wq = lost("A water quality monitoring system was built. The water quality monitoring system logs pH every hour.");
check('"water quality monitoring system" gives "water quality" and "monitoring system", not its middle',
  ["water quality", "monitoring system", "quality monitoring", "water quality monitoring"].map(p => wq.includes(p)), [true, true, false, false]);
check('"Real-time monitoring" (an -ing word may end a phrase)', lost("Real-time monitoring of soil moisture is shown."), ["real-time monitoring", "soil moisture"]);
check('"automated attendance system" (seen twice)',
  lost("The automated attendance system uses RFID. Teachers liked the automated attendance system.").includes("automated attendance system"), true);
check('"Reduced tillage", "improved varieties" (an -ed word may start a phrase)',
  ["reduced tillage", "improved varieties"].map(p => lost("Reduced tillage cut costs. The improved varieties yielded more.").includes(p)), [true, true]);
check('a report verb\'s -ing form after a preposition or a plural noun is a verb: no "providing quality", "mitigating plastic", "nurses providing", "monitoring water"',
  lost("Nurses were skilled in providing quality care. Towns helped in mitigating plastic pollution. Filipino nurses providing care were tired. A kit for monitoring water quality was made.")
    .filter(p => /providing quality|mitigating plastic|nurses providing|monitoring water/.test(p)), []);
check('…also when it appears twice, as in a real thesis ("in providing quality care" ×2 must not become a term)',
  lost("Staff were trained in providing quality care. The award went to clinics skilled in providing quality care.")
    .filter(p => p.includes("providing")), []);
check('its base and -s forms stay out: "handle projects", "process involves"',
  lost("Staff handle projects. The process involves scanning.").filter(p => /handle projects|process involves/.test(p)), []);
check('"this study assessed students": after a noun similarity drops, an -ed word is a verb too',
  lost("This study assessed students in two schools.").includes("assessed students"), false);
check('"practiced reduced tillage": right after another -ed word an -ed word may start a phrase',
  lost("Farmers practiced reduced tillage.").includes("reduced tillage"), true);

console.log("\n── Review round 2: three-word terms only when seen twice ──");
check('seen once: "measure water temperature" → only the stronger pair, the right-hand one on a tie',
  lost("The kit can measure water temperature."), ["water temperature"]);
check('…and inside a longer chain ("Sensors measure water temperature") its middle "measure water" is dropped',
  ["water temperature", "measure water", "measure water temperature"].map(p => lost("Sensors measure water temperature every hour.").includes(p)), [true, false, false]);
check('"system sends SMS", "helps fish farmers", "records student attendance" seen once are no terms',
  lost("The system sends SMS alerts. Real-time data helps fish farmers act. The reader records student attendance daily.")
    .filter(p => p.split(" ").length === 3), []);
check('"perceived behavioral control" twice is still one term', tpb.filter(p => p === "perceived behavioral control").length, 1);

console.log("\n── Review round 2: no overlapping automatic keywords ──");
const NPI = "Nurse-patient interaction was observed in a skilled nursing facility. Nurse-patient interaction lowered rehospitalization. " +
  "Patient interaction time was logged, and patient interaction rose after training.";
const npiAuto = autoKeywords(empty, { title: "", abstract: NPI, keywords: [] }).map(s => s.key);
const npiChips = suggestKeywords(empty, { title: "", abstract: NPI, keywords: npiAuto }).map(s => s.key);
check('"nurse-patient interaction" and "patient interaction" are never both added; the other stays a chip',
  [npiAuto.includes("nurse patient interaction") !== npiAuto.includes("patient interaction"),
    npiChips.includes("nurse patient interaction") || npiChips.includes("patient interaction")], [true, true]);
const coastAuto = autoKeywords(empty, { title: "", abstract: COAST, keywords: ["Marine Plastic Pollution"] }).map(s => s.key);
check('nothing inside a printed keyword is added: "plastic pollution" with "Marine Plastic Pollution" listed (it stays a chip)',
  [coastAuto.includes("plastic pollution"),
    suggestKeywords(empty, { title: "", abstract: COAST, keywords: ["Marine Plastic Pollution", ...coastAuto] }).some(s => s.key === "plastic pollution")],
  [false, true]);

console.log("\n── Review round 2: made-up ISU capstone abstracts ──");
/** Made-up abstracts in the style of ISU undergraduate capstones (no real study's text),
 *  each with terms it must give and junk it must not (errata #77, review round 2). */
const CAPSTONES: { id: string; title: string; abstract: string; must: string[]; not: string[] }[] = [
  { id: "iot-water", title: "IoT-Based Water Quality Monitoring System for Tilapia Ponds",
    abstract: "This capstone developed an IoT-based water quality monitoring system for tilapia ponds in Echague, Isabela. Sensors measure water temperature, pH and dissolved oxygen every five minutes. When a reading goes out of range, the system sends SMS alerts to the fish farmers. The water quality monitoring system was tested for thirty days in two ponds. Real-time monitoring helps fish farmers act before fish kills happen. Fish farmers rated the system highly for usefulness and ease of use.",
    must: ["water quality", "monitoring system", "Real-time monitoring", "dissolved oxygen", "SMS alerts", "fish farmers"],
    not: ["measure water temperature", "system sends SMS", "helps fish farmers", "measure water", "helps fish", "water quality monitoring", "quality monitoring"] },
  { id: "rfid", title: "Automated Attendance System Using RFID for ISU Classrooms",
    abstract: "This study developed an automated attendance system using RFID cards for Isabela State University classrooms. Each student taps an RFID card on a reader at the door, and the system records student attendance in a cloud database. Teachers view attendance reports on a web dashboard. The automated attendance system cut the time spent on roll calls from ten minutes to one minute per class. The system kept attendance records accurate and complete in the test sessions. Teachers and students rated the automated attendance system as easy to use.",
    must: ["automated attendance system", "attendance reports", "web dashboard", "cloud database", "student attendance", "RFID cards"],
    not: ["records student attendance", "attendance records accurate", "system records student", "records student"] },
  { id: "inventory", title: "Web-Based Inventory Management System for a Hardware Store",
    abstract: "This capstone built a web-based inventory management system for a hardware store in Cauayan City. The inventory management system tracks stock levels, records every sale and warns the owner when an item runs low. Barcode scanning speeds up the point-of-sale process. Before the system, the store counted stock by hand once a month and often ran out of fast-moving items. After three months of use, stock-outs dropped and monthly sales reports took minutes instead of days.",
    must: ["inventory management system", "stock levels", "hardware store"],
    not: ["system tracks stock", "records every sale", "system tracks"] },
  { id: "pos", title: "Mobile Point-of-Sale Application for Sari-Sari Stores",
    abstract: "A mobile point-of-sale application was developed for sari-sari stores in Ilagan. Store owners record sales, track customer credit and print receipts with a Bluetooth printer. The application works offline and syncs sales data when the phone connects to the internet. Twenty store owners tested the mobile application for two weeks. Most owners said the application helps store owners keep track of customer credit.",
    must: ["sari-sari stores", "customer credit", "sales data", "Bluetooth printer", "store owners"],
    not: ["helps store owners", "owners record sales", "helps store"] },
  { id: "enrollment", title: "Web-Based Enrollment System for a Private High School",
    abstract: "This study designed a web-based enrollment system for a private high school in Santiago City. Students fill in the online enrollment form, upload their report cards and pay fees through the system. The registrar approves each enrollment, and the system generates class lists automatically. The web-based enrollment system shortened the enrollment period from two weeks to three days and removed long queues at the registrar office.",
    must: ["web-based enrollment system", "class lists", "enrollment period", "registrar office"],
    not: ["system generates class", "generates class lists"] },
  { id: "tillage", title: "Reduced Tillage and Organic Fertilizer in Lowland Rice",
    abstract: "Reduced tillage and organic fertilizer were compared with conventional tillage and inorganic fertilizer in lowland rice fields in San Mateo, Isabela. Farmers who practiced reduced tillage saved fuel and labor. Rice yield under reduced tillage with organic fertilizer was similar to conventional practice after two seasons, while soil organic matter increased. The study recommends reduced tillage for small rice farms with access to organic fertilizer.",
    must: ["reduced tillage", "organic fertilizer", "conventional tillage", "organic matter"],
    not: ["practiced reduced", "tillage saved"] },
  { id: "corn", title: "Improved Corn Varieties under Integrated Pest Management",
    abstract: "Improved varieties of yellow corn were tested with integrated pest management in Cabagan. The improved varieties gave higher grain yield than the local variety. Fall armyworm damage was lower in plots under integrated pest management. Farmers selected improved varieties that matured early and resisted lodging.",
    must: ["improved varieties", "integrated pest management", "grain yield"],
    not: ["selected improved", "varieties gave"] },
  { id: "tilapia", title: "Feeding Rates for Nile Tilapia Fingerlings in Earthen Ponds",
    abstract: "This study compared three feeding rates for Nile tilapia fingerlings in earthen ponds. Fish fed twice a day grew faster and had better feed conversion than fish fed once a day. Water quality stayed within safe limits for all feeding rates. The results help tilapia farmers in Isabela lower their feed costs.",
    must: ["feeding rates", "feed conversion", "water quality", "earthen ponds", "feed costs"],
    not: ["help tilapia farmers", "help tilapia"] },
  { id: "forestry", title: "Seedling Survival of Native Trees in a Sierra Madre Reforestation Site",
    abstract: "Seedling survival of three native tree species was measured in a reforestation site in the Sierra Madre. Narra seedlings had the highest survival rate after one year, followed by molave and kamagong. Seedlings planted with mulch survived better during the dry season. The study recommends native tree species and mulching for reforestation projects in Isabela.",
    must: ["native tree species", "survival rate", "seedling survival", "reforestation site"],
    not: ["seedlings planted", "mulch survived"] },
  { id: "nursing", title: "Hand Hygiene Compliance of Nursing Students during Clinical Duty",
    abstract: "This descriptive study assessed the hand hygiene compliance of nursing students during clinical duty in a tertiary hospital. Nursing students showed high knowledge of hand hygiene but lower compliance during busy shifts. Students cited lack of time and skin irritation as barriers. Nurse educators should include hand hygiene audits in clinical training.",
    must: ["hand hygiene", "nursing students", "clinical duty", "tertiary hospital"],
    not: ["educators should", "students cited", "students showed"] },
  { id: "reading", title: "Game-Based Learning and Reading Comprehension of Grade 4 Pupils",
    abstract: "This action research examined the effect of game-based learning on the reading comprehension of Grade 4 pupils in a public elementary school. Pupils who played reading games for eight weeks scored higher in the post-test than pupils taught with the usual lessons. Teachers observed better attention and participation in class. Game-based learning is recommended for improving reading comprehension in the early grades.",
    must: ["game-based learning", "reading comprehension", "elementary school", "reading games"],
    not: ["pupils taught", "improving reading", "teachers observed"] },
  { id: "hollow-blocks", title: "Rice Husk Ash as Partial Cement Replacement in Concrete Hollow Blocks",
    abstract: "Rice husk ash was used as a partial replacement for cement in concrete hollow blocks. Blocks with 10 percent rice husk ash reached the compressive strength required for non-load-bearing walls. Higher replacement levels lowered the compressive strength. Using rice husk ash cuts cement use and gives the waste of rice farms a new use.",
    must: ["rice husk ash", "compressive strength", "hollow blocks", "partial replacement"],
    not: ["ash cuts cement", "levels lowered", "ash cuts"] },
  { id: "milk-tea", title: "Social Media Marketing and the Sales of Milk Tea Shops in Tuguegarao City",
    abstract: "This study looked at the effect of social media marketing on the sales of milk tea shops in Tuguegarao City. Shop owners who posted daily on Facebook reported higher monthly sales than owners who posted weekly. Customers said online promos and photos influenced their buying decisions. Small businesses are encouraged to plan regular social media posts.",
    must: ["social media", "monthly sales", "buying decisions", "shop owners"],
    not: ["owners who", "photos influenced"] },
  { id: "greenhouse", title: "Automated Irrigation System for a Vegetable Greenhouse",
    abstract: "An automated irrigation system with soil moisture sensors was built for a vegetable greenhouse. The automated irrigation system waters the plants only when the soil moisture drops below a set level. Real-time monitoring of soil moisture is available on a mobile app. Water use fell by 40 percent compared with manual watering.",
    must: ["automated irrigation system", "soil moisture", "Real-time monitoring", "manual watering"],
    not: ["moisture drops", "irrigation system waters"] },
];
for (const c of CAPSTONES) {
  const offered = extractPhrases(empty, c.abstract).map(p => p.text.toLowerCase());
  const added = autoKeywords(empty, { title: c.title, abstract: c.abstract, keywords: [] }).map(s => s.key);
  check(`${c.id}: gives ${c.must.join(", ")}`, c.must.filter(m => !offered.includes(m.toLowerCase())), []);
  check(`${c.id}: no ${c.not.join(", ")}`, c.not.filter(n => offered.some(p => ` ${p} `.includes(` ${n.toLowerCase()} `))), []);
  const twice = added.map(k => phraseCount(c, k) >= 2);
  check(`${c.id}: 5 added (the room is full), those seen twice before any seen once, none inside another`,
    [added.length, twice.every((t, i) => i === 0 || !t || twice[i - 1]), added.some((a, i) => added.some((b, j) => i !== j && ` ${b} `.includes(` ${a} `)))],
    [5, true, false]);
}
// Round 3: the junk the review found among the automatic keywords, each seen once.
const AUTO_JUNK: [string, string][] = [["iot-water", "system sends"], ["rfid", "system records"], ["enrollment", "registrar approves"],
  ["greenhouse", "system waters"], ["greenhouse", "set level"], ["milk-tea", "posted daily"], ["hollow-blocks", "percent rice"],
  ["nursing", "lower compliance"]];
// Errata #79: they may come back as fillers (staff remove them), but only after every phrase seen twice.
check("round 3 junk, seen once, is added only in the room left after the phrases seen twice: with room for just those, none of it",
  AUTO_JUNK.filter(([id, k]) => { const c = CAPSTONES.find(x => x.id === id)!;
    const repeated = autoKeywords(empty, { title: c.title, abstract: c.abstract, keywords: [] }).filter(s => phraseCount(c, s.key) >= 2).length;
    const kw = printed(KEYWORD_MODEL.autoTotal - repeated);
    return autoKeywords(empty, { title: c.title, abstract: c.abstract, keywords: kw }).some(s => s.key === keywordKey(k)); }), []);
const MAIN_TERMS: [string, string][] = [["iot-water", "monitoring system"], ["tillage", "reduced tillage"], ["rfid", "automated attendance system"],
  ["corn", "improved varieties"], ["nursing", "hand hygiene"], ["reading", "reading comprehension"], ["hollow-blocks", "rice husk ash"]];
check("…while the main terms, which repeat, still are",
  MAIN_TERMS.filter(([id, k]) => { const c = CAPSTONES.find(x => x.id === id)!;
    return !autoKeywords(empty, { title: c.title, abstract: c.abstract, keywords: [] }).some(s => s.key === keywordKey(k)); }), []);

console.log("\n── Round 3 and errata #79: seen twice first, then the room is filled ──");
check("phraseCount folds like keywordKey: fish farmer and fish farmers count together",
  phraseCount({ title: "", abstract: "Fish farmers met. A fish farmer spoke." }, keywordKey("fish farmers")), 2);
check("…title and abstract are counted together", phraseCount({ title: "Hybrid Corn in Isabela", abstract: "Hybrid corn grew." }, "hybrid corn"), 2);
check("…a hyphenated keyword matches its parts", phraseCount({ title: "", abstract: "Nurse-patient interaction and nurse patient interaction." }, keywordKey("nurse-patient interaction")), 2);
check("…never across a full stop or a comma", phraseCount({ title: "", abstract: "We used hybrid. Corn grew, hybrid, corn." }, "hybrid corn"), 0);
check("…a three-word term counts as itself", phraseCount({ title: "", abstract: TPB }, keywordKey("perceived behavioral control")), 3);
const ONCE = { title: "", abstract: "Drip irrigation saved water.", keywords: [] as string[] };
check("seen once: added too when there is room (errata #79; was a chip only)", autoKeywords(empty, ONCE).map(s => s.key), ["drip irrigation"]);
const TWICE = { title: "", abstract: "Drip irrigation saved water. Farmers liked drip irrigation.", keywords: [] as string[] };
check("seen twice: added", autoKeywords(empty, TWICE).map(s => s.key), ["drip irrigation"]);
check("once in the title and once in the abstract: added",
  autoKeywords(empty, { title: "Drip Irrigation for Hybrid Corn", abstract: "Drip irrigation saved water.", keywords: [] }).map(s => s.key), ["drip irrigation"]);
check("plural folding: fish farmer + fish farmers = twice → added",
  autoKeywords(empty, { title: "", abstract: "Fish farmers met. A fish farmer spoke.", keywords: [] }).map(s => s.key), ["fish farmer"]);
check("no repeated phrase: the ones seen once fill the room, in their usual order (fewer than 5 only when they run out)",
  autoKeywords(empty, { title: "", abstract: "Solar dryers cut drying time of cacao beans.", keywords: [] }).map(s => s.key), ["solar dryer", "drying time", "cacao bean"]);
check("learned keywords are not held to the twice rule (learned from 30 studies, each seen once here)",
  autoKeywords(trainKeywordModel(libraryOf(30)), NEW_FISH).filter(s => s.source === "learned").map(s => [s.key, phraseCount(NEW_FISH, s.key)]), [["aquaculture", 0]]);
const REORDER = { title: "", abstract: "Quality care matters. Quality care and care quality were rated. Care quality rose.", keywords: [] as string[] };
const reorder = autoKeywords(empty, REORDER).map(s => s.key);
check('the same words in another order overlap: never both "quality care" and "care quality"',
  [reorder.includes("quality care") !== reorder.includes("care quality"), suggestKeywords(empty, { ...REORDER, keywords: reorder }).some(s => ["quality care", "care quality"].includes(s.key))],
  [true, true]);
check("…nor one with a listed keyword in another order", autoKeywords(empty, { ...REORDER, keywords: ["Care quality"] }).some(s => s.key === "quality care"), false);

console.log("\n── Errata #79: fill-up order ──");
// "goat milk" (seen once) scores above "solar dryer" (seen twice), because goat and milk are frequent words.
const GOAT = { title: "", keywords: [] as string[], abstract: "Goat raisers sold goat milk. Goats, milk, goats, milk, goats, milk, goats, milk, goats, milk, " +
  "goats, milk, goats, milk and goats, milk were counted. A solar dryer was built; the solar dryer worked." };
check("suggestions list the best score first: goat milk (seen once) before solar dryer (seen twice)",
  suggestKeywords(empty, GOAT).map(s => [s.key, phraseCount(GOAT, s.key)]), [["goat milk", 1], ["solar dryer", 2], ["goat raiser", 1]]);
check("…but the one seen twice is added first, then the others in that order", autoKeywords(empty, GOAT).map(s => s.key), ["solar dryer", "goat milk", "goat raiser"]);
check("…with room for 1 only the one seen twice", autoKeywords(empty, { ...GOAT, keywords: printed(7) }).map(s => s.key), ["solar dryer"]);
const CARE = { title: "", keywords: [] as string[], abstract: "Quality care matters to patients. Nurses gave quality care at night. Care quality rose in the ward." };
check("a filler seen once never overlaps an added one: care quality (once) is not added after quality care (twice), it stays a chip",
  [autoKeywords(empty, CARE).map(s => s.key), suggestKeywords(empty, { ...CARE, keywords: ["Quality care"] }).map(s => s.key)], [["quality care"], ["care quality"]]);
check("…nor one inside a printed keyword: patient interaction is not added next to Nurse-patient interaction",
  autoKeywords(empty, { title: "", abstract: "Patient interaction improved after training.", keywords: ["Nurse-patient interaction"] }).map(s => s.key), []);
check("…and nothing is left as a chip once all three are added",
  suggestKeywords(empty, { ...GOAT, keywords: autoKeywords(empty, GOAT).map(s => s.keyword) }), []);
const MILK_TEA = CAPSTONES.find(c => c.id === "milk-tea")!;
const teaDoc = { title: MILK_TEA.title, abstract: MILK_TEA.abstract, keywords: [] as string[] };
const teaOrder = suggestKeywords(empty, teaDoc, { limit: 50 }).map(s => s.key);
const teaRepeated = teaOrder.filter(k => phraseCount(teaDoc, k) >= 2);
check("milk-tea: three phrases seen twice (social media, tea shops, Tuguegarao City)", teaRepeated, ["social media", "tea shop", "tuguegarao city"]);
for (const room of [0, 1, 2, 3, 4, 5]) {
  const kw = printed(KEYWORD_MODEL.autoTotal - room);
  const got = autoKeywords(empty, { ...teaDoc, keywords: kw }).map(s => s.key);
  const want = [...teaRepeated, ...teaOrder.filter(k => !teaRepeated.includes(k))].slice(0, room);
  check(`room ${room} (${kw.length} printed): exactly ${room} added, the seen-twice ones first, then the next in the usual order`, got, want);
}

console.log("\n── Errata #79: vague words cannot end a phrase either ──");
check('"producing various programs": neither "producing various" nor "various programs"',
  extractPhrases(empty, "The station kept producing various programs online.").map(p => p.key).filter(k => k.includes("various")), []);
const VAGUE = ["specific", "various", "different", "several", "certain", "particular", "existing", "numerous", "many", "few",
  "overall", "same", "own", "such", "respective", "corresponding", "pertinent", "relevant"];
check("no vague word starts or ends a phrase (each written twice after and before a noun)",
  VAGUE.filter(w => extractPhrases(empty, `Farmers grew rice ${w}. Farmers grew rice ${w}. The ${w} harvest came. The ${w} harvest came.`)
    .some(p => p.key.split(" ").includes(w))), []);
check("…while the noun phrase around them is still found", extractPhrases(empty, "Rice farmers met. Rice farmers grew various crops.").map(p => p.key), ["rice farmer"]);


console.log("\n── Edit study: never learns from itself ──");
const EDITED: KeywordStudy = { id: "vermi", title: "Vermicompost from Market Waste", keywords: ["vermicompost"],
  abstract: "African nightcrawlers turned market vegetable waste into vermicompost within six weeks." };
const withEdited = [...LIBRARY, EDITED];
const editModel = trainKeywordModel(withEdited, { excludeId: "vermi" });
check("its keyword is not a known keyword", editModel.labels.some(l => l.key === "vermicompost"), false);
check("its words are not in the vocabulary", ["nightcrawler", "vermicompost", "african"].some(w => editModel.df.has(w)), false);
check("so it is not suggested back to it", suggestKeywords(editModel, { ...EDITED, keywords: [] }, LEARN).some(s => s.source === "learned" && s.key === "vermicompost"), false);
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
  suggestKeywords(vermiModel, { ...EDITED, keywords: [] }, LEARN).some(s => s.source === "learned"), false);
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
