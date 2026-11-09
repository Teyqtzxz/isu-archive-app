// Examples for colleges.ts (errata #87). Run with:  node src/colleges.check.ts
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
// Programme lines are written as title pages print them; no study's text.
import {
  COLLEGES, COLLEGE_NAMES, OLD_DEPARTMENTS, PROGRAMS, collegeOf, collegeOfProgram, isCollege, ownCollegeFilter, shortCollege,
} from "./colleges.ts";
import { countByDepartment } from "./stats.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got:  ${g}\n      want: ${w}`}`);
}

const full = (code: string) => COLLEGES.find(c => c.code === code)!.name;
/** The college's short form a programme line gives, "" for none. */
const codeOf = (line: string) => shortCollege(collegeOfProgram(line));
const expect = (code: string, lines: string[]) => {
  for (const l of lines) check(`${l} → ${code || "(empty)"}`, codeOf(l), code);
};

console.log("— The 12 colleges —");
check("12 colleges", COLLEGES.length, 12);
check("short forms", COLLEGES.map(c => c.code),
  ["CA", "CAS", "CBAPA", "CCJE", "CCSICT", "CED", "COE", "COM", "CON", "CGS", "IOF", "SVM"]);
check("full names are unique", new Set(COLLEGE_NAMES).size, 12);
check("short form of a full name", shortCollege("College of Computing Studies, Information and Communication Technology"), "CCSICT");
check("short form of anything else: as it is", shortCollege("Zoology"), "Zoology");

console.log("\n— Values read from studies, profiles and drafts —");
const OLD: [string, string][] = [
  ["Biology", "CAS"], ["Agriculture", "CA"], ["Computer Science", "CCSICT"], ["Forestry", "CA"],
  ["Chemical Engineering", "COE"], ["Environmental Science", "CA"], ["Education", "CED"],
  ["Business Administration", "CBAPA"], ["Civil Engineering", "COE"], ["Nursing", "CON"],
];
for (const [old, code] of OLD) check(`old “${old}” → ${code}`, collegeOf(old), full(code));
check("every old department is in the table", Object.keys(OLD_DEPARTMENTS).sort(), OLD.map(o => o[0]).sort());
check("old value with odd case and spaces", collegeOf("  computer   SCIENCE "), full("CCSICT"));
check("a full name stays", collegeOf("College of Nursing"), "College of Nursing");
check("a short form → its full name", collegeOf("ccsict"), full("CCSICT"));
check("unknown value stays as it is (trimmed), never lost", collegeOf(" Zoology "), "Zoology");
check("… and is not a college", isCollege(collegeOf("Zoology")), false);
check("empty stays empty", collegeOf(""), "");
check("missing (undefined) → empty", collegeOf(undefined), "");
check("not text → empty", collegeOf(42), "");

console.log("\n— A staff member's own college (default filter) —");
check("old profile value “Computer Science” → CCSICT", ownCollegeFilter("Computer Science"), full("CCSICT"));
check("old profile value “Nursing ” with a space → CON", ownCollegeFilter("Nursing "), full("CON"));
check("new profile value (full name)", ownCollegeFilter("College of Education"), full("CED"));
check("profile value as a short form", ownCollegeFilter("COE"), full("COE"));
check("unknown profile value → All colleges", ownCollegeFilter("Research Office"), "");
check("no profile value → All colleges", ownCollegeFilter(""), "");

console.log("\n— Statistics: old values counted under their college, unknown under Other —");
const rows = countByDepartment([
  { department: collegeOf("Agriculture") }, { department: collegeOf("Forestry") },
  { department: collegeOf("College of Agriculture") }, { department: collegeOf("Zoology") },
]);
check("CA counts the old Agriculture and Forestry studies", rows.find(r => r.department === full("CA"))?.count, 3);
check("the unknown value under Other", rows.find(r => r.department === "Other")?.count, 1);
check("12 rows + Other", rows.length, 13);

