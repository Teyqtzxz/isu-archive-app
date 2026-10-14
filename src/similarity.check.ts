// Examples for similarity.ts. Run with:  node src/similarity.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// The studies below are fake, made up for these examples only — never stored anywhere.
import {
  MAX_MATCHES, THRESHOLDS, buildOriginalityIndex, buildSimilarityIndex, cosine, originalityCheck, originalityReason,
  similarStudies, similarityLevel, similarityTerms, vectorOf, type SimilarityDoc,
} from "./similarity.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}
function between(label: string, got: number, lo: number, hi: number) {
  const ok = got >= lo && got <= hi;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${got}${ok ? "" : `\n      want: ${lo}–${hi}`}`);
}

const STUDIES: SimilarityDoc[] = [
  {
    id: "irrigation",
    title: "Irrigation Scheduling with Soil Moisture Sensors",
    keywords: ["irrigation", "soil moisture"],
    abstract:
      "This study built a low-cost soil moisture sensor for rice paddies in Echague. " +
      "Water was released only when the soil dried below a set level. " +
      "Over two seasons the farms used about a third less water with the same rice yield.",
  },
  {
    id: "rice",
    title: "Rice Yield Prediction Using Machine Learning",
    keywords: ["rice", "machine learning"],
    abstract:
      "We trained a gradient boosting model on ten years of weather and harvest records " +
      "from Isabela farms to predict palay yield before planting.",
  },
  {
    id: "library",
    title: "A Mobile App for Library Book Reservations",
    keywords: ["mobile app", "library"],
    abstract:
      "Students reserve books from their phones and get a notice when a copy is returned. " +
      "Waiting time at the circulation desk dropped by half.",
  },
  {
    id: "nursing",
    title: "Hand Hygiene Compliance of Nursing Students",
    keywords: ["hand hygiene", "nursing"],
    abstract: "Observation of ward rounds showed compliance rose after a two-week poster campaign.",
  },
];
const index = buildSimilarityIndex(STUDIES);
const pct = (doc: Omit<SimilarityDoc, "id">, id: string) =>
  similarStudies(index, doc, { limit: STUDIES.length }).find(m => m.id === id)?.percent ?? 0;

console.log("— Identical, unrelated, partial —");
check("identical text → 100%", pct(STUDIES[0], "irrigation"), 100);
check("unrelated study → 0%", pct(STUDIES[3], "irrigation"), 0);
const partial = {
  title: "Solar Pumps for Rice Paddies",
  keywords: ["solar pump"],
  abstract: "A low-cost soil moisture sensor switched a solar pump on when the soil dried below a set level.",
};
between("partial overlap → in between", pct(partial, "irrigation"), 20, 79);
// Same abstract, new title and keywords: still flagged. This fake abstract is
// three sentences, so the title weighs more than in a real one (a real copied
// abstract scored 88%, docs/14 §4).
between("copied abstract, new title → still flagged", pct({ ...STUDIES[0], title: "Smart Watering", keywords: ["sensors"] }, "irrigation"), THRESHOLDS.verySimilar, 99);

console.log("\n— Text clean-up —");
const shouted = {
  title: "IRRIGATION SCHEDULING, WITH SOIL-MOISTURE SENSORS!!!",
  keywords: ["Irrigation", "Soil Moisture"],
  abstract: STUDIES[0].abstract.toUpperCase().replace(/\./g, " ;;"),
};
check("case and punctuation ignored → 100%", pct(shouted, "irrigation"), 100);
check("common words, numbers and 1-letter words dropped", similarityTerms("This is my study of 2 farms in 2024: a test"), ["farm", "test"]);
check("plurals fold; -ss/-us/-is kept", similarityTerms("sensors paddies switches boxes classes process campus analysis bus studies"),
  ["sensor", "paddy", "switch", "box", "class", "process", "campus", "analysis", "bus"]);
check("pronouns and determiners dropped", similarityTerms("my our your their its his her us they them"), []);

console.log("\n— Safe inputs —");
const empty = { title: "", keywords: [], abstract: "" };
check("empty draft → no matches, no NaN", similarStudies(index, empty), []);
check("empty vector → cosine 0", cosine(vectorOf(empty, index), index.vectors[0]).score, 0);
const noAbstract = { title: "Irrigation Scheduling with Soil Moisture Sensors", keywords: [], abstract: "" };
between("empty abstract, same title → still found", pct(noAbstract, "irrigation"), 30, 100);
check("empty corpus → no matches", similarStudies(buildSimilarityIndex([]), STUDIES[0]), []);

console.log("\n— A study never matches itself —");
check("excludeId skips the study (Study Details, Edit study)",
  similarStudies(index, STUDIES[0], { excludeId: "irrigation" }).some(m => m.id === "irrigation"), false);
const copies = buildSimilarityIndex([...STUDIES, { ...STUDIES[0], id: "irrigation-copy" }]);
check("…but an exact copy under another id is 100%",
  similarStudies(copies, STUDIES[0], { excludeId: "irrigation" })[0], { id: "irrigation-copy", percent: 100, sharedTerms: ["soil", "moisture", "irrigation", "sensor", "scheduling"] });

console.log("\n— Shared key terms —");
check("the words adding most to the score, biggest first", similarStudies(index, partial, { limit: 1 })[0].sharedTerms,
  ["soil", "moisture", "sensor", "paddy", "rice"]);
check("no shared words → no terms", cosine(index.vectors[1], index.vectors[3]).sharedTerms, []);

console.log("\n— Limits and levels —");
check(`at most ${MAX_MATCHES} matches by default`, similarStudies(copies, { title: "rice soil library hygiene", keywords: [], abstract: "" }).length <= MAX_MATCHES, true);
check("min filters low matches", similarStudies(index, partial, { min: 101 }), []);
check("levels at 80 / 50 / 30", [100, 80, 79, 50, 49, 30, 29, 0].map(similarityLevel),
  ["duplicate", "duplicate", "very-similar", "very-similar", "related", "related", null, null]);

console.log("\n— Originality check: overall or abstract alone, whichever is higher —");
const originality = buildOriginalityIndex(STUDIES);
const top = (draft: Omit<SimilarityDoc, "id">) => originalityCheck(originality, draft)[0];
// The review's case: the exact abstract under a new title and no keywords
// scored 69–76% overall on the real data: "Very similar", no checkbox.
const copiedAbstract = { title: "Automated Watering Schedules for Lowland Farms", keywords: [], abstract: STUDIES[0].abstract };
check("same abstract, different title, no keywords → overall alone is not a duplicate",
  similarityLevel(pct(copiedAbstract, "irrigation")) !== "duplicate", true);
check("…but the abstract rule makes it a possible duplicate: Abstract 100%",
  [top(copiedAbstract).id, top(copiedAbstract).level, originalityReason(top(copiedAbstract))],
  ["irrigation", "duplicate", "Abstract 100% similar"]);
const sameTitleNewAbstract = {
  title: STUDIES[0].title, keywords: STUDIES[0].keywords,
  abstract: "Field trials compared drip lines and furrows on vegetable plots during the dry season in Cagayan Valley.",
};
const t = top(sameTitleNewAbstract);
check("same title + keywords, different abstract → not a duplicate by the abstract rule",
  [t.id, t.abstractPercent < THRESHOLDS.duplicate, t.basis], ["irrigation", true, "overall"]);
check("an exact copy is 100% both ways and reads \"overall\"",
  [top(STUDIES[0]).basis, originalityReason(top(STUDIES[0]))], ["overall", "100% similar overall"]);
check("Edit study: the study itself is never a match",
  originalityCheck(originality, copiedAbstract, { excludeId: "irrigation" }).some(m => m.id === "irrigation"), false);
check("empty draft → no matches", originalityCheck(originality, { title: "", keywords: [], abstract: "" }), []);
check("below 30% on both scores → not listed", originalityCheck(originality, STUDIES[3]).some(m => m.id === "irrigation"), false);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
