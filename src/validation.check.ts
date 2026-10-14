// Examples for validation.ts. Run with:  node src/validation.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import {
  ABSTRACT_MAX, MSG, addAuthor, addKeywords, checkAbstract, checkAdviser, checkAuthor, checkTitle,
  checkYear, cleanAbstract, cleanAuthorList, cleanKeywordList, cleanQuery, countWords, fixCapitals, pdfFileProblem, validateDriveLink, yearInput,
  type Added, type Checked,
} from "./validation.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}
const saved = (value: string): Checked => ({ value, error: null });
const err = (value: string, error: string): Checked => ({ value, error });
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

console.log("— Authors: characters —");
check("ñ and accents", checkAuthor("José Peña"), saved("José Peña"));
check("hyphen, period, apostrophe", checkAuthor("Ma. Clara O'Brien-Santos"), saved("Ma. Clara O'Brien-Santos"));
check("curly apostrophe (phone keyboards)", checkAuthor("Liam O’Neil"), saved("Liam O’Neil"));
check("digit rejected", checkAuthor("Juan Dela Cruz 2"), err("Juan Dela Cruz 2", MSG.nameChars));
check("symbol rejected", checkAuthor("Juan @ Cruz"), err("Juan @ Cruz", MSG.nameChars));
check("only punctuation rejected", checkAuthor("..."), err("...", MSG.nameChars));
check("over 80 characters", checkAuthor("A".repeat(41) + " " + "B".repeat(40)).error, MSG.nameLong(80));
check("blank: nothing to add, no error", checkAuthor("   "), saved(""));

console.log("\n— Authors: first name and surname —");
check("given + surname", checkAuthor("Juan Dela Cruz"), saved("Juan Dela Cruz"));
check("one surname with a particle alone", checkAuthor("Dela Cruz"), err("Dela Cruz", MSG.authorFull));
check("De los Santos alone", checkAuthor("De los Santos"), err("De los Santos", MSG.authorFull));
check("one word", checkAuthor("Maria"), err("Maria", MSG.authorFull));
check("initial counts as a first name", checkAuthor("J. Dela Cruz"), saved("J. Dela Cruz"));
check("suffix does not count as a name", checkAuthor("Cruz Jr."), err("Cruz Jr.", MSG.authorFull));
check("given + surname + suffix", checkAuthor("Jose Rizal Jr."), saved("Jose Rizal Jr."));
check("comma form", checkAuthor("Dela Cruz, Juan"), saved("Dela Cruz, Juan"));
check("comma form, initial", checkAuthor("Dela Cruz, J."), saved("Dela Cruz, J."));
check("comma form + suffix", checkAuthor("Rizal, Jose, Jr."), saved("Rizal, Jose, Jr."));
check("comma before suffix", checkAuthor("Jose Rizal, Jr."), saved("Jose Rizal, Jr."));
check("comma with nothing after", checkAuthor("Dela Cruz,"), err("Dela Cruz,", MSG.authorFull));
check("comma form, particle-only surname", checkAuthor("Dela, Juan"), err("Dela, Juan", MSG.authorFull));
check("comma form, too many parts", checkAuthor("Cruz, Juan, Maria"), err("Cruz, Juan, Maria", MSG.authorFull));

console.log("\n— Authors: capitals —");
check("all lowercase → capitals", checkAuthor("juan dela cruz"), saved("Juan Dela Cruz"));
check("ALL CAPS → capitals", checkAuthor("JUAN DELA CRUZ"), saved("Juan Dela Cruz"));
check("any capital → kept as typed", checkAuthor("Juan dela Cruz"), saved("Juan dela Cruz"));
check("after apostrophe and hyphen", fixCapitals("liam o'brien-santos"), "Liam O'Brien-Santos");
check("III stays in capitals", checkAuthor("JUAN DELA CRUZ III"), saved("Juan Dela Cruz III"));
check("ii / iv in capitals", [fixCapitals("jose rizal ii"), fixCapitals("JOSE RIZAL IV")], ["Jose Rizal II", "Jose Rizal IV"]);
check("jr. → Jr.", checkAuthor("jose rizal jr."), saved("Jose Rizal Jr."));
check("ñ capitalised", checkAuthor("ÑORA PEÑA"), saved("Ñora Peña"));
check("extra spaces trimmed", checkAuthor("  Juan   Dela  Cruz "), saved("Juan Dela Cruz"));