console.log("\n— Programme table —");
expect("SVM", ["Doctor of Veterinary Medicine", "Bachelor of Science in Animal Husbandry", "BS Animal Husbandry"]);
expect("CA", [
  "Bachelor of Science in Agriculture", "BS Agriculture", "B.S. Agriculture",
  "Bachelor of Science major in Agronomy", "BS major in Animal Science", "BS major in Horticulture", "BS major in Soil Science",
  "Bachelor of Science in Agriculture major in Agronomy",
  "Bachelor of Science in Agribusiness", "Bachelor of Science in Forestry", "Bachelor of Science in Environmental Science",
  "3-Year Diploma in Agricultural Technology",
  "Master of Science major in Crop Science", "MS major in Animal Science",
  "Doctor of Philosophy major in Crop Science", "PhD major in Animal Science",
]);
expect("CAS", [
  "Bachelor of Science in Biology", "Bachelor of Science in Mathematics", "Bachelor of Science in Chemistry",
  "Bachelor of Science in Psychology", "Bachelor of Arts in Communication", "AB Communication", "BA Communication",
  "Bachelor of Arts in English", "AB English", "Bachelor of Arts in English Language Studies", "BA English Language Studies",
  "Master of Arts in Psychology", "Master of Arts in English", "Master of Science in Mathematics Education",
  "Master of Science in Chemical Education", "Master of Science in Biology",
]);
expect("CBAPA", [
  "Bachelor of Science in Business Administration", "Bachelor of Science in Business Administration major in Marketing Management",
  "Bachelor in Public Administration", "Bachelor of Public Administration", "Bachelor of Science in Management Accounting",
  "Bachelor of Science in Entrepreneurship", "Bachelor of Science in Accountancy",
  "Bachelor of Science in Hospitality Management", "Bachelor of Science in Tourism Management",
]);
expect("COE", [
  "Bachelor of Science in Agricultural Engineering", "Bachelor of Science in Agricultural and Biosystems Engineering",
  "BS Agricultural & Biosystems Engineering", "Bachelor of Science in Civil Engineering",
  "Master of Science in Agricultural Engineering", "Master of Science in Agricultural Engineering major in Farm Power",
]);
expect("CED", [
  "Bachelor of Elementary Education", "Bachelor of Secondary Education", "Bachelor of Secondary Education major in English",
  "Bachelor of Physical Education", "Bachelor of Early Childhood Education",
  "Bachelor of Technology and Livelihood Education", "Bachelor of Technology and Livelihood Education major in Home Economics",
  "Master of Arts in Education", "Master of Arts in Education major in Educational Management", "MA in Education",
  "Doctor of Philosophy in Educational Leadership and Management", "PhD in Educational Leadership & Management",
]);
expect("CCSICT", [
  "Bachelor of Science in Information Technology", "Bachelor of Science in Information Systems",
  "Bachelor of Science in Computer Science", "Bachelor of Science in Computer Science (BSCS)",
  "Bachelor of Library and Information Science", "Bachelor of Library Information Science",
  "Master in Information Technology", "Master of Information Technology",
]);
// BS Data Science and Analytics: one programme of its own; "and Analytics" is
// part of its name, never a second programme.
expect("CCSICT", [
  "Bachelor of Science in Data Science and Analytics", "BS Data Science and Analytics",
  "B.S. in Data Science & Analytics", "BSDSA", "Bachelor of Science in Data Science and Analytics (BSDSA)",
]);
expect("", ["DSA", "Bachelor of Science in Data Science"]);
check("BS Data Science and Analytics is one programme: CCSICT alone, not CCSICT + another",
  [codeOf("BS Data Science and Analytics and BS Nursing"), codeOf("BS Data Science and Analytics and BS Computer Science")], ["", "CCSICT"]);
