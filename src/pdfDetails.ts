// The study details read from a PDF for the Register / Edit form (errata
// #82): title, authors, department, year completed and adviser. Pure — no
// pdf.js, no Firebase, no React — so `node src/pdfDetails.check.ts` can test
// it. The page texts come from pdfText.ts readPages (one string per page, line
// breaks kept).
//
// The rule everywhere: never guess. A value is filled only when the PDF prints
// it in a known place and layout; anything unclear stays empty for staff to
// type. Where each value comes from, best first:
//   1. The labelled block some abstract pages print above the abstract
//      ("Title : …", "Program : …", "Authors : …", "Academic Year : …",
//      "Adviser : …"), as ISU theses do.
//   2. The title page: ISU layout (title in capitals, "By:", the names, then
//      e.g. "December 2024") or UP Open University layout (university,
//      programme, author, title, "Thesis Adviser:", adviser, faculty, date).
//   3. The approval sheet (adviser above "Thesis Adviser"; the title in
//      quotes after "entitled"; the names after "submitted by").
import { DEPARTMENTS } from "./types.ts";
import { PARTICLES } from "./citation.ts";
import {
  MAX_ADVISER, MAX_ADVISERS, MAX_AUTHORS, adviserNames, checkAdviser, checkAuthor, checkTitle, cleanSpaces, degreeOf, fixCapitals,
} from "./validation.ts";
import { readPages, type ReadProgress } from "./pdfText.ts";

/** The form fields the PDF can fill. */
export const DETAIL_FIELDS = ["title", "authors", "department", "year", "adviser"] as const;
export type DetailField = typeof DETAIL_FIELDS[number];
export type DetailSource = "block" | "title page" | "approval sheet";

/** The five details as the form holds them; "" / [] = not given. */
export interface Details {
  title: string;
  authors: string[];
  department: string;
  year: string;
  adviser: string;
}

export interface StudyDetails extends Details {
  /** Where each filled value was read. */
  source: Partial<Record<DetailField, DetailSource>>;
  /** Grey notes for staff, one per field at most (never errors). */
  notes: Partial<Record<DetailField, string>>;
}

export const NOTE = {
  academicYearOnly: (ay: string) =>
    `The PDF gives only the academic year (${ay}), not the year the study was completed. Type the year completed.`,
  twoAdvisers: (names: string[]) => `The PDF lists ${names.length} advisers: ${names.join("; ")}. Type the one to record.`,
  titleInCapitals: "The title is printed in capital letters and is kept as printed. Retype it in normal letters if you wish.",
  differs: (label: string, value: string) => `The PDF shows a different ${label}: “${value}”. Yours is kept.`,
} as const;

const FIELD_LABEL: Record<DetailField, string> = {
  title: "title", authors: "author list", department: "department", year: "year completed", adviser: "adviser",
};

// ─── Lines and small helpers ─────────────────────────────────────────────────

/** The page's lines, spaces collapsed, empty lines dropped. */
const linesOf = (page: string) =>
  page.split("\n").map(l => l.replace(/[ \t ]+/g, " ").trim()).filter(Boolean);
/** Letters and digits only, lower case: "XenConservation : A" ≡ "XENCONSERVATION: A". */
export const lettersOf = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const isAllCaps = (s: string) => s === s.toUpperCase() && /\p{L}/u.test(s);
/** Printed in capitals, perhaps with one word that is not ("… (LoG) …",
 *  "… FOR MSMEs"): at least 85% of the letters are capitals. */
const inCapitals = (s: string) => {
  const letters = s.match(/\p{L}/gu) ?? [];
  return letters.length > 0 && letters.filter(l => l !== l.toLowerCase()).length / letters.length >= 0.85;
};

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
/** A date line on its own: "December 2024", "22 September 2025", "August 15,
 *  2024", "15/08/2025". The year is group 1 or 2. */
const DATE_LINE = new RegExp(String.raw`^(?:\d{1,2}\s+)?${MONTH}\.?\s+(?:\d{1,2},?\s+)?(\d{4})$|^\d{1,2}/\d{1,2}/(\d{4})$`, "i");
const yearOfDateLine = (line: string) => {
  const m = DATE_LINE.exec(line);
  return m ? (m[1] ?? m[2]) : null;
};