console.log("\n— Authors: the list —");
const add = (list: string[], typed: string): Added => addAuthor(list, typed);
check("added", add([], "Juan Dela Cruz"), { list: ["Juan Dela Cruz"] });
check("repeat ignoring case → note, not added", add(["Juan Dela Cruz"], "juan dela cruz"),
  { list: ["Juan Dela Cruz"], note: "Juan Dela Cruz is already in the list." });
check("invalid → error, not added", add([], "Dela Cruz"), { list: [], error: MSG.authorFull });
const ten = Array.from({ length: 10 }, (_, i) => `Author Number${"abcdefghij"[i]}`);
check("11th author refused", add(ten, "Juan Dela Cruz"), { list: ten, error: MSG.authorsMax });
check("blank → nothing", add(["Juan Dela Cruz"], " "), { list: ["Juan Dela Cruz"] });

console.log("\n— Adviser —");
check("required", checkAdviser("  "), err("", MSG.adviserRequired));
check("title Dr.", checkAdviser("Dr. Maria Santos"), saved("Dr. Maria Santos"));
check("title without period", checkAdviser("Engr Juan Dela Cruz"), saved("Engr Juan Dela Cruz"));
for (const t of ["Prof.", "Mr.", "Ms.", "Mrs.", "Atty.", "Asst. Prof.", "Assoc. Prof."]) {
  check(`title ${t}`, checkAdviser(`${t} Maria Santos`), saved(`${t} Maria Santos`));
}
check("title alone with surname is not a full name", checkAdviser("Dr. Santos"), err("Dr. Santos", MSG.adviserFull));
check("one word", checkAdviser("Santos"), err("Santos", MSG.adviserFull));
check("particle surname alone", checkAdviser("Prof. Dela Cruz"), err("Prof. Dela Cruz", MSG.adviserFull));
check("initial counts", checkAdviser("Dr. M. Santos"), saved("Dr. M. Santos"));
check("name starting like a title (Drake)", checkAdviser("Drake Santos"), saved("Drake Santos"));
check("degree after comma", checkAdviser("Maria Santos, PhD"), saved("Maria Santos, PhD"));
check("two degrees", checkAdviser("Dr. Maria Santos, EdD, RN"), saved("Dr. Maria Santos, EdD, RN"));
check("degree spelled Ph.D. → PhD", checkAdviser("Maria Santos, Ph.D."), saved("Maria Santos, PhD"));
for (const d of ["PhD", "EdD", "MSc", "MS", "MA", "MIT", "MBA", "RN", "PE", "CE"]) {
  check(`degree ${d}`, checkAdviser(`Maria Santos, ${d}`).error, null);
}
check("not a listed degree", checkAdviser("Maria Santos, DVM"), err("Maria Santos, DVM", MSG.adviserDegree));
check("no Surname, Given form for the adviser", checkAdviser("Santos, Maria"), err("Santos, Maria", MSG.adviserDegree));
check("digit rejected", checkAdviser("Dr. Maria Santos 3"), err("Dr. Maria Santos 3", MSG.nameChars));
check("all lowercase → capitals", checkAdviser("dr. maria santos"), saved("Dr. Maria Santos"));
check("ALL CAPS + degree", checkAdviser("ASST. PROF. MARIA SANTOS, PHD"), saved("Asst. Prof. Maria Santos, PhD"));
check("mixed case kept", checkAdviser("Dr. Maria dela Santos"), saved("Dr. Maria dela Santos"));
check("over 100 characters", checkAdviser("Dr. " + "A".repeat(50) + " " + "B".repeat(50)).error, MSG.nameLong(100));
check("spaces trimmed", checkAdviser("  Dr.  Maria   Santos "), saved("Dr. Maria Santos"));

