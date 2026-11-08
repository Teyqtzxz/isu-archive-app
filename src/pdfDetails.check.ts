// Examples for pdfDetails.ts (errata #82). Run with:  node src/pdfDetails.check.ts
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// ALL names, titles and text below are MADE UP. They copy only the LAYOUT of
// the two kinds of title page and abstract page seen in real studies (an ISU
// thesis and UP Open University theses); no real study's text is used.
import {
  NOTE, abstractWithoutTitle, adviserAsPrinted, departmentOf, fillFromPdf, readDetails, readStudy,
  type DetailField, type Details, type StudyDetails,
} from "./pdfDetails.ts";
import { MSG_NOT_FOUND, MSG_SCANNED, type ReadProgress } from "./pdfText.ts";
import { checkAdviser, checkAuthor, checkTitle, checkYear } from "./validation.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}
const page = (...lines: string[]) => lines.join("\n") + "\n";
const fields = (d: StudyDetails) => ({ title: d.title, authors: d.authors, department: d.department, year: d.year, adviser: d.adviser });

// ─── ISU layout (made up) ────────────────────────────────────────────────────
const ISU_TITLE_PAGE = page(
  "SMART PADDY WATCH: A LOW-COST SENSOR NETWORK",
  "FOR IRRIGATION SCHEDULING IN ECHAGUE",
  "A Thesis", "Presented to the faculty of the",
  "College of Computing Studies, Information and Communication Technology",
  "ISABELA STATE UNIVERSITY", "Echague, Isabela",
  "In Partial Fulfillment of the", "Academic Requirements for the Degree",
  "Bachelor of Science in Computer Science (BSCS)", "Data Mining Track",
  "By:", "MARIA ANGELA R. DELA CRUZ", "PEDRO L. MAGBANUA JR.", "March 2023",
);
const ISU_APPROVAL = page(
  "ii", "APPROVAL SHEET",
  "The   thesis   entitled   “SMART PADDY WATCH: A LOW-COST SENSOR NETWORK",
  "FOR IRRIGATION SCHEDULING IN ECHAGUE”   at",
  "CCSICT Department, Isabela State University Main Campus, Echague Isabela, prepared",
  "and submitted by   MARIA ANGELA R. DELA CRUZ AND PEDRO L. MAGBANUA JR.   in",
  "partial fulfillment of the requirements for the degree of Bachelor of Science in Computer",
  "Science.",
  "ROSA B. ALCANTARA, DIT", "Thesis Adviser",
  "PANEL COMMITTEE",
);
const ACK = page("iii", "ACKNOWLEDGEMENT", "We thank our families and teachers for their patience throughout this made-up study.");
const BODY = [
  "This study built a low-cost sensor network that tells rice farmers in Echague when to irrigate their",
  "paddies. Soil moisture, water depth and rainfall were read every ten minutes from twelve fields during",
  "two cropping seasons and sent to a small web dashboard. Farmers who followed the schedule used less",
  "water than farmers who irrigated by habit, and their grain yield did not drop. The network cost less",
  "than a single irrigation pump and ran on solar power for the whole season without failing.",
];
const block = (over: Partial<Record<"title" | "program" | "authors" | "ay" | "adviser", string[]>> = {}) => [
  ...(over.title ?? ["Title   : Smart Paddy Watch: A Low-Cost Sensor Network for", "Irrigation Scheduling in Echague"]),
  ...(over.program ?? ["Program   : Bachelor of Science in Computer Science-Data Mining Track"]),
  ...(over.authors ?? ["Authors   : Maria Angela R. Dela Cruz", "Pedro L. Magbanua Jr."]),
  ...(over.ay ?? ["Academic Year   : AY 2022-2023"]),
  ...(over.adviser ?? ["Adviser   : Rosa B. Alcantara, DIT"]),
];
const isuAbstract = (blockLines: string[] = block()) => page(
  "v", "ABSTRACT", ...blockLines, ...BODY,
  "Keywords :   sensor network, irrigation scheduling, rice paddies",
);
const TOC = page("vi", "TABLE OF CONTENTS", "TITLE PAGE   i", "ABSTRACT   v", "CHAPTER I. INTRODUCTION");
const isuPages = (abs = isuAbstract(), p1 = ISU_TITLE_PAGE, p2 = ISU_APPROVAL) => [p1, p2, ACK, abs, TOC];

