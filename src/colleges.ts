// The 12 colleges of ISU Echague (errata #87), which replaced the 10 fixed
// "departments". Pure — no React, no Firebase — so colleges.check.ts can test
// it in Node.
//
// The Firestore field is still called `department` (no data migration, no
// rules change): it holds the college's full name. Values saved before #87
// (an old department name) are translated when they are READ — studies,
// users/{uid}.department, drafts — and never written back. Saving or editing
// a study writes the full college name.

export interface College {
  /** Short form: badges, chart labels, chips — anywhere space is tight. */
  code: string;
  /** Full name: what is stored, and shown in dropdowns and details. */
  name: string;
}

export const COLLEGES: readonly College[] = [
  { code: "CA", name: "College of Agriculture" },
  { code: "CAS", name: "College of Arts and Sciences" },
  { code: "CBAPA", name: "College of Business, Accountancy and Public Administration" },
  { code: "CCJE", name: "College of Criminal Justice Education" },
  { code: "CCSICT", name: "College of Computing Studies, Information and Communication Technology" },
  { code: "CED", name: "College of Education" },
  { code: "COE", name: "College of Engineering" },
  { code: "COM", name: "College of Medicine and Allied Health Professions" },
  { code: "CON", name: "College of Nursing" },
  { code: "CGS", name: "Central Graduate School" },
  { code: "IOF", name: "Institute of Fisheries" },
  { code: "SVM", name: "School of Veterinary Medicine" },
];

/** The full names, as exact strings: filter values, dropdown values, stored values. */
export const COLLEGE_NAMES: readonly string[] = COLLEGES.map(c => c.name);

const BY_CODE = new Map(COLLEGES.map(c => [c.code, c]));
const name = (code: string) => BY_CODE.get(code)!.name;

/** The 10 departments used before errata #87, and the college each became. */
export const OLD_DEPARTMENTS: Readonly<Record<string, string>> = {
  "Biology": "CAS",
  "Agriculture": "CA",
  "Computer Science": "CCSICT",
  "Forestry": "CA",
  "Chemical Engineering": "COE",
  "Environmental Science": "CA",
  "Education": "CED",
  "Business Administration": "CBAPA",
  "Civil Engineering": "COE",
  "Nursing": "CON",
};

const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
/** Full name, short form or old department name → full college name. */
const ALIASES = new Map<string, string>([
  ...COLLEGES.flatMap(c => [[key(c.name), c.name], [key(c.code), c.name]] as [string, string][]),
  ...Object.entries(OLD_DEPARTMENTS).map(([old, code]) => [key(old), name(code)] as [string, string]),
]);

/**
 * The value read from a study, a staff profile or a draft, as a college:
 * the full name for a college's full name, short form or old department name
 * (any case, extra spaces ignored). Anything else — "" or a value typed by
 * hand — comes back unchanged (only trimmed), so it is still shown and never
 * lost; isCollege() tells the two apart.
 */
export function collegeOf(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return ALIASES.get(key(s)) ?? s;
}

/** True for exactly one of the 12 full names. */
export function isCollege(value: string): boolean {
  return COLLEGE_NAMES.includes(value);
}

/**
 * Where a staff member's filters start: their own college, read from
 * users/{uid}.department through collegeOf (so an old department name such as
 * "Computer Science" still works), or "" = All colleges when it is unset or
 * not one of the 12.
 */
export function ownCollegeFilter(profileValue: unknown): string {
  const c = collegeOf(profileValue);
  return isCollege(c) ? c : "";
}

/** The short form of a college's full name; any other value as it is. */
export function shortCollege(value: string): string {
  return COLLEGES.find(c => c.name === value)?.code ?? value;
}

// ─── The college a programme line names (PDF auto-fill) ──────────────────────

/** A programme, normalized (see normalizeProgram). `majors`: only these
 *  majors, which must be given; none = any major or none at all. */
interface Program { head: string; majors?: string[]; code: string }

