// Examples for pdfText.ts (errata #78). Run with:  node src/pdfText.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// All page texts below are made up.
import {
  MAX_PAGES, MSG_NOT_FOUND, MSG_SCANNED, extractAbstractAndKeywords, extractFromPages, takeKeywordsLine,
} from "./pdfText.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

// --- A made-up PDF: one string per page. `asked` records every page read.
type Fake = { pages: string[]; asked: number[] };
function fake(numPages: number, at: Record<number, string>, filler = (n: number) => `Front matter text for page ${n} of this made-up study.\n`): Fake {
  const pages = Array.from({ length: numPages }, (_, i) => at[i + 1] ?? filler(i + 1));
  return { pages, asked: [] };
}
async function run(f: Fake): Promise<{ abstract: string; keywords: string[]; pagesRead: number } | string> {
  try {
    return await extractFromPages(f.pages.length, async (n) => {
      f.asked.push(n);
      return f.pages[n - 1];
    });
  } catch (e) {
    return (e as Error).message;
  }
}
const lastAsked = (f: Fake) => Math.max(0, ...f.asked);
const inOrder = (f: Fake) => f.asked.every((n, i) => n === i + 1);

const BODY1 = "This study measured how rice farmers in Echague used weather text alerts during the 2024 planting season.";
const BODY2 = "Farmers who read the alerts planted two weeks later and lost less of their harvest to early floods.";
const abstractPage = (kw = "Keywords: rice farming, text alerts, floods\n") =>
  `ABSTRACT\n${BODY1}\n${BODY2}\n${kw}`;
const WANT_ABSTRACT = `${BODY1} ${BODY2}`;
const WANT_KW = ["rice farming", "text alerts", "floods"];

