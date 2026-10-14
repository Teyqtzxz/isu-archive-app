// Input rules for the Register form and the search boxes. Pure: no React, no
// Firebase, no pdf.js — like citation.ts, so every rule can be checked on its
// own (node src/validation.check.ts).
//
// Each check takes what was typed and returns either the cleaned value to
// save or the message to show under the field. Cleaning (spaces, capitals) is
// never an error. These are browser-side checks only: firestore.rules does not
// check field contents yet.
import { PARTICLES, SUFFIX } from "./citation.ts";

export const MAX_AUTHORS = 10;
export const MAX_KEYWORDS = 10;
export const MAX_NAME = 80;
export const MAX_ADVISER = 100;
export const TITLE_MIN = 10;
export const TITLE_MAX = 300;
/** The title's character counter appears from here. */
export const TITLE_COUNTER_FROM = 250;
export const ABSTRACT_MIN_WORDS = 50;
/** The PDF reader stops at 4,000 characters, so a read abstract always fits. */
export const ABSTRACT_MAX = 5000;
/** The abstract's character counter appears from here. */
export const ABSTRACT_COUNTER_FROM = 4500;
export const KEYWORD_MIN = 2;
export const KEYWORD_MAX = 60;
export const SEARCH_MAX = 100;
/** Larger than any thesis PDF; stops someone picking a huge file by mistake. */
export const MAX_PDF_MB = 100;

export const MSG = {
  driveRequired: "Please paste the Google Drive link of the study PDF.",
  driveRequiredWithPdf: "Paste the study's Google Drive link too. The PDF is read from this computer, but the link is what students open to read the full study.",
  titleRequired: "Please fill in the title.",
  titleNoWords: "The title must contain words, not only numbers or symbols.",
  titleShort: "The title looks too short. Type the full title as it appears on the study.",
  titleLong: `The title is too long (max ${TITLE_MAX} characters).`,
  authorsRequired: "Please add at least one author.",
  authorFull: "Type the author's full name, e.g. Juan Dela Cruz",
  authorsMax: `Up to ${MAX_AUTHORS} authors can be added.`,
  /** A saved author name (Edit study) that would not pass today's check. */
  authorStored: (name: string, problem: string) => `Fix “${name}”: remove it and add it again. ${problem}`,
  nameChars: "Names can only have letters, spaces and . , ' - (no numbers or symbols).",
  nameLong: (max: number) => `That name is too long (max ${max} characters).`,
  departmentRequired: "Please choose a department.",
  yearFormat: "Please type a 4-digit year, e.g. 2019.",
  yearFuture: (thisYear: number) => `The year can't be later than ${thisYear}.`,
  adviserRequired: "Please fill in the adviser.",
  adviserFull: "Type the adviser's full name, e.g. Dr. Maria Santos",
  adviserDegree: "After a comma, only a degree can follow: PhD, EdD, MSc, MS, MA, MIT, MBA, RN, PE, CE.",
  abstractRequired: "Please fill in: Abstract. Copy it from the PDF. Search uses it to find this study.",
  abstractShort: (words: number) =>
    `The abstract looks too short (${words} word${words === 1 ? "" : "s"}). Copy the full abstract from the PDF — at least ${ABSTRACT_MIN_WORDS} words.`,
  abstractLong: `The abstract is too long (max ${ABSTRACT_MAX.toLocaleString("en-US")} characters). Copy only the abstract, not the next section.`,
  keywordLength: `A keyword must be ${KEYWORD_MIN} to ${KEYWORD_MAX} characters.`,
  keywordNoWords: "A keyword must contain a word, not only numbers or symbols.",
  keywordsMax: `Up to ${MAX_KEYWORDS} keywords can be added.`,
  alreadyListed: (items: string[]) => `${items.join(", ")} ${items.length === 1 ? "is" : "are"} already in the list.`,
  pdfNotPdf: "That file is not a PDF.",
  pdfEmpty: "That file is empty. Choose the study's PDF again.",
  pdfTooLarge: `That PDF is larger than ${MAX_PDF_MB} MB. Please type the abstract and keywords.`,
  driveNotDrive: "That does not look like a Google Drive link.",
  driveNoId: "Could not find a file id in that link. Make sure it is a shared file link.",
  drivePaste: "Please paste a Google Drive link.",
} as const;