check("“and Analytics” is not a second programme (no “BS Analytics”)", codeOf("BS Data Science and BS Analytics"), "");
expect("CCJE", ["Bachelor of Science in Criminology", "Bachelor of Science in Law Enforcement Administration"]);
expect("CON", ["Bachelor of Science in Nursing", "BS Nursing"]);
expect("IOF", ["Bachelor of Science in Fisheries and Aquatic Sciences", "BS Fisheries & Aquatic Sciences"]);
expect("COM", ["Doctor of Medicine"]);
check("CGS is never filled in automatically: no programme names it", PROGRAMS.some(p => p.code === "CGS"), false);
check("every other college has programmes", COLLEGES.filter(c => c.code !== "CGS" && !PROGRAMS.some(p => p.code === c.code)).length, 0);
check("a college's own name is not a programme", codeOf("Central Graduate School"), "");

console.log("\n— Short forms printed on title pages —");
expect("CCSICT", ["BSCS", "BSIT", "BSIS", "BSCS major in Data Mining"]);
expect("CON", ["BSN"]);
expect("CED", ["BEEd", "BSEd", "BSEd major in Mathematics", "BPEd", "BTLEd"]);
expect("CCJE", ["BSCrim"]);
expect("CBAPA", ["BSBA", "BPA", "BSMA"]);
// BSA is ambiguous: Agriculture or Accountancy.
expect("", ["BSA", "B.S.A.", "BSA major in Animal Science"]);
// … but a full name with "(BSA)" in brackets after it is the full name.
expect("CA", ["Bachelor of Science in Agriculture (BSA)"]);
expect("CBAPA", ["Bachelor of Science in Accountancy (BSA)"]);

console.log("\n— Traps: the wrong college must not match —");
expect("CED", [
  "Bachelor of Technology and Livelihood Education major in Information and Communication Technology",
  "Bachelor of Technology and Livelihood Education major in Agri-Fishery Arts",
  "Bachelor of Secondary Education major in Mathematics",
  "Bachelor of Secondary Education major in Biological Science",
]);
expect("CAS", ["Master of Science in Mathematics Education"]);
expect("SVM", ["Doctor of Veterinary Medicine"]);
expect("COM", ["Doctor of Medicine"]);
expect("CA", ["BS major in Animal Science"]);
expect("SVM", ["BS Animal Husbandry"]);
expect("COE", ["Bachelor of Science in Agricultural Engineering", "Master of Science in Agricultural Engineering"]);
expect("", [
  "Bachelor of Science",                                // a major is needed for the major-only programmes
  "Bachelor of Science major in Information Technology",// not one of CA's majors
  "Master of Science major in Horticulture",            // MS: only Crop / Animal Science
  "Master of Agricultural Development",                 // "Agricultural" alone is not Agriculture
  "Bachelor of Science in Agriculture Engineering Technology",
  "MASTER OF ENVIRONMENT AND NATURAL RESOURCES MANAGEMENT",
  "MASTER OF ARTS IN NURSING",                          // UP Open University, not ISU
  "MASTER OF INFORMATION SYSTEMS",
  "Doctor of Communication",
  "College of Agriculture",
  "",
]);

console.log("\n— Several programmes in one line —");
expect("CA", ["Bachelor of Science in Agriculture and Forestry", "BS Agriculture, BS Forestry and BS Agribusiness",
  "BS Agriculture / BS Environmental Science"]);
expect("CCSICT", ["BS Computer Science and Information Technology", "BSCS and BSIT"]);
expect("", ["BS Agriculture and BS Nursing", "Bachelor of Science in Computer Science and Nursing",
  "Bachelor of Elementary Education and BS Biology"]);

console.log("\n— Specialization tracks and extra words —");
expect("CCSICT", ["Bachelor of Science in Computer Science-Data Mining Track", "BS Computer Science – Network Security Track",
  "BS Information Technology, Web and Mobile Development Track"]);
expect("", [
  "Bachelor of Science in Computer Science, Isabela State University",
  "Bachelor of Science in Computer Science Isabela State University Echague Campus",
  "BS Agriculture and Forestry Data Mining Track",                    // a track only after one programme
  "BS Computer Science Track",                                        // no track name
]);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
