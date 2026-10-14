// Examples for citation.ts. Run with:  node src/citation.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import { apaInText, apaInTextLabels, apaName, apaReferenceText, inTextString } from "./citation.ts";

let failed = 0;
function check(label: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${got}${ok ? "" : `\n      want: ${want}`}`);
}

const study = (authors: string[], year = 2026, title = "Flood risk mapping of Echague using GIS") =>
  ({ id: title + authors.join(), authors, year, title });

console.log("— Author names (reference list form) —");
check("given + surname", apaName("Luigi Mindanao"), "Mindanao, L.");
check("two given names", apaName("Jan Rhyanne Acosta"), "Acosta, J. R.");
check("Dela Cruz", apaName("Juan Dela Cruz"), "Dela Cruz, J.");
check("De los Santos", apaName("Maria De los Santos"), "De los Santos, M.");
check("suffix Jr.", apaName("Jose Rizal Jr."), "Rizal, J., Jr.");
check("Sta. Maria", apaName("Ana Sta. Maria"), "Sta. Maria, A.");
check("middle initial + particle + suffix", apaName("Juan P. Dela Cruz III"), "Dela Cruz, J. P., III");
check("Filipino middle name", apaName("Maria Santos Reyes"), "Reyes, M. S.");
check("Ma. abbreviation", apaName("Ma. Clara De la Cruz"), "De la Cruz, M. C.");
check("hyphenated given name", apaName("Jan-Rhyanne Acosta"), "Acosta, J.-R.");
check("typed as Surname, Given", apaName("Santos Reyes, Maria"), "Santos Reyes, M.");
check("comma before suffix", apaName("Jose Rizal, Jr."), "Rizal, J., Jr.");
check("extra spaces", apaName("  Juan   Dela  Cruz "), "Dela Cruz, J.");

console.log("\n— Full reference (Study Details) —");
check("two authors", apaReferenceText(study(["Jan Rhyanne Acosta", "Luigi Mindanao"])),
  "Acosta, J. R., & Mindanao, L. (2026). Flood risk mapping of Echague using GIS [Unpublished research study]. Isabela State University – Echague Campus.");
check("one author with suffix (no doubled period)", apaReferenceText(study(["Jose Rizal Jr."], 2025)),
  "Rizal, J., Jr. (2025). Flood risk mapping of Echague using GIS [Unpublished research study]. Isabela State University – Echague Campus.");
check("three authors", apaReferenceText(study(["Juan Dela Cruz", "Maria De los Santos", "Ana Sta. Maria"])),
  "Dela Cruz, J., De los Santos, M., & Sta. Maria, A. (2026). Flood risk mapping of Echague using GIS [Unpublished research study]. Isabela State University – Echague Campus.");
check("title kept as typed, final period dropped",
  apaReferenceText(study(["Luigi Mindanao"], 2026, "A Study of IoT-Based Irrigation in Isabela.")),
  "Mindanao, L. (2026). A Study of IoT-Based Irrigation in Isabela [Unpublished research study]. Isabela State University – Echague Campus.");
check("no authors → no reference (screen shows Not recorded)", apaReferenceText(study([])), "");
const many = Array.from({ length: 22 }, (_, i) => `Student ${String.fromCharCode(65 + i)}lpha`);
check("21+ authors: first 19, . . . last", apaReferenceText(study(many)).split(" (2026)")[0],
  many.slice(0, 19).map(n => `${n.split(" ")[1]}, S.`).join(", ") + ", . . . Vlpha, S.");

console.log("\n— In-text citations (combined summary) —");
check("one author", inTextString(apaInText(study(["Luigi Mindanao"]))), "(Mindanao, 2026)");
check("two authors", inTextString(apaInText(study(["Jan Rhyanne Acosta", "Luigi Mindanao"]))), "(Acosta & Mindanao, 2026)");
check("three or more", inTextString(apaInText(study(["Jan Rhyanne Acosta", "Luigi Mindanao", "Juan Dela Cruz"]))), "(Acosta et al., 2026)");
check("multi-word surname, suffix dropped", inTextString(apaInText(study(["Juan Dela Cruz Jr.", "Ana Sta. Maria"]))), "(Dela Cruz & Sta. Maria, 2026)");
const noAuthors = apaInText(study([]));
check("no authors → short title, shown in italics", `${inTextString(noAuthors)} italic=${noAuthors.italic}`, "(Flood risk mapping of…, 2026) italic=true");
const a = study(["Maria Santos"], 2026, "Water quality of the Magat River");
const b = study(["Maria Santos"], 2026, "Abaca fiber strength");
const labels = apaInTextLabels([a, b]);
check("same author + year → 2026a (title A first)", inTextString(labels.get(b.id)!), "(Santos, 2026a)");
check("same author + year → 2026b", inTextString(labels.get(a.id)!), "(Santos, 2026b)");

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