/** Either the value to save, or the message to show. */
export type Checked = { value: string; error: null } | { value: string; error: string };
const ok = (value: string): Checked => ({ value, error: null });
const fail = (value: string, error: string): Checked => ({ value, error });

/** "  Soil   pH " → "Soil pH". Line breaks count as spaces. */
export const cleanSpaces = (s: string) => s.replace(/\s+/g, " ").trim();

const hasLetter = (s: string) => /\p{L}/u.test(s);
const letterCount = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

// ─── Names (Authors, Adviser) ────────────────────────────────────────────────

/** Letters (ñ and accents included), spaces, and . , ' ’ - — nothing else. */
const NAME_CHARS = /^[\p{L}\p{M} .,'’-]+$/u;

/** Words that make a name: not a surname particle ("dela") or a suffix ("Jr.").
 *  An initial ("J.") counts, so "J. Dela Cruz" is a full name. */
function nameWordCount(part: string): number {
  const words = part.split(" ").filter(Boolean);
  if (words.length > 1 && SUFFIX.test(words[words.length - 1])) words.pop();
  return words.filter(w => hasLetter(w) && !PARTICLES.has(w.toLowerCase())).length;
}

/** A first name and a surname: "Juan Dela Cruz", "J. Dela Cruz", or the
 *  comma form "Dela Cruz, Juan" (with an optional ", Jr."). "Dela Cruz" alone
 *  has only one name word, so it fails. */
function isFullAuthorName(name: string): boolean {
  if (!name.includes(",")) return nameWordCount(name) >= 2;
  const parts = name.split(",").map(p => p.trim());
  if (parts.some(p => !p)) return false;
  // "Jose Rizal, Jr." is a suffix after a comma, not the comma form.
  if (parts.length === 2 && SUFFIX.test(parts[1])) return nameWordCount(parts[0]) >= 2;
  if (parts.length === 2 || (parts.length === 3 && SUFFIX.test(parts[2]))) {
    return nameWordCount(parts[0]) >= 1 && nameWordCount(parts[1]) >= 1;
  }
  return false;
}

/**
 * A name typed all in lowercase or ALL IN CAPITALS gets a capital at the start
 * of each word and after - or ' ("o'brien" → "O'Brien"); II, III and IV stay in
 * capitals. A name in mixed case is kept as typed ("Juan dela Cruz" stays).
 */
export function fixCapitals(name: string): string {
  if (name !== name.toLowerCase() && name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'’.])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
    .replace(/(^|\s)(ii|iii|iv)(?=$|[\s,])/gi, (_, before: string, roman: string) => before + roman.toUpperCase());
}

/** One author, as typed in the Authors box. "" back with no error = nothing typed. */
export function checkAuthor(typed: string): Checked {
  const name = cleanSpaces(typed);
  if (!name) return ok("");
  if (name.length > MAX_NAME) return fail(name, MSG.nameLong(MAX_NAME));
  if (!NAME_CHARS.test(name) || !hasLetter(name)) return fail(name, MSG.nameChars);
  if (!isFullAuthorName(name)) return fail(name, MSG.authorFull);
  return ok(fixCapitals(name));
}

/** The result of pressing + Add (or Enter) in a chip input. `note` is grey,
 *  not an error: a repeat that was skipped. */
export interface Added {
  list: string[];
  error?: string;
  note?: string;
}

const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Adds the typed author to the list, after the checks. Repeats are skipped
 *  ignoring case, so "juan dela cruz" does not add a second Juan Dela Cruz. */
export function addAuthor(list: string[], typed: string): Added {
  const { value, error } = checkAuthor(typed);
  if (error) return { list, error };
  if (!value) return { list };
  if (list.some(a => sameText(a, value))) return { list, note: MSG.alreadyListed([value]) };
  if (list.length >= MAX_AUTHORS) return { list, error: MSG.authorsMax };
  return { list: [...list, value] };
}

/**
 * A saved study's authors, loaded into the Edit form: each cleaned as if typed
 * (spaces, capitals), repeats dropped. A name that would not pass checkAuthor
 * (saved before the checks existed) is kept as stored — dropping it would lose
 * an author — and the first one's message is returned, so saving asks for a fix.
 */
export function cleanAuthorList(names: string[]): Added {
  const list: string[] = [];
  let error: string | undefined;
  for (const raw of names) {
    const { value, error: problem } = checkAuthor(raw);
    if (!value || list.some(a => sameText(a, value))) continue;
    if (problem && !error) error = MSG.authorStored(value, problem);
    list.push(value);
  }
  return { list, error };
}

/** Titles the adviser's name may start with; the period is optional.
 *  Two-word titles and "Mrs" come first so "Mr" does not take their place. */
const ADVISER_TITLE = /^(?:asst\.? prof|assoc\.? prof|prof|dr|engr|mrs|mr|ms|atty)\.?(?= )/i;
/** The degrees that may follow the adviser's name after a comma, as saved. */
export const DEGREES = ["PhD", "EdD", "MSc", "MS", "MA", "MIT", "MBA", "RN", "PE", "CE"] as const;

/** "Ph.D." / "phd" → "PhD"; null when not one of DEGREES. */
function degreeOf(typed: string): string | null {
  const key = typed.replace(/\./g, "").toLowerCase();
  return DEGREES.find(d => d.toLowerCase() === key) ?? null;
}

/**
 * The adviser: required, a first name and a surname, optionally after a title
 * (Dr., Engr., Prof., Asst. Prof., Assoc. Prof., Mr., Mrs., Ms., Atty.) and
 * before degrees ("Maria Santos, PhD"). The "Surname, Given" comma form is
 * for authors only: here a comma can only be followed by a degree.
 */
export function checkAdviser(typed: string): Checked {
  const name = cleanSpaces(typed);
  if (!name) return fail("", MSG.adviserRequired);
  if (name.length > MAX_ADVISER) return fail(name, MSG.nameLong(MAX_ADVISER));
  if (!NAME_CHARS.test(name) || !hasLetter(name)) return fail(name, MSG.nameChars);
  const [main, ...after] = name.split(",").map(p => p.trim());
  const degrees = after.map(degreeOf);
  if (degrees.some(d => !d)) return fail(name, MSG.adviserDegree);
  if (nameWordCount(main.replace(ADVISER_TITLE, "")) < 2) return fail(name, MSG.adviserFull);
  return ok([fixCapitals(main), ...degrees].join(", "));
}

// ─── Title ───────────────────────────────────────────────────────────────────

export function checkTitle(typed: string): Checked {
  const title = cleanSpaces(typed);
  if (!title) return fail("", MSG.titleRequired);
  if (letterCount(title) < 3) return fail(title, MSG.titleNoWords);
  if (title.length < TITLE_MIN) return fail(title, MSG.titleShort);
  if (title.length > TITLE_MAX) return fail(title, MSG.titleLong);
  return ok(title);
}

// ─── Academic Year ───────────────────────────────────────────────────────────

/** What the Academic Year box keeps of what was typed or pasted: digits only,
 *  at most 4 ("Year 2019" → "2019"). Done in code, not with maxLength, which
 *  would cut a paste of "Year 2019" to "Year" before the digits are kept. */
export const yearInput = (typed: string) => typed.replace(/\D/g, "").slice(0, 4);

/** Exactly 4 digits, not after this year; any past year is allowed. */
export function checkYear(typed: string, thisYear = new Date().getFullYear()): Checked {
  const year = typed.trim();
  if (!/^\d{4}$/.test(year)) return fail(year, MSG.yearFormat);
  if (Number(year) > thisYear) return fail(year, MSG.yearFuture(thisYear));
  return ok(year);
}

// ─── Abstract ────────────────────────────────────────────────────────────────

/** Trimmed, repeated spaces collapsed, at most one blank line between paragraphs. */
export function cleanAbstract(typed: string): string {
  return typed
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Words across spaces and line breaks; only words with a letter count, so a
 *  run of numbers is not an abstract. */
export const countWords = (s: string) => s.split(/\s+/).filter(hasLetter).length;

export function checkAbstract(typed: string): Checked {
  const abstract = cleanAbstract(typed);
  if (!abstract) return fail("", MSG.abstractRequired);
  const words = countWords(abstract);
  if (words < ABSTRACT_MIN_WORDS) return fail(abstract, MSG.abstractShort(words));
  if (abstract.length > ABSTRACT_MAX) return fail(abstract, MSG.abstractLong);
  return ok(abstract);
}

// ─── Keywords ────────────────────────────────────────────────────────────────

/** Spaces collapsed, trailing . ; : dropped — as the PDF reader already does. */
export const cleanKeyword = (s: string) => cleanSpaces(s).replace(/[.;:]+$/, "").trim();

/** The message for one cleaned keyword, or null when it is fine. */
export function keywordProblem(keyword: string): string | null {
  if (!hasLetter(keyword)) return MSG.keywordNoWords;
  if (keyword.length < KEYWORD_MIN || keyword.length > KEYWORD_MAX) return MSG.keywordLength;
  return null;
}

/**
 * Adds what was typed in the Keywords box. "rice, soil; maize" adds three.
 * Any one that fails stops the whole add, so nothing is half-added. Repeats
 * (ignoring case) are skipped with a note.
 */
export function addKeywords(list: string[], typed: string): Added {
  const pieces = typed.split(/[,;]/).map(cleanKeyword).filter(Boolean);
  for (const k of pieces) {
    const problem = keywordProblem(k);
    if (problem) return { list, error: problem };
  }
  const added: string[] = [];
  const repeats: string[] = [];
  for (const k of pieces) {
    if ([...list, ...added].some(x => sameText(x, k))) repeats.push(k);
    else added.push(k);
  }
  if (list.length + added.length > MAX_KEYWORDS) return { list, error: MSG.keywordsMax };
  return { list: [...list, ...added], note: repeats.length ? MSG.alreadyListed(repeats) : undefined };
}

/** Keywords read from the PDF: the same cleaning, with repeats and invalid
 *  ones dropped quietly, at most MAX_KEYWORDS. */
export function cleanKeywordList(keywords: string[]): string[] {
  const out: string[] = [];
  for (const raw of keywords) {
    const k = cleanKeyword(raw);
    if (k && !keywordProblem(k) && !out.some(x => sameText(x, k))) out.push(k);
  }
  return out.slice(0, MAX_KEYWORDS);
}

// ─── Study PDF and Drive link ────────────────────────────────────────────────

/** What is wrong with a chosen PDF, or null. `keep`: the file may still be
 *  chosen (too large: it goes to manual entry, as before). */
export function pdfFileProblem(file: { name: string; type: string; size: number }): { message: string; keep: boolean } | null {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return { message: MSG.pdfNotPdf, keep: false };
  if (file.size === 0) return { message: MSG.pdfEmpty, keep: false };
  if (file.size > MAX_PDF_MB * 1024 * 1024) return { message: MSG.pdfTooLarge, keep: true };
  return null;
}

/** Accepts /file/d/{id}/view · /file/d/{id} · ?id={id} · /open?id={id} */
export function driveFileId(link: string): string | null {
  const m = link.match(/(?:file\/d\/|[?&]id=)([-\w]{25,})/);
  return m ? m[1] : null;
}

/** Reject bad links before spending a PDF download on them. */
export function validateDriveLink(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return MSG.drivePaste;
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(trimmed)) return MSG.driveNotDrive;
  if (!driveFileId(trimmed)) return MSG.driveNoId;
  return null;
}

// ─── Search boxes ────────────────────────────────────────────────────────────

/** Never an error: trimmed, spaces collapsed, cut to SEARCH_MAX, and "" when
 *  there is no letter or digit ("!!!" counts as an empty box). */
export function cleanQuery(typed: string): string {
  const q = cleanSpaces(typed).slice(0, SEARCH_MAX).trim();
  return /[\p{L}\p{N}]/u.test(q) ? q : "";
}