console.log("\n— Title —");
check("required", checkTitle("   "), err("", MSG.titleRequired));
check("spaces collapsed", checkTitle("  Soil   pH and\nrice yield "), saved("Soil pH and rice yield"));
check("numbers only", checkTitle("2024 - 2025 / 001"), err("2024 - 2025 / 001", MSG.titleNoWords));
check("symbols only", checkTitle("**********"), err("**********", MSG.titleNoWords));
check("under 10 characters", checkTitle("Rice yield"), saved("Rice yield"));
check("9 characters", checkTitle("Soil test"), err("Soil test", MSG.titleShort));
check("300 characters", checkTitle("a".repeat(300)).error, null);
check("301 characters", checkTitle("a".repeat(301)).error, MSG.titleLong);
check("IoT, digits inside words fine", checkTitle("IoT-Based Irrigation for 2026 Rice Crops").error, null);

console.log("\n— Academic Year —");
check("digits kept", yearInput("2019"), "2019");
check("pasted with a word", yearInput("Year 2019"), "2019");
check("letters, spaces, symbols dropped", yearInput(" 2 0-1a9!"), "2019");
check("cut to 4 digits", yearInput("201999"), "2019");
check("no digits → empty", yearInput("abc"), "");
check("this year", checkYear("2026", 2026), saved("2026"));
check("any past year", checkYear("1965", 2026), saved("1965"));
check("next year", checkYear("2027", 2026), err("2027", "The year can't be later than 2026."));
check("3 digits", checkYear("201", 2026), err("201", MSG.yearFormat));
check("empty", checkYear("", 2026), err("", MSG.yearFormat));
check("message text", MSG.yearFormat, "Please type a 4-digit year, e.g. 2019.");
check("defaults to the real current year", checkYear(String(new Date().getFullYear() + 1)).error,
  MSG.yearFuture(new Date().getFullYear()));

console.log("\n— Abstract —");
check("required", checkAbstract(" \n "), err("", MSG.abstractRequired));
check("49 words", checkAbstract(words(49)).error, MSG.abstractShort(49));
check("50 words", checkAbstract(words(50)).error, null);
check("1 word (singular)", checkAbstract("Rice").error, MSG.abstractShort(1));
check("words counted across line breaks", countWords("rice\nsoil\tmaize  corn"), 4);
check("numbers do not count as words", countWords("1 2 3 rice 2024"), 1);
check("51 numbers + 10 words is short", checkAbstract(Array(51).fill("12").join(" ") + " " + words(10)).error, MSG.abstractShort(10));
check("over 5,000 characters", checkAbstract(words(50) + " " + "x".repeat(ABSTRACT_MAX)).error, MSG.abstractLong);
check("message says 5,000", MSG.abstractLong.includes("5,000"), true);
check("cleaned: spaces, blank lines", cleanAbstract("  First  para.\r\n\r\n\r\n\r\nSecond\t para.  "), "First para.\n\nSecond para.");