const P = (code: string, ...heads: string[]): Program[] => heads.map(head => ({ head, code }));
const M = (code: string, head: string, ...majors: string[]): Program => ({ head, majors, code });

/** The exact programme table. CGS (Central Graduate School) is never filled
 *  in automatically: no programme here names it. */
export const PROGRAMS: readonly Program[] = [
  ...P("SVM", "doctor of veterinary medicine", "bs animal husbandry"),
  ...P("CA", "bs agriculture", "bs agribusiness", "bs forestry", "bs environmental science",
    "3 year diploma in agricultural technology"),
  M("CA", "bs", "agronomy", "animal science", "horticulture", "soil science"),
  M("CA", "ms", "crop science", "animal science"),
  M("CA", "phd", "crop science", "animal science"),
  ...P("CAS", "bs biology", "bs mathematics", "bs chemistry", "bs psychology",
    "ab communication", "ab english", "ab english language studies",
    "ma psychology", "ma english", "ms mathematics education", "ms chemical education", "ms biology"),
  ...P("CBAPA", "bs business administration", "bachelor of public administration", "bs management accounting",
    "bs entrepreneurship", "bs accountancy", "bs hospitality management", "bs tourism management"),
  ...P("COE", "bs agricultural engineering", "bs agricultural and biosystems engineering",
    "bs civil engineering", "ms agricultural engineering"),
  ...P("CED", "bachelor of elementary education", "bachelor of secondary education",
    "bachelor of physical education", "bachelor of early childhood education",
    "bachelor of technology and livelihood education", "ma education",
    "phd educational leadership and management"),
  ...P("CCSICT", "bs information technology", "bs information systems", "bs computer science",
    "bs data science and analytics",
    "bachelor of library and information science", "master of information technology"),
  ...P("CCJE", "bs criminology", "bs law enforcement administration"),
  ...P("CON", "bs nursing"),
  ...P("IOF", "bs fisheries and aquatic sciences"),
  ...P("COM", "doctor of medicine"),
];

/** Short forms printed on title pages, as the programme they stand for.
 *  BSA is left out on purpose: Agriculture or Accountancy (see AMBIGUOUS). */
const SHORT_FORMS: Readonly<Record<string, string>> = {
  bscs: "bs computer science",
  bsit: "bs information technology",
  bsis: "bs information systems",
  bsdsa: "bs data science and analytics",
  bsn: "bs nursing",
  beed: "bachelor of elementary education",
  bsed: "bachelor of secondary education",
  bped: "bachelor of physical education",
  btled: "bachelor of technology and livelihood education",
  bscrim: "bs criminology",
  bsba: "bs business administration",
  bpa: "bachelor of public administration",
  bsma: "bs management accounting",
};
/** Short forms that name more than one programme: the line gives no college. */
const AMBIGUOUS = /\bbsa\b/;

/** Degree words that a second programme in the same line may leave out
 *  ("BS Agriculture and Forestry" = BS Agriculture and BS Forestry). */
const DEGREE = /^(bs|ab|ms|ma|phd) /;

/**
 * A programme line in one spelling: lower case, "&" = "and", no dots ("B.S."
 * = "BS"), no brackets ("(BSCS)" is dropped), one space between words,
 * "Bachelor of Science (in)" = "BS", "Bachelor of Arts (in)" / "BA" = "AB",
 * "Master of Science" = "MS", "Master of Arts" = "MA", "Doctor of Philosophy"
 * = "PhD", "Bachelor in" / "Master in" = "of", "Library Information Science"
 * = "Library and Information Science", and short forms written out.
 */