console.log("— Where the abstract is —");
{
  const f = fake(80, { 3: abstractPage() });
  const r = await run(f);
  check("abstract on page 3 → found", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("abstract on page 3 → keywords found", typeof r === "object" && r.keywords, WANT_KW);
  check("abstract on page 3 → stops after page 4 (one page past the abstract)", lastAsked(f), 4);
  check("abstract on page 3 → pagesRead says 4", typeof r === "object" && r.pagesRead, 4);
  check("pages are read in order from page 1", inOrder(f), true);
}
{
  const f = fake(80, { 5: abstractPage() });
  await run(f);
  check("abstract on page 5 → stops at page 6, not 40", lastAsked(f), 6);
}
{
  // The UP Open University layout: front matter up to page xvii, abstract on 17.
  const f = fake(138, { 17: abstractPage() });
  const r = await run(f);
  check("abstract on page 17 (past the old 15-page limit) → found", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("abstract on page 17 → keywords found", typeof r === "object" && r.keywords, WANT_KW);
  check("abstract on page 17 → stops after page 18", lastAsked(f), 18);
}
{
  const f = fake(60, { 39: abstractPage() });
  const r = await run(f);
  check("abstract on page 39 → found, stops at the cap (page 40)", [typeof r === "object" && r.abstract, lastAsked(f)], [WANT_ABSTRACT, 40]);
}
{
  const f = fake(60, { 41: abstractPage() });
  const r = await run(f);
  check("abstract on page 41 → past the cap: not found", r, MSG_NOT_FOUND);
  check("abstract on page 41 → page 41 is never read", lastAsked(f), 40);
}
{
  const f = fake(2, { 2: abstractPage() });
  const r = await run(f);
  check("2-page PDF, abstract on page 2 → found, no page 3 asked for",
    [typeof r === "object" && r.abstract, lastAsked(f)], [WANT_ABSTRACT, 2]);
}

console.log("\n— The abstract runs onto the next page —");
{
  const f = fake(80, { 5: `ABSTRACT\n${BODY1}\n`, 6: `${BODY2}\nKeywords: rice farming, text alerts, floods\n` });
  const r = await run(f);
  check("abstract split over pages 5 and 6 → both halves kept", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("split abstract → keywords from page 6", typeof r === "object" && r.keywords, WANT_KW);
  check("split abstract → stops after page 7 (one past where it ends)", lastAsked(f), 7);
}
{
  // The abstract ends on page 5 with "Keywords:" alone; the words are on page 6.
  const f = fake(80, { 5: `ABSTRACT\n${BODY1}\n${BODY2}\nKeywords:\n`, 6: "rice farming, text alerts, floods\nAcknowledgments\n" });
  const r = await run(f);
  check("Keywords heading on page 5, the words on page 6 → keywords found", typeof r === "object" && r.keywords, WANT_KW);
  check("…and the abstract is found", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("…reading stops at page 6", lastAsked(f), 6);
}
{
  // Abstract fills page 9 to the bottom; the Keywords line opens page 10.
  const f = fake(80, { 9: `ABSTRACT\n${BODY1}\n${BODY2}\n`, 10: "Keywords: rice farming, text alerts, floods\nDEDICATION\n" });
  const r = await run(f);
  check("Keywords line on the page after the abstract → keywords found", typeof r === "object" && r.keywords, WANT_KW);
  check("…abstract found", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("…stops at page 11", lastAsked(f), 11);
}

console.log("\n— Table-of-contents lines come first —");
{
  const contents = "TABLE OF CONTENTS\nTitle Page ..... i\nAbstract ..... xvii\nAcknowledgments ..... xviii\nCHAPTER I INTRODUCTION ..... 1\n";
  const f = fake(138, { 6: contents, 17: abstractPage() });
  const r = await run(f);
  check("contents line “Abstract ..... xvii” on page 6 → the real abstract on page 17", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("…and reading does not stop at the contents page", lastAsked(f), 18);
}
for (const entry of ["ABSTRACT x i", "ABSTRACT   x iii", "Abstract x v i i", "ABSTRACT 1 2", "Abstract xi", "ABSTRACT 12", "ABSTRACT . . . . v"]) {
  const contents = `TABLE OF CONTENTS\nTitle Page i\n${entry}\nCHAPTER I: INTRODUCTION 1\nBackground of the Study 1\nStatement of the Problem 3\n`;
  const r = extractAbstractAndKeywords(`${contents}\n${abstractPage()}`);
  check(`contents line “${entry}” is skipped → real abstract`, r.abstract, WANT_ABSTRACT);
}
{
  // DANDO 2022 layout (made-up words): "ABSTRACT x i" in the contents on page 7,
  // the real abstract on page 11.
  const contents = "TABLE OF CONTENTS\nAPPROVAL SHEET i\nACKNOWLEDGMENT v\nABSTRACT x i\nCHAPTER I: INTRODUCTION 1\nBackground of the Study 1\n";
  const f = fake(150, { 7: contents, 11: abstractPage() });
  const r = await run(f);
  check("contents “ABSTRACT x i” on page 7 → abstract from page 11, not the contents", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("…stops at page 12", lastAsked(f), 12);
}
check("“ABSTRACT: This study…” on one line is still the abstract, not a contents line",
  extractAbstractAndKeywords(`ABSTRACT: ${BODY1}\n${BODY2}\nKeywords: rice\n`).abstract, WANT_ABSTRACT);
check("“ABSTRACT” alone on its line is still the heading",
  extractAbstractAndKeywords(`ABSTRACT\n${BODY1}\n${BODY2}\nINTRODUCTION\n`).abstract, WANT_ABSTRACT);

console.log("\n— No abstract —");
{
  const f = fake(136, {});
  const r = await run(f);
  check("no abstract in 136 pages → “please type them in”", r, MSG_NOT_FOUND);
  check("…reads exactly 40 pages, no more", [lastAsked(f), f.asked.length], [MAX_PAGES, 40]);
}
{
  const f = fake(12, {});
  await run(f);
  check("no abstract in a 12-page PDF → reads all 12, never asks for page 13", [lastAsked(f), f.asked.length], [12, 12]);
}
{
  const f = fake(60, { 4: "Keywords: rice farming, text alerts, floods\n" });
  const r = await run(f);
  check("keywords but no abstract → keywords kept (as before)", typeof r === "object" && [r.abstract, r.keywords], ["", WANT_KW]);
  check("…reads up to the cap looking for the abstract", lastAsked(f), 40);
}
check("MAX_PAGES is 40", MAX_PAGES, 40);

console.log("\n— Scanned PDFs —");
{
  const f = fake(120, {}, () => "");
  check("120 image-only pages (no text) → scanned", await run(f), MSG_SCANNED);
}
{
  // A page number on every page: 40 pages give 71 letters, more than 50,
  // but the first 15 give only 21, so it is still scanned, as before.
  const f = fake(120, {}, (n) => `${n}\n`);
  check("120 scanned pages that print only a page number → still scanned", await run(f), MSG_SCANNED);
}
{
  const f = fake(3, {}, () => " \n");
  check("3-page scanned PDF → scanned", await run(f), MSG_SCANNED);
}
{
  const f = fake(60, { 20: abstractPage() }, (n) => (n <= 15 ? "" : `Typed page ${n} of the study text goes here.\n`));
  const r = await run(f);
  check("scanned pages 1–15 then a typed abstract on page 20 → abstract found", typeof r === "object" && r.abstract, WANT_ABSTRACT);
}
{
  const f = fake(60, {}, (n) => (n === 1 ? "A typed cover page with the study title, the authors and the year 2024.\n" : ""));
  check("typed cover page, rest scanned → “please type them in” (as before)", await run(f), MSG_NOT_FOUND);
}

console.log("\n— Running headers and page numbers after the abstract (round 2) —");
{
  const TITLE = "Weather Alerts Among Rice Farmers in Echague";
  // Every page starts with the study's short title and its page number.
  const withHead = (num: string, body: string) => `${TITLE} ${num}\n${body}`;
  const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii"];
  const page = (n: number, body = `Front matter text for page ${n}.\n`) => withHead(roman[n - 1] ?? String(n), body);
  const fakeWithHeads = (at: Record<number, string>, numPages = 30) =>
    fake(numPages, Object.fromEntries(Array.from({ length: numPages }, (_, i) => [i + 1, at[i + 1] ?? page(i + 1)])));

  // Header at the top of the next page, before CHAPTER 1 (ASUNCION / NGOJO layout).
  let r = await run(fakeWithHeads({ 11: page(11, `ABSTRACT\n${BODY1}\n${BODY2}\n`), 12: withHead("1", "CHAPTER 1\nTHE PROBLEM\n") }));
  check("next page's header “Title 1” before CHAPTER 1 is not kept", typeof r === "object" && r.abstract, WANT_ABSTRACT);

  // Header at the bottom of the abstract page, Keywords on the next (LACAP layout).
  r = await run(fake(30, {
    3: `${TITLE} vii\n`, 9: `ABSTRACT\n${BODY1}\n${BODY2}\n${TITLE} viii\n`,
    10: `Keywords: rice farming, text alerts, floods\n${TITLE} ix\n`,
  }));
  check("footer “Title viii” under the abstract is not kept", typeof r === "object" && r.abstract, WANT_ABSTRACT);

  // A blank back page that prints only its header, then the next one (TAN layout).
  r = await run(fakeWithHeads({ 12: page(12, `ABSTRACT\n${BODY1}\n${BODY2}\n`), 13: page(13, ""), 14: withHead("14", "CHAPTER 1\n") }));
  check("two headers in a row (“Title xiii”, “Title 14”) are both dropped", typeof r === "object" && r.abstract, WANT_ABSTRACT);

  // A header with "…" in it (a cut-off long title).
  const CUT = "From flood alerts to action plans: A roadmap for the…";
  r = await run(fake(30, { 2: `${CUT} ii\n`, 12: `${CUT} xii\nAbstract\n${BODY1}\n${BODY2}\n`, 13: `${CUT} 1\nI. INTRODUCTION\n` }));
  check("a header ending in “…” before its page number is dropped", typeof r === "object" && r.abstract, WANT_ABSTRACT);

  // "Page N" at the top of the next page (JACA layout).
  r = await run(fake(30, { 8: `Page vii\nAbstract\n${BODY1}\n${BODY2}\n`, 9: "Page 8\nChapter I\nINTRODUCTION\n" }));
  check("“Page 8” at the top of the next page is dropped", typeof r === "object" && r.abstract, WANT_ABSTRACT);
  check("“Page 12” after the last sentence is dropped",
    extractAbstractAndKeywords(`ABSTRACT\n${BODY1}\n${BODY2} Page 12\nINTRODUCTION\n`).abstract, WANT_ABSTRACT);
}
{
  // What must NOT be cut.
  const once = extractAbstractAndKeywords(`ABSTRACT\n${BODY1}\n${BODY2}\nA Study of Rice Farmers 12\nINTRODUCTION\n`).abstract;
  check("a title line with a number seen only ONCE is kept (not proved to be a header)", once,
    `${WANT_ABSTRACT} A Study of Rice Farmers 12`);
  const region = `ABSTRACT\n${BODY1}\nThe alerts were sent to every town in Cagayan Valley Region II\nINTRODUCTION\n`;
  check("last line “… Region II” (no full stop) is kept",
    extractAbstractAndKeywords(region).abstract, `${BODY1} The alerts were sent to every town in Cagayan Valley Region II`);
  const unfinished = `Rice Farming Study Notes 3\nABSTRACT\n${BODY1}\nFarmers who read the alerts planted later\nRice Farming Study Notes 4\nINTRODUCTION\n`;
  check("a repeated header is kept when what is left would not end a sentence",
    extractAbstractAndKeywords(unfinished).abstract, `${BODY1} Farmers who read the alerts planted later Rice Farming Study Notes 4`);
  const civil = `Department of Civil\nABSTRACT\n${BODY1}\n${BODY2}\nDepartment of Civil\nINTRODUCTION\n`;
  check("“Civil” is a word, not a page number: no header taken from it",
    extractAbstractAndKeywords(civil).abstract, `${WANT_ABSTRACT} Department of Civil`);
  const sentenceNumber = `Yields per hectare 2\nABSTRACT\n${BODY1}\nYields per hectare 2\nKeywords: rice\n`;
  check("a repeated line is dropped only from the END, the body before it stays",
    extractAbstractAndKeywords(sentenceNumber).abstract, BODY1);
}

console.log("\n— Spaced hyphens in keywords (round 2) —");
const kws = (line: string) => extractAbstractAndKeywords(`Keywords: ${line}\n`).keywords;
check("“self - efficacy” → “self-efficacy”", kws("self - efficacy, motivation"), ["self-efficacy", "motivation"]);
check("“long  -  term care” (several spaces) → “long-term care”", kws("long  -  term care"), ["long-term care"]);
check("“e-learning”, “COVID-19” unchanged", kws("e-learning, COVID-19"), ["e-learning", "COVID-19"]);
check("“pre- or post-test” keeps its space (a space on one side only)", kws("pre- or post-test"), ["pre- or post-test"]);
check("“2019 - 2024” (digits) unchanged", kws("rainfall 2019 - 2024"), ["rainfall 2019 - 2024"]);
check("an accented letter next to the hyphen: “café - based” → “café-based”", kws("café - based farms"), ["café-based farms"]);
console.log("\n— Keyword lines that wrap (round 2) —");
const kwOf = (text: string) => extractAbstractAndKeywords(text).keywords;
check("cut mid-phrase, next line has commas → joined (“Theory of Planned” / “Behavior, …”)",
  kwOf("Keywords: rice farming, Theory of Planned\nBehavior, flood alerts\nCHAPTER I\n"),
  ["rice farming", "Theory of Planned Behavior", "flood alerts"]);
check("line ends with “,” → next line joined even without commas",
  kwOf("Keywords: rice farming, text alerts,\nflood early warning\nCHAPTER I\n"),
  ["rice farming", "text alerts", "flood early warning"]);
check("line ends with “;” → joined", kwOf("Keywords: rice; text alerts;\nfloods; Isabela\n"), ["rice", "text alerts", "floods", "Isabela"]);
check("line ends with “&” → joined", kwOf("Keywords: farmers &\nfisherfolk, floods\n"), ["farmers & fisherfolk", "floods"]);
check("short ending with a full stop (“advancement.”) → joined",
  kwOf("Keywords: self - efficacy, motivation, educational\nadvancement.\nA Study of Nurses in Isabela\n"),
  ["self-efficacy", "motivation", "educational advancement"]);
check("wraps over two more lines while each ends in a separator",
  kwOf("Keywords: rice, corn,\ncassava, mango,\nbanana, coconut\nCHAPTER I\n"),
  ["rice", "corn", "cassava", "mango", "banana", "coconut"]);
check("“Keywords:” alone, the list on the next line and wrapping again",
  kwOf("Keywords:\nrice farming, text alerts, flood early\nwarning, Isabela\n"),
  ["rice farming", "text alerts", "flood early warning", "Isabela"]);
check("a word broken at a hyphen (“socio-” / “economic status”) is joined without a space",
  kwOf("Keywords: farm income, socio-\neconomic status\n"), ["farm income", "socio-economic status"]);
check("NOT joined: next line is a title with no commas (the study title under the list)",
  kwOf("Keywords: Climate change; Generation Z\nGeneration Z Awareness and Willingness to Engage in Climate Change Adaptation\n"),
  ["Climate change", "Generation Z"]);
check("NOT joined: a heading, even after a trailing comma",
  kwOf("Keywords: rice, floods,\nCHAPTER I\nINTRODUCTION\n"), ["rice", "floods"]);
check("NOT joined: a numbered heading “I. INTRODUCTION”",
  kwOf("Keywords: rice; floods;\nI. INTRODUCTION\n"), ["rice", "floods"]);
check("NOT joined: a sentence with commas",
  kwOf("Keywords: rice farming, text alerts\nThis study, conducted in Echague during the 2024 wet season, found that alerts helped.\n"),
  ["rice farming", "text alerts"]);
check("NOT joined: the running header under the list (repeated with page numbers)",
  kwOf("Rice, Corn and Floods in Isabela xi\nKeywords: rice farming, floods\nRice, Corn and Floods in Isabela xii\n"),
  ["rice farming", "floods"]);
check("NOT joined: an empty line ends the list",
  kwOf("Keywords: rice farming, floods,\n\nweather, alerts\n"), ["rice farming", "floods"]);
check("after a joined line with no separator at its end, the title line under it is not joined",
  kwOf("Keywords: Marine Plastic Pollution; Coastal\nCommunities; Bulusan, Sorsogon\nPlastic Waste in Bulusan, Sorsogon\n"),
  ["Marine Plastic Pollution", "Coastal Communities", "Bulusan", "Sorsogon"]);
check("at most 3 more lines are joined",
  kwOf("Keywords: a1,\nb2,\nc3,\nd4,\ne5\n"), ["a1", "b2", "c3", "d4"]);
check("a one-line list is unchanged", kwOf("Keywords: rice, floods\nCHAPTER I\n"), ["rice", "floods"]);

console.log("— A Keywords line pasted into the abstract box (errata #80) —");
const ABS = "This study measured rice yield under drip irrigation in Isabela farms over two seasons.";
check("own line: moved out, same parsing as a PDF",
  takeKeywordsLine(`${ABS}\nKeywords: rice yield; drip irrigation, and Isabela farms.`),
  { abstract: ABS, keywords: ["rice yield", "drip irrigation", "Isabela farms"] });
check("KEY WORDS with a dash, blank lines around",
  takeKeywordsLine(`${ABS}\n\nKEY WORDS — rice yield, soil\n\n`), { abstract: ABS, keywords: ["rice yield", "soil"] });
check("the label alone, the list on the next line",
  takeKeywordsLine(`${ABS}\nKeywords\nrice yield, soil`), { abstract: ABS, keywords: ["rice yield", "soil"] });
check("a wrapped list is joined (the PDF reader's rule)",
  takeKeywordsLine(`${ABS}\nKeywords: Theory of Reasoned\nAction, climate neutrality`),
  { abstract: ABS, keywords: ["Theory of Reasoned Action", "climate neutrality"] });
check("after the last sentence on the same line (line break lost)",
  takeKeywordsLine(`${ABS} Keywords: rice yield, soil`), { abstract: ABS, keywords: ["rice yield", "soil"] });
check("self - efficacy → self-efficacy, as from a PDF",
  takeKeywordsLine(`${ABS}\nKeywords: self - efficacy, nursing`)?.keywords, ["self-efficacy", "nursing"]);
check("text after the list stays in the abstract",
  takeKeywordsLine(`${ABS}\nKeywords: rice, soil\n\nA last line typed after it.`),
  { abstract: `${ABS}\n\nA last line typed after it.`, keywords: ["rice", "soil"] });
check("no label → null", takeKeywordsLine(ABS), null);
check("a sentence that starts with Keywords is not a label",
  takeKeywordsLine(`${ABS}\nKeywords are words that describe a study.`), null);
check("“these keywords: …” inside a sentence is not a label",
  takeKeywordsLine("The search used these keywords: rice, soil, and water in Isabela farms."), null);
check("“keywords.” at the end of a sentence, no colon after it → not a label",
  takeKeywordsLine("The librarian assigned keywords. Rice farmers were then asked."), null);
check("the label with nothing after it: removed, no keywords",
  takeKeywordsLine(`${ABS}\nKeywords:`), { abstract: ABS, keywords: [] });
check("the same list read from a PDF gives the same keywords",
  takeKeywordsLine(`${ABS}\nKeywords: rice yield; drip irrigation, and Isabela farms.`)?.keywords,
  extractAbstractAndKeywords(`ABSTRACT\n${ABS} More words here to pass forty letters.\nKeywords: rice yield; drip irrigation, and Isabela farms.\n`).keywords);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