console.log("— ISU layout: the labelled block comes first —");
const isu = readDetails(isuPages());
check("every field from the block (year from the title page)", fields(isu), {
  title: "Smart Paddy Watch: A Low-Cost Sensor Network for Irrigation Scheduling in Echague",
  authors: ["Maria Angela R. Dela Cruz", "Pedro L. Magbanua Jr."],
  department: "Computer Science", year: "2023", adviser: "Rosa B. Alcantara, DIT",
});
check("sources", isu.source, { title: "block", authors: "block", department: "block", year: "title page", adviser: "block" });
check("no notes when everything was found", isu.notes, {});
check("adviser exactly as printed: no Dr. added, degree kept", isu.adviser.startsWith("Dr."), false);
check("every filled value passes validation.ts",
  [checkTitle(isu.title).error, ...isu.authors.map(a => checkAuthor(a).error), checkYear(isu.year).error, checkAdviser(isu.adviser).error],
  [null, null, null, null, null]);

const full = await readStudy(5, async n => isuPages()[n - 1]);
check("the abstract leaves out the whole labelled block", /Title|Program|Authors|Academic Year|Adviser|Magbanua/.test(full.abstract), false);
check("the abstract starts with its first sentence", full.abstract.startsWith("This study built a low-cost sensor network"), true);
check("keywords as before", full.keywords, ["sensor network", "irrigation scheduling", "rice paddies"]);
check("no problem", full.problem, null);

console.log("\n— ISU layout: backups —");
const noBlock = readDetails(isuPages(page("v", "ABSTRACT", ...BODY, "Keywords: sensor network")));
check("no block → title page (title in capitals, kept as printed) and approval sheet", fields(noBlock), {
  title: "SMART PADDY WATCH: A LOW-COST SENSOR NETWORK FOR IRRIGATION SCHEDULING IN ECHAGUE",
  authors: ["Maria Angela R. Dela Cruz", "Pedro L. Magbanua Jr."],
  department: "Computer Science", year: "2023", adviser: "Rosa B. Alcantara, DIT",
});
check("… with the capitals note on the title", noBlock.notes, { title: NOTE.titleInCapitals });
check("… sources", noBlock.source, { title: "title page", authors: "title page", department: "title page", year: "title page", adviser: "approval sheet" });

const onlyApproval = readDetails([page("Cover page of a made-up study"), ISU_APPROVAL, ACK, page("v", "ABSTRACT", ...BODY)]);
check("no block, no title page → the approval sheet's title, names and adviser", fields(onlyApproval), {
  title: "SMART PADDY WATCH: A LOW-COST SENSOR NETWORK FOR IRRIGATION SCHEDULING IN ECHAGUE",
  authors: ["Maria Angela R. Dela Cruz", "Pedro L. Magbanua Jr."],
  department: "", year: "", adviser: "Rosa B. Alcantara, DIT",
});

const undated = ISU_TITLE_PAGE.replace("March 2023\n", "");
const ayOnly = readDetails(isuPages(isuAbstract(), undated));
check("only the academic year printed → Year empty (never guessed)", ayOnly.year, "");
check("… and the note shows the academic year", ayOnly.notes.year, NOTE.academicYearOnly("AY 2022-2023"));
check("no date, no names from the title page (the list has no end)", readDetails([undated]).authors, []);

check("Program in Information Technology → no department (not one of the ten)",
  readDetails(isuPages(isuAbstract(block({ program: ["Program   : Bachelor of Science in Information Technology"] })), page("x"))).department, "");