export function normalizeProgram(line: string): string {
  let s = line.toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[.’']/g, "")
    .replace(/[^a-z0-9,/;]+/g, " ")
    .replace(/\s*([,/;])\s*/g, " $1 ")
    .replace(/\s+/g, " ").trim();
  s = s.split(" ").map(w => SHORT_FORMS[w] ?? w).join(" ");
  s = (" " + s + " ")
    .replace(/ bachelor of science /g, " bs ")
    .replace(/ bachelor of arts /g, " ab ")
    .replace(/ master of science /g, " ms ")
    .replace(/ master of arts /g, " ma ")
    .replace(/ doctor of philosophy /g, " phd ")
    .replace(/ ba /g, " ab ")
    .replace(/ (bachelor|master) in /g, " $1 of ")
    .replace(/ (bs|ab|ms|ma|phd) in /g, " $1 ")
    .replace(/ library information science /g, " library and information science ");
  return s.replace(/\s+/g, " ").trim();
}

/** Programmes, longest first, so "bs agricultural engineering" is tried
 *  before anything shorter it starts with. */
const BY_LENGTH = [...PROGRAMS].sort((a, b) => b.head.length - a.head.length);
const SEPARATOR = /^ (?:and|,|\/|;)(?: and)? /;
/** One to four words ending in "track", optionally after a separator: the
 *  whole rest of the line. Not starting with "and", which joins a second
 *  programme ("BS Agriculture and Forestry … Track" is not one track). */
const TRACK = /^(?: [,/;])? (?!and )[a-z0-9]+(?: [a-z0-9]+){0,3} track$/;

/** The colleges of `heads`: one or more programmes joined by "and", ",", "/"
 *  or ";", each one exactly a programme of the table. null: a part that is
 *  not one. `major`: what followed "major in" (only allowed after one
 *  programme). */
function collegesOfHeads(heads: string, major: string): string[] | null {
  const degree = DEGREE.exec(heads)?.[1];
  const parse = (rest: string, first: boolean): string[] | null => {
    // A later part may leave out the degree: "bs agriculture and forestry".
    const tries = first || !degree || DEGREE.test(rest) ? [rest] : [rest, `${degree} ${rest}`];
    let hit: { code: string; after: string } | null = null;
    for (const t of tries) {
      for (const p of BY_LENGTH) {
        if (p.majors) {
          // A programme known only by its major: the whole line, nothing else.
          if (first && t === p.head && p.majors.includes(major)) hit = { code: p.code, after: "" };
        } else if (t === p.head || t.startsWith(p.head + " ")) {
          hit = { code: p.code, after: t.slice(p.head.length) };
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) return null;
    if (!hit.after) return first || !major ? [hit.code] : null;
    // Another programme after a separator, first: "… and forestry".
    const sep = SEPARATOR.exec(hit.after);
    const more = sep ? parse(hit.after.slice(sep[0].length), false) : null;
    if (more) return first && major ? null : [hit.code, ...more];
    // Else a specialization track after one programme counts like "major in":
    // "BS Computer Science-Data Mining Track" (an ISU BSCS thesis prints it so).
    if (first && !major && TRACK.test(hit.after)) return [hit.code];
    return null;                        // extra words after a programme: not one of the table
  };
  return parse(heads, true);
}

/**
 * The full name of the one college a programme line names (the "Program:"
 * line of the abstract page, or the degree line of the title page), or ""
 * when it names none, or programmes of more than one college — never a guess.
 *
 * The line is matched against the exact programme table above, not single
 * words: "Bachelor of Secondary Education major in Mathematics" is Education,
 * not Mathematics. What comes after "major in" only matters for the programmes
 * the table names by their major ("BS major in Animal Science" = CA). A
 * specialization ending in "Track" right after one programme is read the same
 * way as a major ("BS Computer Science Data Science Track" = CCSICT). Several
 * programmes in one line ("BS Agriculture and Forestry") give their college
 * when all of them belong to the same one.
 */
export function collegeOfProgram(line: string): string {
  const s = normalizeProgram(line);
  if (!s || AMBIGUOUS.test(s)) return "";
  const m = / major(?: in)? /.exec(` ${s} `);
  const heads = m ? s.slice(0, m.index - 1).trim() : s;
  const major = m ? s.slice(m.index - 1 + m[0].length - 1).trim() : "";
  const codes = collegesOfHeads(heads, major);
  if (!codes || new Set(codes).size !== 1) return "";
  return name(codes[0]);
}
