// Examples for snippet.ts. Run with:  node src/snippet.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import { abstractSnippet, highlightParts } from "./snippet.ts";
import { isNameTitle } from "./search.ts";

let failed = 0;
function check(label: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${got}${ok ? "" : `\n      want: ${want}`}`);
}

// An abstract as splitSentences() hands it over: one string per sentence.
const abstract = [
  "This study mapped flood risk in Echague using GIS and rainfall records.",
  "Rice farmers in low barangays lost the most during the 2024 typhoon season.",
  "A GIS flood model of rice fields showed that rice yield fell by half where water stayed for three days.",
];

console.log("— Picking the sentence —");
check("most query words wins", abstractSnippet(abstract, "rice flood gis"),
  "A GIS flood model of rice fields showed that rice yield fell by half where water stayed for three days.");
check("tie → the earlier sentence", abstractSnippet(abstract, "flood"),
  "This study mapped flood risk in Echague using GIS and rainfall records.");
check("case and punctuation in the query do not matter", abstractSnippet(abstract, "TYPHOON!"),
  "Rice farmers in low barangays lost the most during the 2024 typhoon season.");
check("whole words only: “ice” is not in “rice”", abstractSnippet(abstract, "ice"), "");
check("no sentence has a query word → no snippet", abstractSnippet(abstract, "irrigation"), "");
check("no query → no snippet", abstractSnippet(abstract, ""), "");
check("one-letter words are ignored", abstractSnippet(abstract, "a"), "");
check("empty abstract → no snippet", abstractSnippet([], "flood"), "");

console.log("\n— Cutting long sentences —");
const long =
  "Over three planting seasons the researchers interviewed one hundred and twenty farmers across six barangays, " +
  "recorded their planting dates, and compared yields against an IoT-based irrigation schedule that watered " +
  "only when soil moisture fell below the set level, which saved about a third of the water used before.";
check("query word near the start → cut at the end only", abstractSnippet([long], "planting seasons"),
  "Over three planting seasons the researchers interviewed one hundred and twenty farmers across six barangays, " +
  "recorded their planting dates, and compared yields…");
check("query word in the middle → cut at both ends", abstractSnippet([long], "irrigation"),
  "…compared yields against an IoT-based irrigation schedule that watered only when soil moisture fell below " +
  "the set level, which saved about a third of the…");
check("query word at the end → cut at the start only, never mid-word", abstractSnippet([long], "water used"),
  "…against an IoT-based irrigation schedule that watered only when soil moisture fell below the set level, " +
  "which saved about a third of the water used before.");
const cut = abstractSnippet([long], "irrigation");
check("a cut snippet stays near 160 characters", String(cut.length <= 162), "true");
check("the cut is placed by a prefix match too", abstractSnippet([long], "irrigat"), cut);

console.log("\n— Prefix matching, as search matches —");
const ml = [
  "Students in the pilot section used flashcards for six weeks.",
  "Machine learning predicted which students would fail, and their learners' scores rose.",
  "Biodiversity surveys of the Magat watershed found 41 bird species.",
];
check("“learn” finds “learning”", abstractSnippet(ml, "learn"),
  "Machine learning predicted which students would fail, and their learners' scores rose.");
check("“learn” and “learning” pick the same sentence", abstractSnippet(ml, "learning"), abstractSnippet(ml, "learn"));
check("“Bio” finds “Biodiversity” (any case)", abstractSnippet(ml, "BIO"),
  "Biodiversity surveys of the Magat watershed found 41 bird species.");
check("a prefix only counts at the start of a word: “earn” is not in “learning”", abstractSnippet(ml, "earn"), "");
check("“a” is ignored: “a flood” picks what “flood” picks", abstractSnippet(abstract, "a flood"), abstractSnippet(abstract, "flood"));

console.log("\n— Highlighting (the rule highlightKw() uses) —");
// The words highlightKw() wraps in <mark> (highlightParts), shown here as [brackets].
const marked = (text: string, query: string, skip?: (word: string) => boolean) =>
  highlightParts(text, query, skip).map(p => (p.hit ? `[${p.text}]` : p.text)).join("");
check("the whole word is marked, original case kept", marked("Machine Learning and e-learning tools", "learn"),
  "Machine [Learning] and e-[learning] tools");
check("“a” is not marked in “a flood”", marked("A flood hit a farm after floods.", "a flood"),
  "A [flood] hit a farm after [floods].");
check("not mid-word: “earn” marks nothing in “learning”", marked("Machine learning", "earn"), "Machine learning");
check("only one-letter words → nothing marked", marked("A to B", "a b"), "A to B");

console.log("\n— Names on result cards: titles and degrees are never marked —");
check("“Dr. Stone” on Dr. Santos's study marks nothing", marked("Dr. Maria Santos, PhD", "Dr. Stone", isNameTitle),
  "Dr. Maria Santos, PhD");
check("“Dr. Stone” on Dr. Stone's study marks only “Stone”", marked("Dr. Maria Stone, PhD", "Dr. Stone", isNameTitle),
  "Dr. Maria [Stone], PhD");
check("“Engr” and “PhD” mark nothing", marked("Engr. Liza Pagulayan, PhD", "engr phd", isNameTitle), "Engr. Liza Pagulayan, PhD");
check("“Asst. Prof.” marks nothing; the name still is", marked("Asst. Prof. Ana Reyes, MSc", "asst prof msc reyes", isNameTitle),
  "Asst. Prof. Ana [Reyes], MSc");
check("a name that merely starts like a title is still marked: “pe” → “Pedro”", marked("Pedro Cruz, PE", "pe", isNameTitle),
  "[Pedro] Cruz, PE");
check("the abstract snippet (no skip) still marks “Dr”", marked("Dr. Santos advised it.", "dr"), "[Dr]. Santos advised it.");

console.log("\n— ñ and accents are letters, as in search —");
check("“niño” marks the whole word, any case", marked("After the El NIÑO drought", "niño"), "After the El [NIÑO] drought");
check("“ni” marks all of “Niño”, not just “Ni”", marked("El Niño years", "ni"), "El [Niño] years");
check("a word starting with an accent is marked", marked("Él dijo", "él"), "[Él] dijo");
check("not after ñ mid-word: “blanca” marks nothing in “Peñablanca”", marked("Peñablanca, Cagayan", "blanca"), "Peñablanca, Cagayan");
check("an author line: “Acosta” in “Jan Rhyanne Acosta, Luigi Mindanao”",
  marked("Jan Rhyanne Acosta, Luigi Mindanao", "acosta"), "Jan Rhyanne [Acosta], Luigi Mindanao");
check("the snippet finds a sentence by “niño”", abstractSnippet(["Rainfall fell during El Niño years."], "Niño"),
  "Rainfall fell during El Niño years.");

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