check("Program naming two departments → no department",
  readDetails(isuPages(isuAbstract(block({ program: ["Program   : Bachelor of Science in Agriculture and Forestry"] })), page("x"))).department, "");

const badName = readDetails(isuPages(isuAbstract(block({ authors: ["Authors   : Maria Angela R. Dela Cruz", "Group 7 Proponents"] }))));
check("one block name that is not a name → the block's list is not used; the title page's is",
  [badName.authors, badName.source.authors], [["Maria Angela R. Dela Cruz", "Pedro L. Magbanua Jr."], "title page"]);

const authorsLast = readDetails([page("Cover"), page("v", "ABSTRACT", "Title   : Smart Paddy Watch for Irrigation Scheduling",
  "Authors   : Maria Angela R. Dela Cruz", "Pedro Magbanua", "This study built a sensor", ...BODY)]);
check("authors as the last label: a short first abstract line is never read as a name",
  authorsLast.authors, ["Maria Angela R. Dela Cruz"]);

check("an all-caps adviser after Dr. gets normal capitals; Dr. kept", adviserAsPrinted("Dr. JEAN A. SANTOS"), "Dr. Jean A. Santos");
check("an all-caps adviser with a title: the Adviser box's own capitals", adviserAsPrinted("ASST. PROF. LIZA M. REYES"), "Asst. Prof. Liza M. Reyes");
check("PH.D. → PhD (the Adviser box's own cleaning)", adviserAsPrinted("PRIMO G. LUNA, PH.D."), "Primo G. Luna, PhD");
check("a value that fails the adviser rules is kept as printed (the form shows the message)",
  adviserAsPrinted("Rosa Alcantara, DVM"), "Rosa Alcantara, DVM");
check("mixed case kept", adviserAsPrinted("Melinda dP. Reyes, Ph. D."), "Melinda dP. Reyes, PhD");
check("a failing value in capitals: normal capitals, the rest as printed", adviserAsPrinted("LIZA M. REYES, DVM"), "Liza M. Reyes, DVM");

console.log("\n— Departments —");
check("Computer Science-Data Mining Track", departmentOf("Bachelor of Science in Computer Science-Data Mining Track"), "Computer Science");
check("MASTER OF ARTS IN NURSING", departmentOf("MASTER OF ARTS IN NURSING"), "Nursing");
check("Civil Engineering, not Chemical", departmentOf("Bachelor of Science in Civil Engineering"), "Civil Engineering");
check("Environmental Science", departmentOf("BS Environmental Science"), "Environmental Science");
check("“Agricultural” is not Agriculture", departmentOf("Master of Agricultural Development"), "");
check("Environment and Natural Resources is not Environmental Science", departmentOf("MASTER OF ENVIRONMENT AND NATURAL RESOURCES MANAGEMENT"), "");

// ─── UP Open University layout (made up) ─────────────────────────────────────
const UP_PERMISSION = ["Permission is given for the following people to have access to this thesis:", "Invention (I)   Yes   or   No", "Student’s signature:"];
const upPage = (o: {
  head?: string[]; uni?: string[]; program?: string; author?: string; title?: string[]; label?: string;
  advisers?: string[]; after?: string[]; date?: string;
} = {}) => page(
  ...(o.head ?? ["Care Practices of Nurses in Rural Health Units of Isabela   i"]),
  ...(o.uni ?? ["UNIVERSITY OF THE PHILIPPINES", "OPEN UNIVERSITY"]),
  o.program ?? "MASTER OF ARTS IN NURSING",
  o.author ?? "JUANA P. DE LOS SANTOS, RN",
  ...(o.title ?? ["CARE PRACTICES OF NURSES IN", "RURAL HEALTH UNITS OF ISABELA"]),
  o.label ?? "Thesis Adviser:",
  ...(o.advisers ?? ["ASST. PROF. LIZA M. REYES, MAN, RN"]),
  ...(o.after ?? ["Faculty of Management and Development Studies"]),
  ...(o.date === "" ? [] : [o.date ?? "12 March 2024"]),
  ...UP_PERMISSION,
);
const upAbstract = page("Care Practices of Nurses …   xi", "Abstract", ...BODY, "Keywords: nursing care, rural health units");

