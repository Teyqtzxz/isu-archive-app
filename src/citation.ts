// APA 7 citations for posted studies. Pure: no Firebase, no DOM — like
// search.ts and stats.ts, so it can be checked on its own
// (node src/citation.check.ts).
//
// Reference (Study Details):
//   Acosta, J. R., & Mindanao, L. (2026). *Title as typed* [Unpublished research
//   study]. Isabela State University – Echague Campus.
// In-text (combined summary):
//   (Acosta, 2026) · (Acosta & Mindanao, 2026) · (Acosta et al., 2026)
// No URL: the Drive links open for ISU accounts only, so they are not retrievable.
import type { Thesis } from "./types";

/** The wording asked for by the professor. Theses and capstones are both "studies". */
export const APA_WORK_TYPE = "Unpublished research study";
export const APA_PUBLISHER = "Isabela State University – Echague Campus";

/** Words that belong to the surname when they come right before it:
 *  "Juan Dela Cruz", "Maria De los Santos", "Ana Sta. Maria". */
export const PARTICLES = new Set([
  "de", "del", "dela", "della", "la", "las", "los", "delos", "di", "da", "du",
  "san", "santa", "sta.", "sto.", "santo", "van", "von", "der", "le", "y",
]);
/** Name suffixes APA keeps after the initials: "Rizal, J., Jr." */
export const SUFFIX = /^(jr|sr)\.?$|^(ii|iii|iv|v)$/i;

/** "Jr" / "jr." → "Jr."; "iii" → "III". */
function normaliseSuffix(s: string): string {
  return /^(jr|sr)\.?$/i.test(s) ? s.charAt(0).toUpperCase() + s.charAt(1).toLowerCase() + "." : s.toUpperCase();
}

/** "Jan" → "J.", "Jan-Rhyanne" → "J.-R.", "P." → "P.", "Ma." → "M." */
function initialOf(word: string): string {
  return word
    .split("-")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + ".")
    .join("-");
}

export interface NameParts {
  surname: string;
  /** Given and middle names as typed, in order. */
  given: string[];
  /** "Jr.", "Sr.", "III"… or "". */
  suffix: string;
}

/**
 * Splits a typed author name. The last word is the surname, together with any
 * particles right before it; a Filipino middle name (the mother's surname)
 * stays a given name, so it becomes a middle initial in APA.
 * "Surname, Given names" is also accepted and taken as written — the way to
 * type a two-word surname that has no particle ("Santos Reyes, Maria").
 */
export function splitName(full: string): NameParts {
  const name = full.trim().replace(/\s+/g, " ");
  if (!name) return { surname: "", given: [], suffix: "" };

  if (name.includes(",")) {
    const parts = name.split(",").map(p => p.trim()).filter(Boolean);
    // "Rizal, Jose" stays as written; "Jose Rizal, Jr." is not a comma form.
    if (parts.length >= 2 && !SUFFIX.test(parts[1])) {
      const given = parts[1].split(" ");
      let suffix = parts[2] && SUFFIX.test(parts[2]) ? parts[2] : "";
      if (!suffix && given.length > 1 && SUFFIX.test(given[given.length - 1])) suffix = given.pop()!;
      return { surname: parts[0], given, suffix: suffix && normaliseSuffix(suffix) };
    }
  }

  const words = name.replace(/,/g, " ").split(" ").filter(Boolean);
  let suffix = "";
  if (words.length > 1 && SUFFIX.test(words[words.length - 1])) suffix = normaliseSuffix(words.pop()!);
  if (words.length === 1) return { surname: words[0], given: [], suffix };
  let start = words.length - 1;
  // Pull particles into the surname, but always leave at least one given name.
  while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase())) start--;
  return { surname: words.slice(start).join(" "), given: words.slice(0, start), suffix };
}

/**
 * A typed name as an APA 7 reference author: "Surname, I. I., Suffix".
 * "Juan Dela Cruz" → "Dela Cruz, J." · "Jose Rizal Jr." → "Rizal, J., Jr."
 */