/** Degrees and licences printed after a STUDENT's name: dropped, as APA lists
 *  authors without them ("SHERWIN C. GARCES, RN" → "Sherwin C. Garces"). */
const AUTHOR_CREDENTIALS = new Set([
  "rn", "bsn", "cen", "man", "maed", "mat", "ma", "ms", "msc", "phd", "edd", "md", "lpt", "cpa", "mit", "msit", "mscs",
  "dit", "mba", "mpa", "dpa", "mn",
]);

/** An author name as printed → as the Authors box saves it, or null when it
 *  is not clearly a name. Degrees after the name dropped, "DINO - REYES" →
 *  "Dino-Reyes", then the Authors box's own checks and capitals. */
function authorName(printed: string): string | null {
  let n = cleanSpaces(printed).replace(/(\p{L}) - (\p{L})/gu, "$1-$2");
  for (;;) {
    const m = /[\s,]+([\p{L}.]+)$/u.exec(n);
    if (!m || !AUTHOR_CREDENTIALS.has(m[1].replace(/\./g, "").toLowerCase())) break;
    n = n.slice(0, m.index);
  }
  n = n.replace(/,\s*$/, "").trim();
  if (n.split(" ").length > 6) return null;
  const c = checkAuthor(n);
  return c.error || !c.value ? null : c.value;
}

/** Every name or nothing: one name that is not clearly a name means the list
 *  is not clear, and a list with a name missing would be wrong. */