console.log("\n— UP Open University layout —");
const up = readDetails([upPage(), page("University Permission Page"), upAbstract]);
check("every field from the title page", fields(up), {
  title: "Care Practices of Nurses in Rural Health Units of Isabela",
  authors: ["Juana P. De Los Santos"], department: "Nursing", year: "2024", adviser: "Asst. Prof. Liza M. Reyes, MAN, RN",
});
check("the title in normal letters comes from the running header (letters identical)", up.notes.title, undefined);
check("the filled adviser passes the adviser rules (MAN is a degree now)", checkAdviser(up.adviser).error, null);

check("university and OPEN UNIVERSITY on one line", fields(readDetails([upPage({ uni: ["UNIVERSITY OF THE PHILIPPINES OPEN UNIVERSITY"] })])).title,
  "Care Practices of Nurses in Rural Health Units of Isabela");
check("page 1 only a cover → the title page on page 2",
  readDetails([page("MASTER OF ARTS IN NURSING", "Capstone Project"), upPage()]).authors, ["Juana P. De Los Santos"]);
const cut = readDetails([upPage({ head: ["Care Practices of Nurses in Rural…   i"] })]);
check("a running header cut short (…) is not used: the title stays in capitals, with the note",
  [cut.title, cut.notes.title], ["CARE PRACTICES OF NURSES IN RURAL HEALTH UNITS OF ISABELA", NOTE.titleInCapitals]);
check("a title in capitals but one word (“(LoG)”) still gets the capitals note",
  readDetails([upPage({ head: [], title: ["SPONSOR MANAGEMENT AND LETTER OF", "GUARANTEE (LoG) COVERAGE SYSTEM"] })]).notes.title, NOTE.titleInCapitals);
check("a capitals title with a normal-letters subtitle → no capitals note",
  readDetails([upPage({ head: [], title: ["DIGITAL CHECKLISTS FOR A SMALL ENTERPRISE", "Automating Paper-Based Maintenance Checklists"] })]).notes.title, undefined);
check("a running header with other letters is not used",
  readDetails([upPage({ head: ["Care Practices of Nurses in Rural Health Centers of Isabela   i"] })]).title,
  "CARE PRACTICES OF NURSES IN RURAL HEALTH UNITS OF ISABELA");
check("a header with “…” before the page number (complete title) is used, without the “…”",
  readDetails([upPage({ head: ["Care Practices of Nurses in Rural Health", "Units of Isabela   …   i"] })]).title,
  "Care Practices of Nurses in Rural Health Units of Isabela");

const two = readDetails([upPage({ label: "Thesis Advisers:", advisers: ["ASST PROF. LIZA M. REYES", "ASST. PROF. RAMON T. CRUZ"] })]);
check("two advisers → Adviser empty", two.adviser, "");
check("… and the note lists both", two.notes.adviser, NOTE.twoAdvisers(["Asst Prof. Liza M. Reyes", "Asst. Prof. Ramon T. Cruz"]));
check("a Critic block and “Date of Submission” before the date",
  readDetails([upPage({ after: ["Faculty of Management and Development Studies", "Thesis/Dissertation Critic:", "Dr. Ramon T. Cruz",
    "Faculty of Management and Development Studies", "Date of Submission"], date: "02 June 2020" })]).year, "2020");
check("a dd/mm/yyyy date", readDetails([upPage({ date: "15/08/2025" })]).year, "2025");
check("“August 2025”", readDetails([upPage({ date: "August 2025" })]).year, "2025");
check("no date → Year empty", readDetails([upPage({ date: "" })]).year, "");
check("degrees after a student's name dropped; “REYES - DINO” joined",
  readDetails([upPage({ author: "LYN B. REYES - DINO BSN, RN, CEN" })]).authors, ["Lyn B. Reyes-Dino"]);