export function apaName(full: string): string {
  const { surname, given, suffix } = splitName(full);
  if (!surname) return "";
  const initials = given.map(initialOf).join(" ");
  return [surname, initials, suffix].filter(Boolean).join(", ");
}

/** APA 7 reference author list: 1 → A; 2 → A, & B; 3–20 → A, B, & C; 21+ → first 19, . . . last. */
export function apaAuthorList(authors: string[]): string {
  const names = authors.map(apaName).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(", ")}, . . . ${names[names.length - 1]}`;
}

export interface ApaReference {
  /** Authors and year, before the italic title. */
  lead: string;
  /** The title exactly as typed — shown in italics. */
  title: string;
  /** Everything after the italic title. */
  tail: string;
}

type Citable = Pick<Thesis, "authors" | "title" | "year">;

/**
 * The full APA 7 reference, in three parts so the UI can put the title in
 * <em> without building an HTML string. null when the study has no authors
 * recorded (saved before the field existed): the screen says "Not recorded"
 * rather than showing a reference with no authors.
 */
export function apaReference(t: Citable): ApaReference | null {
  const authors = apaAuthorList(t.authors);
  if (!authors) return null;
  // "J. R." already ends with a period; "Rizal, J., Jr." too. Never doubled.
  const lead = `${/[.?!]$/.test(authors) ? authors : authors + "."} (${t.year}). `;
  // The title is kept as typed; only a final period goes, since the bracket follows it.
  const title = t.title.trim().replace(/\s+/g, " ").replace(/\.$/, "");
  return { lead, title, tail: ` [${APA_WORK_TYPE}]. ${APA_PUBLISHER}.` };
}

/** The reference as plain text (title not marked), or "" with no authors. */
export function apaReferenceText(t: Citable): string {
  const r = apaReference(t);
  return r ? r.lead + r.title + r.tail : "";
}

/** An in-text citation in parts: `italic` marks a title standing in for the
 *  authors, which APA sets in italics like the title in the reference. */
export interface InText {
  who: string;
  italic: boolean;
  year: string;
}

/**
 * APA 7 parenthetical in-text citation: (Acosta, 2026), (Acosta & Mindanao,
 * 2026), (Acosta et al., 2026). Surnames only, suffixes dropped. With no
 * authors recorded, APA uses the first few words of the title, in italics.
 */
export function apaInText(t: Citable): InText {
  const surnames = t.authors.map(a => splitName(a).surname).filter(Boolean);
  const year = String(t.year);
  if (surnames.length === 0) {
    const words = t.title.trim().split(/\s+/);
    return { who: words.slice(0, 4).join(" ") + (words.length > 4 ? "…" : ""), italic: true, year };
  }
  const who = surnames.length === 1 ? surnames[0]
    : surnames.length === 2 ? `${surnames[0]} & ${surnames[1]}`
    : `${surnames[0]} et al.`;
  return { who, italic: false, year };
}

/** "(Acosta & Mindanao, 2026)" — plain text, for labels and checks. */
export const inTextString = (c: InText) => `(${c.who}, ${c.year})`;

/**
 * In-text citations for several studies cited together, keyed by id. Two
 * different studies that would read the same — same first author and year —
 * get APA's year letters, ordered by title: (Santos, 2026a), (Santos, 2026b).
 */
export function apaInTextLabels(theses: (Citable & Pick<Thesis, "id">)[]): Map<string, InText> {
  const groups = new Map<string, (Citable & Pick<Thesis, "id">)[]>();
  for (const t of theses) {
    const key = inTextString(apaInText(t));
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const labels = new Map<string, InText>();
  for (const group of groups.values()) {
    if (group.length === 1) { labels.set(group[0].id, apaInText(group[0])); continue; }
    [...group]
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((t, i) => {
        const c = apaInText(t);
        labels.set(t.id, { ...c, year: c.year + String.fromCharCode(97 + i) });
      });
  }
  return labels;
}