console.log("\n— Keywords —");
check("trimmed, trailing punctuation dropped", addKeywords([], "  rice  yield. "), { list: ["rice yield"] });
check("comma and semicolon split", addKeywords([], "rice, soil; maize"), { list: ["rice", "soil", "maize"] });
check("repeat ignoring case → note", addKeywords(["Rice"], "rice"), { list: ["Rice"], note: "rice is already in the list." });
check("repeats inside one add", addKeywords([], "rice, Rice, soil"), { list: ["rice", "soil"], note: "Rice is already in the list." });
check("1 character", addKeywords([], "x"), { list: [], error: MSG.keywordLength });
check("60 characters", addKeywords([], "k".repeat(60)).list.length, 1);
check("61 characters", addKeywords([], "k".repeat(61)), { list: [], error: MSG.keywordLength });
check("numbers only", addKeywords([], "2024"), { list: [], error: MSG.keywordNoWords });
check("symbols only", addKeywords([], "***"), { list: [], error: MSG.keywordNoWords });
check("COVID-19 passes", addKeywords([], "COVID-19"), { list: ["COVID-19"] });
check("one bad piece stops the whole add", addKeywords([], "rice, 2024"), { list: [], error: MSG.keywordNoWords });
const nine = Array.from({ length: 9 }, (_, i) => `keyword ${"abcdefghi"[i]}`);
check("10th keyword added", addKeywords(nine, "rice").list.length, 10);
check("11th keyword refused", addKeywords([...nine, "rice"], "soil"), { list: [...nine, "rice"], error: MSG.keywordsMax });
check("two that would pass 10 refused", addKeywords(nine, "rice, soil"), { list: nine, error: MSG.keywordsMax });
check("blank → nothing", addKeywords(["rice"], " , ; "), { list: ["rice"] });
check("read from the PDF: cleaned, repeats and junk dropped, max 10",
  cleanKeywordList([" Rice. ", "rice", "2024", "x", "soil", ...nine]),
  ["Rice", "soil", ...nine.slice(0, 8)]);

console.log("\n— Study PDF —");
const MB = 1024 * 1024;
check("PDF fine", pdfFileProblem({ name: "study.pdf", type: "application/pdf", size: 2 * MB }), null);
check("by name only", pdfFileProblem({ name: "Study.PDF", type: "", size: MB }), null);
check("not a PDF", pdfFileProblem({ name: "study.docx", type: "application/msword", size: MB }), { message: MSG.pdfNotPdf, keep: false });
check("empty", pdfFileProblem({ name: "study.pdf", type: "application/pdf", size: 0 }), { message: MSG.pdfEmpty, keep: false });
check("over 100 MB: warned, kept", pdfFileProblem({ name: "study.pdf", type: "application/pdf", size: 101 * MB }), { message: MSG.pdfTooLarge, keep: true });
check("existing size message unchanged", MSG.pdfTooLarge, "That PDF is larger than 100 MB. Please type the abstract and keywords.");

console.log("\n— Google Drive link —");
const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
check("file/d link", validateDriveLink(`https://drive.google.com/file/d/${id}/view?usp=sharing`), null);
check("open?id link, spaces around", validateDriveLink(`  https://drive.google.com/open?id=${id} `), null);
check("blank", validateDriveLink(" "), "Please paste a Google Drive link.");
check("not Drive", validateDriveLink("https://example.com/file.pdf"), "That does not look like a Google Drive link.");
check("no file id", validateDriveLink("https://drive.google.com/drive/folders"),
  "Could not find a file id in that link. Make sure it is a shared file link.");

console.log("\n— Edit study: a saved record's authors —");
check("cleaned as if typed", cleanAuthorList(["  juan   dela cruz ", "MARIA SANTOS"]),
  { list: ["Juan Dela Cruz", "Maria Santos"] } satisfies Added);
check("repeat (ignoring case) and blank dropped", cleanAuthorList(["Juan Dela Cruz", "juan dela cruz", " "]),
  { list: ["Juan Dela Cruz"] } satisfies Added);
check("an old name that fails is kept, with a message", cleanAuthorList(["Dela Cruz", "Maria Santos"]),
  { list: ["Dela Cruz", "Maria Santos"], error: MSG.authorStored("Dela Cruz", MSG.authorFull) } satisfies Added);
check("only the first failing name is named", cleanAuthorList(["Juan 2", "Dela Cruz"]).error,
  MSG.authorStored("Juan 2", MSG.nameChars));
check("no authors (older record)", cleanAuthorList([]), { list: [] } satisfies Added);

console.log("\n— Search boxes —");
check("trimmed, spaces collapsed", cleanQuery("  rice   yield "), "rice yield");
check("cut to 100", cleanQuery("a".repeat(150)).length, 100);
check("symbols only → empty", cleanQuery("!!! ---"), "");
check("digits are kept", cleanQuery("2024"), "2024");
check("ñ kept", cleanQuery(" niño "), "niño");

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