check("Jr. kept, degrees dropped", readDetails([upPage({ author: "AMIL K. TAN JR., BSN, RN" })]).authors, ["Amil K. Tan Jr."]);
check("initials and particles in capitals", readDetails([upPage({ author: "MA. LUISA C. DELA CRUZ" })]).authors, ["Ma. Luisa C. Dela Cruz"]);
check("mixed-case name kept as printed", readDetails([upPage({ author: "Juana dP. Santos" })]).authors, ["Juana dP. Santos"]);
check("an author line that is not a name → no author and no title (the layout is not clear)",
  fields(readDetails([upPage({ author: "SPECIAL PROBLEM 300 REPORT 2024" })])).authors, []);
check("programme not one of the ten → no department",
  readDetails([upPage({ program: "MASTER OF DEVELOPMENT COMMUNICATION" })]).department, "");

console.log("\n— Never guess —");
check("pages with no known layout → nothing", fields(readDetails([page("Chapter 1", "Some text here."), page("More text.")])),
  { title: "", authors: [], department: "", year: "", adviser: "" });
check("“Adviser:” with nothing after it → no adviser",
  readDetails([upPage({ advisers: [] })]).adviser, "");
check("a title over 5 lines is not taken", readDetails([upPage({ title: ["A", "B", "C", "D", "E", "F"] })]).title, "");

console.log("\n— A repeated title at the start of the abstract —");
const T = "Water Use of Upland Rice Farms in Echague";
check("removed when the letters are the title's", abstractWithoutTitle(`${T} The farms used less water.`, T), "The farms used less water.");
check("… whatever the capitals and line breaks", abstractWithoutTitle(`WATER USE OF UPLAND RICE FARMS IN ECHAGUE: The farms used less water.`, T), "The farms used less water.");
check("half the title → kept", abstractWithoutTitle("Water Use of Upland Rice is a big topic.", T), "Water Use of Upland Rice is a big topic.");
check("title under 10 letters → nothing removed", abstractWithoutTitle("Rice Farms are many.", "Rice Farms"), "Rice Farms are many.");
check("only the title → kept (nothing would be left)", abstractWithoutTitle(T, T), T);
check("no title → kept", abstractWithoutTitle("The farms used less water.", ""), "The farms used less water.");
// Review fix: an abstract whose first sentence starts with the title's words is kept whole.
for (const [title, abs] of [
  ["Agricultural Extension Services", "Agricultural extension services in Isabela reach few farmers in the upland barangays."],
  ["Mobile Learning Readiness", "Mobile learning readiness of senior high students was measured in three schools."],
  ["Solar Dryer for Corn", "Solar dryer for corn kernels was built and tested during the wet season."],
  ["Access Control Management System", "Access Control Management System is a web app that records every visit."],
]) check(`first sentence starts with the title's words (“${title}”) → kept whole`, abstractWithoutTitle(abs, title), abs);
check("TARUC shape: the title, then “The …” → removed",
  abstractWithoutTitle("Thriving in a Shared Workplace: Talk Among Engineers in Riyadh The constantly evolving world …", "Thriving in a Shared Workplace: Talk Among Engineers in Riyadh"),
  "The constantly evolving world …");
check("the title, then “:” and a capital → removed", abstractWithoutTitle(`${T}: Farms used less water.`, T), "Farms used less water.");
check("the title, then a digit → removed", abstractWithoutTitle(`${T} 2024 was a dry year.`, T), "2024 was a dry year.");

console.log("\n— readStudy —");
const taruc = [upPage({ head: [] }), page("Abstract", "Care Practices of Nurses in Rural Health Units", "of Isabela",
  ...BODY, "Keywords: nursing care"), page("CHAPTER 1", "INTRODUCTION")];