function authorList(printed: string[]): string[] | null {
  const out: string[] = [];
  for (const p of printed) {
    const name = authorName(p);
    if (!name) return null;
    if (!out.some(a => a.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out.length > 0 && out.length <= MAX_AUTHORS ? out : null;
}

/** Titles before an adviser's name: kept as printed (never added, never changed). */
const ADVISER_TITLE_WORD = /^(?:dr|dra|engr|prof|professor|asst|assistant|assoc|associate|mr|mrs|ms|atty|sir)\.?$/i;

/** The adviser as printed, cleaned as the Adviser box cleans it. A name part
 *  in capitals after a title in normal letters gets normal capitals
 *  ("Dr. JEAN A. SALUDADEZ" → "Dr. Jean A. Saludadez"); "Dr." itself is
 *  never added or changed. A name in capitals gets normal capitals even when
 *  a check fails; otherwise a value that does not pass checkAdviser is kept
 *  as printed ("LIZA REYES, DVM" → "Liza Reyes, DVM"), so the form shows the
 *  normal message. */
export function adviserAsPrinted(printed: string): string {
  // Two or three advisers (errata #86): each name cleaned on its own, joined
  // by " and " as the Adviser box saves them.
  const names = adviserNames(printed);
  if (names.length > 1) {
    const prepared = names.map(oneAdviserAsPrinted).join(" and ");
    const c = checkAdviser(prepared);
    return c.error ? prepared : c.value;
  }
  return oneAdviserAsPrinted(printed);
}

function oneAdviserAsPrinted(printed: string): string {
  const raw = cleanSpaces(printed);
  const [main0, ...rest] = raw.split(",");
  const words = main0.trim().split(" ");
  // A degree glued to the name before the comma degrees ("LUNA RN, MAN",
  // errata #86) goes after the name: "Luna, RN, MAN", not "Luna Rn, MAN".
  // Only when degrees already follow the comma, and only while at least 2
  // name words stay after the title words: a surname that is also degree
  // letters ("DR. JOSE MA, PHD", "Engr. Mark Pe, MS") is never moved.
  if (rest.length > 0 && rest.every(r => degreeOf(r.trim()))) {
    let titles = 0;
    while (titles < words.length && ADVISER_TITLE_WORD.test(words[titles])) titles++;
    const glued: string[] = [];
    while (words.length - titles > 2 && degreeOf(words[words.length - 1])) glued.unshift(words.pop()!);
    if (glued.length > 0) rest.unshift(...glued);
  }
  const main = words.join(" ");
  let t = 0;
  while (t < words.length && ADVISER_TITLE_WORD.test(words[t])) t++;
  const name = words.slice(t).join(" ");
  const fixedMain = isAllCaps(main)
    ? fixCapitals(main.trim())                       // as the Adviser box does, also when a check fails
    : t > 0 && isAllCaps(name)
      ? [...words.slice(0, t), fixCapitals(name)].join(" ")
      : main.trim();
  const prepared = [fixedMain, ...rest.map(r => r.trim())].join(", ");
  const c = checkAdviser(prepared);
  return c.error ? prepared : c.value;
}

/** The one department a programme line names, or "" (none, or more than one). */
export function departmentOf(program: string): string {
  const hits = DEPARTMENTS.filter(d => new RegExp(String.raw`(?:^|[^\p{L}])${d.replace(/ /g, String.raw`\s+`)}(?:$|[^\p{L}])`, "iu").test(program));
  return hits.length === 1 ? hits[0] : "";
}

// ─── 1. The labelled block on the abstract page ──────────────────────────────

const LABEL = /^(title|program(?:me)?|degree|course|authors?|researchers?|proponents?|academic\s+year|school\s+year|(?:co-?\s?)?advis[eo]r(?:s|\(s\))?)\s*:\s*(.*)$/i;
/** People who are never the adviser (errata #86): a line starting with one
 *  ends the block, so "Panel Chair: Dr. X, PhD" or "Critic: …" under the
 *  advisers is never read as one. */
const NOT_ADVISER = /^(?:thesis\s*\/?\s*|dissertation\s+)*(?:critics?|panel(?:ists?)?|chair(?:man|person)?|dean|members?|examiners?|readers?)\b/i;
type Label = "title" | "program" | "authors" | "ay" | "adviser";
const labelOf = (word: string): Label => {
  const w = word.toLowerCase();
  if (w === "title") return "title";
  if (/^(program|programme|degree|course)$/.test(w)) return "program";
  if (/^(author|researcher|proponent)s?$/.test(w)) return "authors";
  if (/year/.test(w)) return "ay";
  return "adviser";
};

interface Block {
  title?: string; program?: string; authors?: string[]; ay?: string; adviser?: string;
  /** More than MAX_ADVISERS names under "Adviser(s):" (errata #86): not
   *  filled, listed in the note — never a guess at which ones to keep. */
  advisers?: string[];
  /** The last line of the block, as printed. */
  end: string;
}
/** Lines read below an adviser label at most: enough to see a 4th name. */
const MAX_ADVISER_LINES = 6;

/** A line that can carry on an author list: short, and a name (it may end in
 *  "Jr." or an initial, so a full stop is allowed). */
const nameLine = (line: string) => line.length < 60 && authorName(line) !== null;

/** A line under "Adviser(s):" that is one more adviser (errata #86): starts
 *  with a title ("Dr.", "Asst. Prof.", "Engr.") or has ", <degree>", every
 *  word starts with a capital (or is a particle, "and", or a short "dP."),
 *  and it passes the Adviser box. The abstract's first sentence fails. */
function adviserLine(line: string): boolean {
  if (line.length > MAX_ADVISER || NOT_ADVISER.test(line)) return false;
  const words = line.split(" ");
  const titled = ADVISER_TITLE_WORD.test(words[0]);
  const degreed = line.split(",").slice(1).some(p => degreeOf(p.trim()));
  if (!titled && !degreed) return false;
  const nameLike = words.every(w => {
    const bare = w.replace(/[,;]+$/, "");
    return /^\p{Lu}/u.test(bare) || PARTICLES.has(bare.toLowerCase()) || /^and$/i.test(bare) || /^\p{L}{1,2}\.$/u.test(bare);
  });
  return nameLike && !checkAdviser(adviserAsPrinted(line)).error;
}

/** "ABSTRACT" on its own line, then a label line. A title wraps onto lines
 *  without a label (taken only when another label follows within 2 lines); an
 *  author list goes on one name per line (taken only when a label follows the
 *  names, so the abstract's first line is never read as a name). Anything
 *  else ends the block. */
function readBlock(pages: string[]): Block | null {
  for (const page of pages) {
    const ls = linesOf(page);
    const h = ls.findIndex((l, i) => /^ABSTRACT$/i.test(l) && LABEL.test(ls[i + 1] ?? ""));
    if (h < 0) continue;
    const got: Partial<Record<Label, string[]>> = {};
    let cur: Label | null = null;
    let unclearAuthors = false;
    let end = "";
    for (let i = h + 1; i < ls.length; i++) {
      if (cur === "adviser" && NOT_ADVISER.test(ls[i])) break;
      const m = LABEL.exec(ls[i]);
      if (m) {
        cur = labelOf(m[1]);
        // "Co-Adviser:" adds to "Adviser:" (errata #86); other labels start anew.
        if (cur === "adviser" && got.adviser) { if (m[2]) got.adviser.push(m[2]); }
        else got[cur] = m[2] ? [m[2]] : [];
        end = ls[i];
        continue;
      }
      if (cur === "title" && (got.title?.length ?? 0) < 3 && ls.slice(i + 1, i + 3).some(l => LABEL.test(l))) {
        got.title!.push(ls[i]);
        end = ls[i];
        continue;
      }
      // The advisers on the lines just below "Adviser(s):". All of them are
      // read, so a 4th is seen (then the note, below), not silently dropped.
      if (cur === "adviser" && got.adviser!.length < MAX_ADVISER_LINES && adviserLine(ls[i])) {
        got.adviser!.push(ls[i]);
        end = ls[i];
        continue;
      }
      if (cur === "authors") {
        // The short lines up to the next label. All names → part of the list;
        // any other line → the list is not clear, so none of it is used.
        let j = i;
        while (j < ls.length && j < i + MAX_AUTHORS && !LABEL.test(ls[j]) && ls[j].length < 60) j++;
        if (j > i && LABEL.test(ls[j] ?? "")) {
          const run = ls.slice(i, j);
          if (run.every(nameLine)) got.authors!.push(...run);
          else unclearAuthors = true;
          end = ls[j - 1];
          i = j - 1;
          continue;
        }
      }
      break;
    }
    const block: Block = { end };
    if (got.title?.length) block.title = cleanSpaces(got.title.join(" "));
    if (got.program?.length) block.program = cleanSpaces(got.program.join(" "));
    if (got.ay?.length) block.ay = cleanSpaces(got.ay.join(" "));
    if (got.authors?.length && !unclearAuthors) {
      const list = authorList(got.authors.flatMap(l => l.split(/\s*;\s*|\s+and\s+|\s*&\s*/i)).filter(Boolean));
      if (list) block.authors = list;
    }
    if (got.adviser?.length) {
      const names = got.adviser.flatMap(adviserNames);
      if (names.length > MAX_ADVISERS) block.advisers = names;
      else block.adviser = got.adviser.join(" and ");
    }
    return block;
  }
  return null;
}

// ─── 2. The title page ───────────────────────────────────────────────────────

interface TitlePage {
  title?: string;
  /** The same title in normal letters, when the page prints one (a running
   *  header) whose letters are identical. */
  titleMixed?: string;
  program?: string;
  authors?: string[];
  adviser?: string;
  advisers?: string[];
  year?: string;
}

/** Page furniture at the top of a page: "i", "1", "Page i". */
const PAGE_NUMBER_LINE = /^(?:page\s+)?(?:[ivxlc]+|\d{1,4})$/i;
const UP_HEAD = /^UNIVERSITY OF THE PHILIPPINES(?: OPEN UNIVERSITY)?$/i;
const PROGRAM_LINE = /^(?:bachelor|master|doctor)\b/i;
const ADVISER_LABEL = /\badvis[eo]rs?\s*:$/i;
const AFTER_ADVISER = /^(?:faculty|college|department|school|institute|division) of\b|^thesis\/dissertation critic|^date of submission/i;

/** UP Open University layout: university, (OPEN UNIVERSITY), programme,
 *  author, title (1–5 lines), "… Adviser(s):", adviser(s), faculty, date.
 *  A running header above the university line may give the title in normal
 *  letters. */
function readUpTitlePage(ls: string[]): TitlePage | null {
  const u = ls.findIndex(l => UP_HEAD.test(l));
  if (u < 0) return null;
  let i = u + 1;
  if (/^OPEN UNIVERSITY$/i.test(ls[i] ?? "")) i++;
  if (!PROGRAM_LINE.test(ls[i] ?? "")) return {};
  const out: TitlePage = { program: ls[i++] };
  const authorLine = ls[i++] ?? "";
  const a = ls.findIndex((l, k) => k >= i && ADVISER_LABEL.test(l));
  if (a < 0) return out;
  const author = authorList([authorLine]);
  const titleLines = ls.slice(i, a);
  if (author && titleLines.length >= 1 && titleLines.length <= 5) {
    out.authors = author;
    out.title = cleanSpaces(titleLines.join(" "));
    const head = ls.slice(0, u).filter(l => !PAGE_NUMBER_LINE.test(l)).join(" ")
      .replace(/\s+(?:[ivxlc]+|\d{1,4})$/i, "").replace(/\s*(?:…|\.{3})$/, "").trim();
    if (head && lettersOf(head) === lettersOf(out.title)) out.titleMixed = cleanSpaces(head);
  }
  let end = ls.findIndex((l, k) => k > a && AFTER_ADVISER.test(l));
  if (end < 0) end = Math.min(ls.length, a + 2);
  const advisers = ls.slice(a + 1, end).filter(l => !yearOfDateLine(l));
  if (advisers.length === 1) out.adviser = advisers[0];
  else if (advisers.length > 1 && advisers.length <= 4) out.advisers = advisers;
  // The date comes after the faculty line, sometimes after a "Critic:" block
  // and "Date of Submission": the first date line within 12 lines.
  for (let k = a + 1; k < Math.min(ls.length, a + 13); k++) {
    const y = yearOfDateLine(ls[k]);
    if (y) { out.year = y; break; }
  }
  return out;
}

/** ISU layout: the title at the top, "A Thesis …", the programme, "By:", one
 *  name per line, then a date line ("December 2024"). */
function readIsuTitlePage(ls: string[]): TitlePage | null {
  const by = ls.findIndex(l => /^by:?$/i.test(l));
  if (by < 1) return null;
  const out: TitlePage = {};
  const kind = ls.findIndex(l => /^an?\s+(?:thesis|capstone|research|special\s+project|feasibility|undergraduate|project\s+study)\b/i.test(l));
  const top = ls.slice(0, kind > 0 ? kind : 0).filter(l => !PAGE_NUMBER_LINE.test(l));
  if (top.length >= 1 && top.length <= 5) out.title = cleanSpaces(top.join(" "));
  const program = ls.slice(0, by).find(l => /^(?:bachelor|master|doctor)\s+of\b/i.test(l));
  if (program) out.program = program;
  const names: string[] = [];
  for (let k = by + 1; k < ls.length; k++) {
    const y = yearOfDateLine(ls[k]);
    if (y) { out.year = y; break; }
    names.push(ls[k]);
    if (names.length > MAX_AUTHORS) break;
  }
  if (out.year) {
    const list = authorList(names);
    if (list) out.authors = list;
  }
  return out;
}

/** The first of pages 1–3 laid out as a known title page (pages 2–3 when
 *  page 1 is only a cover). */
function readTitlePage(pages: string[]): TitlePage | null {
  for (const page of pages.slice(0, 3)) {
    const ls = linesOf(page);
    const found = readUpTitlePage(ls) ?? readIsuTitlePage(ls);
    if (found && (found.title || found.authors || found.adviser || found.year)) return found;
  }
  return null;
}

// ─── 3. The approval sheet ───────────────────────────────────────────────────

interface Approval { title?: string; authors?: string[]; adviser?: string }

/** "APPROVAL SHEET" on pages 1–4: the adviser is the line above "Thesis
 *  Adviser"; the title is in quotes after "entitled"; the authors follow
 *  "submitted by" up to "in partial". */
function readApproval(pages: string[]): Approval | null {
  for (const page of pages.slice(0, 4)) {
    const ls = linesOf(page);
    if (!ls.some(l => /^APPROVAL SHEET$/i.test(l))) continue;
    const out: Approval = {};
    const k = ls.findIndex(l => /^(?:thesis\s+|research\s+|capstone\s+|project\s+)?advis[eo]r$/i.test(l));
    if (k > 0) out.adviser = ls[k - 1];
    const flat = ls.join(" ");
    const t = /\bentitled\s*[“"]([^”"]{10,400})[”"]/i.exec(flat);
    if (t) out.title = cleanSpaces(t[1]);
    const s = /\bsubmitted\s+by\s+(.{3,400}?)\s+in\s+partial\b/i.exec(flat);
    if (s) {
      const list = authorList(s[1].split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).filter(Boolean));
      if (list) out.authors = list;
    }
    return out;
  }
  return null;
}

// ─── All together ────────────────────────────────────────────────────────────

/** The details the PDF clearly gives (see the top of this file). */
export function readDetails(pages: string[]): StudyDetails {
  const block = readBlock(pages);
  const tp = readTitlePage(pages);
  const ap = readApproval(pages);
  const out: StudyDetails = { title: "", authors: [], department: "", year: "", adviser: "", source: {}, notes: {} };

  const titleFrom: [string | undefined, DetailSource][] = [[block?.title, "block"], [tp?.titleMixed ?? tp?.title, "title page"], [ap?.title, "approval sheet"]];
  for (const [t, src] of titleFrom) {
    if (t && !checkTitle(t).error) {
      out.title = checkTitle(t).value;
      out.source.title = src;
      if (inCapitals(out.title)) out.notes.title = NOTE.titleInCapitals;
      break;
    }
  }

  const authorsFrom: [string[] | undefined, DetailSource][] = [[block?.authors, "block"], [tp?.authors, "title page"], [ap?.authors, "approval sheet"]];
  for (const [a, src] of authorsFrom) {
    if (a?.length) { out.authors = a; out.source.authors = src; break; }
  }

  const program = block?.program ?? tp?.program;
  const dept = program ? departmentOf(program) : "";
  if (dept) { out.department = dept; out.source.department = block?.program ? "block" : "title page"; }

  if (tp?.year) { out.year = tp.year; out.source.year = "title page"; }
  else if (block?.ay) out.notes.year = NOTE.academicYearOnly(block.ay);

  // Two or three adviser lines on the title page (errata #86): all of them,
  // joined by " and ", when each line is clearly one adviser. Otherwise (four
  // lines, or a line that is not a name, such as a degree on its own line)
  // the note, as before: never guess.
  // Four or more in the labelled block: empty with the note, like the title
  // page (the title page and approval sheet are not used instead).
  let advisersListed = block?.advisers ?? (block?.adviser ? undefined : tp?.advisers);
  let tpAdviser = tp?.adviser;
  if (!block?.advisers && advisersListed && advisersListed.length <= MAX_ADVISERS
    && advisersListed.every(l => adviserNames(l).length === 1 && !checkAdviser(adviserAsPrinted(l)).error)) {
    tpAdviser = advisersListed.join(" and ");
    advisersListed = undefined;
  }
  const adviserFrom: [string | undefined, DetailSource][] = [[block?.adviser, "block"], [tpAdviser, "title page"], [ap?.adviser, "approval sheet"]];
  if (advisersListed) {
    out.notes.adviser = NOTE.twoAdvisers(advisersListed.map(adviserAsPrinted));
  } else {
    for (const [a, src] of adviserFrom) {
      if (a) { out.adviser = adviserAsPrinted(a); out.source.adviser = src; break; }
    }
  }
  return out;
}

/** The abstract without a copy of the title at its start (TARUC 2024 prints
 *  the title under "Abstract"). Only when the abstract's first letters are
 *  exactly the title's (case, spaces and punctuation aside) and what follows
 *  starts with a capital letter or a digit; otherwise nothing is removed. */
export function abstractWithoutTitle(abstract: string, title: string): string {
  const want = lettersOf(title);
  if (want.length < 10 || !lettersOf(abstract).startsWith(want)) return abstract;
  let seen = 0;
  let i = 0;
  while (i < abstract.length && seen < want.length) {
    if (/[\p{L}\p{N}]/u.test(abstract[i])) seen++;
    i++;
  }
  // Only when what follows clearly starts something new: after spaces and
  // : . – —, a capital letter or a digit. "Agricultural extension services in
  // Isabela …" under the title "Agricultural Extension Services" is the
  // abstract's own first sentence, not a copy of the title: kept whole.
  const rest = abstract.slice(i).replace(/^[\s:.–—]+/, "");
  return /^[\p{Lu}\p{N}]/u.test(rest) ? rest : abstract;
}

/** The abstract without what is left of the labelled block at its start
 *  (pdfText.ts drops most blocks already, but stops at a line ending in a
 *  full stop, such as "Pedro L. Magbanua Jr."): everything up to the
 *  block's last line, when that line is in the abstract's first 1,000
 *  characters and text is left. */
export function abstractWithoutBlock(abstract: string, blockEnd: string): string {
  const end = blockEnd.replace(/\s+/g, " ").trim();
  if (!end) return abstract;
  const at = abstract.indexOf(end);
  if (at < 0 || at > 1000) return abstract;
  const rest = abstract.slice(at + end.length).trim();
  return rest ? rest : abstract;
}

export interface StudyRead {
  abstract: string;
  keywords: string[];
  details: StudyDetails;
  /** MSG_SCANNED / MSG_NOT_FOUND (pdfText.ts), or null. The details may
   *  still be there: a title page can be read when the abstract cannot. */
  problem: string | null;
  pagesRead: number;
}

/** Read a PDF's pages (pdfText.ts readPages) and everything the form fills. */
export async function readStudy(
  numPages: number,
  pageText: (n: number) => Promise<string>,
  onProgress?: (p: ReadProgress) => void,
): Promise<StudyRead> {
  const r = await readPages(numPages, pageText, n => onProgress?.({ kind: "page", page: n }));
  const details = readDetails(r.pages);
  return {
    abstract: abstractWithoutTitle(abstractWithoutBlock(r.abstract, readBlock(r.pages)?.end ?? ""), details.title),
    keywords: r.keywords, details, problem: r.problem, pagesRead: r.pagesRead,
  };
}

// ─── Filling the form ────────────────────────────────────────────────────────

const isEmpty = (d: Details, f: DetailField) => f === "authors" ? d.authors.length === 0 : !d[f].trim();
const sameValue = (d: Details, e: Details, f: DetailField) => f === "authors"
  ? d.authors.length === e.authors.length && d.authors.every((a, i) => a.toLowerCase() === e.authors[i].toLowerCase())
  : cleanSpaces(d[f]).toLowerCase() === cleanSpaces(e[f]).toLowerCase();

/**
 * What a PDF read puts in the form. A field is filled only when it is empty
 * or still holds an earlier PDF's value (`fromPdf`, tagged "from PDF"); what
 * staff typed or changed — and everything a saved study holds in Edit — is
 * never overwritten. A tagged field the new PDF does not give is emptied (that
 * value came from another PDF). Where the PDF shows something else than a
 * kept value, a grey note says so.
 */
export function fillFromPdf(current: Details, fromPdf: readonly DetailField[], found: StudyDetails): {
  details: Details;
  fromPdf: DetailField[];
  notes: Partial<Record<DetailField, string>>;
} {
  const details: Details = { ...current, authors: [...current.authors] };
  const tagged: DetailField[] = [];
  const notes: Partial<Record<DetailField, string>> = {};
  for (const f of DETAIL_FIELDS) {
    const replaceable = isEmpty(current, f) || fromPdf.includes(f);
    const given = !isEmpty(found, f);
    if (replaceable) {
      if (f === "authors") details.authors = given ? [...found.authors] : [];
      else details[f] = given ? found[f] : "";
      if (given) tagged.push(f);
      if (found.notes[f]) notes[f] = found.notes[f];
    } else if (given && !sameValue(current, found, f)) {
      notes[f] = NOTE.differs(FIELD_LABEL[f], f === "authors" ? found.authors.join("; ") : found[f]);
    }
  }
  return { details, fromPdf: tagged, notes };
}