const t1 = await readStudy(3, async n => taruc[n - 1]);
check("the title printed under “Abstract” is not part of the abstract", t1.abstract.startsWith("This study built"), true);
const seen: ReadProgress[] = [];
const noAbs = [upPage(), page("Chapter 1", "Some text of a made-up study that has no abstract heading at all in it.")];
const t2 = await readStudy(2, async n => noAbs[n - 1], p => seen.push(p));
check("no abstract → the problem, but the title page is still read", [t2.problem, t2.details.authors], [MSG_NOT_FOUND, ["Juana P. De Los Santos"]]);
check("progress: each page, in order", seen, [{ kind: "page", page: 1 }, { kind: "page", page: 2 }]);
const t3 = await readStudy(3, async () => "  ");
check("scanned → MSG_SCANNED and nothing filled", [t3.problem, fields(t3.details)],
  [MSG_SCANNED, { title: "", authors: [], department: "", year: "", adviser: "" }]);

console.log("\n— Filling the form: never overwrite —");
const EMPTY: Details = { title: "", authors: [], department: "", year: "", adviser: "" };
const found = (over: Partial<StudyDetails> = {}): StudyDetails => ({
  title: "Water Use of Upland Rice Farms in Echague", authors: ["Ana B. Cruz"], department: "Agriculture", year: "2024",
  adviser: "Rosa B. Alcantara, DIT", source: {}, notes: {}, ...over,
});
const f1 = fillFromPdf(EMPTY, [], found());
check("empty form → every field filled and tagged", [f1.details, f1.fromPdf], [
  { title: "Water Use of Upland Rice Farms in Echague", authors: ["Ana B. Cruz"], department: "Agriculture", year: "2024", adviser: "Rosa B. Alcantara, DIT" },
  ["title", "authors", "department", "year", "adviser"],
]);
const typed: Details = { ...EMPTY, title: "My Own Typed Title for This Study", year: "2023" };
const f2 = fillFromPdf(typed, [], found());
check("a typed value is kept", [f2.details.title, f2.details.year], ["My Own Typed Title for This Study", "2023"]);
check("… not tagged", f2.fromPdf.includes("title") || f2.fromPdf.includes("year"), false);
check("… and a note says what the PDF shows", f2.notes.title, NOTE.differs("title", "Water Use of Upland Rice Farms in Echague"));
check("the same value (any capitals) → no note", fillFromPdf({ ...EMPTY, year: "2024" }, [], found()).notes.year, undefined);
const prev: DetailField[] = ["title", "adviser"];
const f3 = fillFromPdf({ ...EMPTY, title: "An Earlier PDF Title Here", adviser: "Ana Reyes" }, prev, found({ adviser: "" }));
check("an earlier PDF's values are replaced", f3.details.title, "Water Use of Upland Rice Farms in Echague");
check("an earlier PDF's value the new PDF does not give is emptied", f3.details.adviser, "");
const study: Details = { title: "Saved Study Title in the Library", authors: [], department: "Biology", year: "2019", adviser: "Dr. Ana Reyes" };
const f4 = fillFromPdf(study, [], found());
check("Edit: nothing a saved study holds is changed", [f4.details.title, f4.details.department, f4.details.year, f4.details.adviser],
  ["Saved Study Title in the Library", "Biology", "2019", "Dr. Ana Reyes"]);
check("Edit: an empty author list (old record) is filled and tagged", [f4.details.authors, f4.fromPdf], [["Ana B. Cruz"], ["authors"]]);
check("the AY note comes along when Year can be filled",
  fillFromPdf(EMPTY, [], found({ year: "", notes: { year: NOTE.academicYearOnly("AY 2023-2024") } })).notes.year, NOTE.academicYearOnly("AY 2023-2024"));
check("the input is not changed", typed.title, "My Own Typed Title for This Study");

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
