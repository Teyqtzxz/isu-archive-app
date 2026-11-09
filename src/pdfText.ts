// The text side of PDF auto-extraction (docs/06): which pages to read, when
// to stop, and how the abstract and keywords are found in the text. Pure — no
// pdf.js and no Firebase, so `node src/pdfText.check.ts` can test it.

/** Never read more pages than this. Theses put the abstract after the title
 *  page, approval sheet, certificate, acknowledgements, dedication, contents
 *  and lists of tables/figures: a UP Open University thesis (2026-11-08) had
 *  it on page 17, so the old fixed 15 was too few. Reading stops early once
 *  the abstract is found (see extractFromPages), so 40 is only a safety cap. */
export const MAX_PAGES = 40;

/** Fewer letters than this in the first SCAN_CHECK_PAGES pages → treat the PDF
 *  as scanned. The same 15-page window as before the cap went up to 40, so a
 *  scanned PDF that prints a page number on each page is still caught. */
export const MIN_TEXT_CHARS = 50;
export const SCAN_CHECK_PAGES = 15;

export const MSG_SCANNED =
  "This PDF has no readable text — it is probably scanned. Please type or paste the abstract.";
export const MSG_NOT_FOUND = "Could not find an abstract or keywords in that PDF. Please type or paste the abstract.";

/** "Label: value" lines that some abstract pages print above the abstract
 *  itself — common in Philippine theses ("Title: …", "Researcher: …"). */
const HEADER_LABEL =
  /^(?:thesis\s+)?(?:title|authors?|researchers?|proponents?|advis[eo]rs?|degree|course|program(?:me)?|department|college|school|institution|university|year|date|name)\s*:/i;

/** Drop the header block some abstract pages start with — label lines, or a
 *  short run of department / degree / title / "by Author" lines — and keep the
 *  abstract text. A line counts as text when it ends a sentence, or is a long
 *  line followed by another long one (a wrapped paragraph). A title on its own
 *  line is long but is followed by a short line, so it is still dropped. If too
 *  little would remain, the block was not a header after all: keep everything. */
function stripHeaderBlock(body: string): string {
  const lines = body.split("\n").map((l) => l.trim());
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line || HEADER_LABEL.test(line)) { i++; continue; }
    const next = lines.slice(i + 1).find((l) => l) ?? "";
    const isText = /[.!?]$/.test(line) || line.length >= 100 || (line.length >= 60 && next.length >= 50);
    if (isText) break;
    i++;
  }
  const rest = lines.slice(i).join("\n");
  return rest.replace(/\s+/g, "").length >= 150 ? rest : body;
}

/** Trailing page furniture after the last sentence: a page number ("v",
 *  "(iv)", "| 4", "- 5 -", "Page 8") and the running header of a blank back
 *  page ("vi Abstract"), possibly several of them in a row. */
const TRAILING_PAGE_MARKS =
  /([.!?)\]"\u201d])(?:\s+(?:[|\-\u2013\u2014]?\s*\(?(?:page\s+)?(?:[ivxlc]+|\d{1,4})\)?\s*[|\-\u2013\u2014]?|abstract))+\s*$/i;

/** The rest of an "ABSTRACT" heading line that marks a table-of-contents entry,
 *  not the abstract itself: dot leaders ("........ 3", ". . . v") or only a page
 *  number ("v", "12"). The number may have spaces inside, as some PDFs print
 *  "xi" as "x i" or "12" as "1 2" (DANDO 2022, errata #78). */
const CONTENTS_ENTRY = /^(?:[\s.]*\.{3}|(?:\.\s){3}|[ivxlc](?:\s*[ivxlc])*\s*$|\d(?:\s*\d)*\s*$)/i;

/** A page number at the end of a line: "Short Title of the Study   xiii",
 *  "… 14". Roman numbers in one case only, so a word like "Civil" is not one.
 *  A lower-case roman number may have spaces inside ("… Nurses x i v",
 *  errata #89), only as 2 or more single letters. Matched from the end (no
 *  backtracking over the line), as this runs on every line of up to 40 pages. */
const PAGE_NUMBER_AT_END = /\s+(?:[ivxlc]+|[IVXLC]+|\d{1,4}|[ivxlc](?: [ivxlc])+)$/u;

/** A whole line that is only a page number: "viii", "XII", "14", or a
 *  lower-case roman number with spaces inside ("x i v", 2 or more single
 *  letters). */
function isPageNumberLine(line: string): boolean {
  const t = line.trim();
  return t.length <= 8 && (/^(?:[ivxlc]+|[IVXLC]+|\d{1,4})$/.test(t) || /^[ivxlc](?: [ivxlc])+$/.test(t));
}

/** The words in front of a line's closing page number, or null. */
function headText(line: string): string | null {
  const t = line.trim();
  const m = PAGE_NUMBER_AT_END.exec(t);
  if (!m) return null;
  const words = t.slice(0, m.index);
  return /\p{L}/u.test(words) ? words : null;
}

/** Running headers and footers: the study's short title with a page number,
 *  repeated from page to page. A line only counts when the same words, with a
 *  page number, are on at least two lines of the text read. The count is made
 *  on first use only: most pages read have no abstract or keywords yet. */
function runningHeads(allLines: string[]): (line: string) => boolean {
  let seen: Map<string, number> | null = null;
  return (line) => {
    if (!seen) {
      seen = new Map();
      for (const l of allLines) {
        const words = headText(l);
        if (words !== null) seen.set(words, (seen.get(words) ?? 0) + 1);
      }
    }
    const words = headText(line);
    return words !== null && (seen.get(words) ?? 0) >= 2;
  };
}

/** How many times each whole line (trimmed, with letters) is in the text
 *  read. Counted on first use only, like runningHeads. */
function lineCounts(allLines: string[]): (line: string) => number {
  let seen: Map<string, number> | null = null;
  return (line) => {
    if (!seen) {
      seen = new Map();
      for (const l of allLines) {
        const t = l.trim();
        if (/\p{L}/u.test(t)) seen.set(t, (seen.get(t) ?? 0) + 1);
      }
    }
    return seen.get(line.trim()) ?? 0;
  };
}

/** The number of lines in the running head that starts at line i, or 0.
 *  Either one line of title words + page number (runningHeads), or the title
 *  on 1–3 lines of its own, each seen on at least 2 lines of the text, then
 *  the page number as a whole line, or split over 2 short lines ("xi" / "v",
 *  as a UP Open University thesis prints "xiv", errata #89). */
function headBlockLength(
  lines: string[], i: number, isRunningHead: (line: string) => boolean, timesSeen: (line: string) => number,
): number {
  if (isRunningHead(lines[i].trim())) return 1;
  let j = i;
  while (j < lines.length && j - i < 3) {
    const t = lines[j].trim();
    if (!/\p{L}/u.test(t) || isPageNumberLine(t) || timesSeen(t) < 2) break;
    j++;
  }
  if (j === i || j >= lines.length) return 0;
  const a = lines[j].trim();
  const b = (lines[j + 1] ?? "").trim();
  // The split number first, or "xi" alone would be taken and "v" left behind.
  if (/^[ivxlc]{1,4}$/.test(a) && /^[ivxlc]{1,2}$/.test(b)) return j - i + 2;
  return isPageNumberLine(a) ? j - i + 1 : 0;
}

/** Drop running heads INSIDE the abstract, where it runs onto the next page
 *  (errata #89): "… by offering" / title / "xiv" / "flexible learning …".
 *  Only a block that starts a page or ends one (`pageStarts`: the index in
 *  `allLines` of each page's first line), and only with abstract text after
 *  it: a running head at the end is left to stripTrailingRunningHeads. The
 *  lines around it are later joined with one space. A title inside a sentence
 *  is never a whole line of its own, so it stays. */
function stripMiddleRunningHeads(
  body: string, firstLine: number, allLines: string[], pageStarts: ReadonlySet<number>,
  isRunningHead: (line: string) => boolean, timesSeen: (line: string) => number,
): string {
  const startsPage = (g: number) => {
    for (let x = g; ; x--) {
      if (pageStarts.has(x)) return true;
      if (x === 0 || allLines[x - 1].trim()) return false;
    }
  };
  const endsPage = (g: number) => {
    let x = g;
    while (x < allLines.length && !allLines[x].trim() && !pageStarts.has(x)) x++;
    return x >= allLines.length || pageStarts.has(x);
  };
  const lines = body.split("\n");
  const kept: string[] = [];
  for (let k = 0; k < lines.length; k++) {
    const n = lines[k].trim() ? headBlockLength(lines, k, isRunningHead, timesSeen) : 0;
    const textAfter = n > 0 && lines.slice(k + n).some((l) => l.trim());
    if (textAfter && (startsPage(firstLine + k) || endsPage(firstLine + k + n))) {
      k += n - 1;
      continue;
    }
    kept.push(lines[k]);
  }
  return kept.join("\n");
}

/** Drop the running header or footer printed under the abstract or at the top
 *  of the next page. What is left must end a sentence, or nothing is dropped,
 *  so a real last sentence is never cut. */
function stripTrailingRunningHeads(body: string, isRunningHead: (line: string) => boolean): string {
  const lines = body.split("\n");
  let end = lines.length;
  let dropped = false;
  while (end > 0) {
    const line = lines[end - 1].trim();
    if (!line) end--;
    else if (isRunningHead(line)) { end--; dropped = true; }
    else break;
  }
  if (!dropped) return body;
  const rest = lines.slice(0, end).join("\n");
  return /[.!?)\]"\u201d]\s*$/.test(rest) ? rest : body;
}

/** First parts of a compound written with a SPACED hyphen ("self - efficacy",
 *  "Chi - square"). A spaced hyphen is often a dash ("design - data",
 *  "prevention - This"), so only these are joined (errata #90). */
const SPACED_COMPOUND_FIRST = new Set([
  "self", "socio", "cross", "non", "co", "pre", "post", "re", "anti", "multi", "semi", "inter", "intra", "sub",
  "well", "long", "short", "high", "low", "half", "full", "part",
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "chi",
]);
/** Small words that never end a spaced compound ("self - the" is a dash). */
const NOT_SECOND_PART = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are", "was", "were",
  "it", "this", "that", "which", "as", "at", "by", "no", "not",
]);
/** A suspended hyphen keeps its space: "pre- and post-test", "telephone- or". */
const SUSPENDED_NEXT = new Set(["and", "or", "nor"]);

/** Hyphenated words in the abstract that kept a space (errata #90): the PDF
 *  breaks "climate-related" over two lines ("climate- related"), or spaces
 *  every hyphen ("self - efficacy"). Only the plain hyphen "-"; en and em
 *  dashes, "rho= -.144" (no letter before) and "2026-2030" (no space) stay.
 *  - "word- word" → "word-word", unless the next word is and / or / nor. The
 *    hyphen is dropped ("manage- ment" → "management") only when the joined
 *    word is elsewhere in `pagesText` and the hyphenated one is not.
 *  - "word - word" → "word-word" only for SPACED_COMPOUND_FIRST, and not
 *    before a NOT_SECOND_PART word.
 *  - "COVID- 19", "PRCA - 24" → "COVID-19": capitals (2+ letters) or "Covid"
 *    before a number.
 *  Split words ("s uch") are never joined. */
function joinHyphens(abstract: string, pagesText: string): string {
  let words: Set<string> | null = null;
  let hyphenated: Set<string> | null = null;
  return abstract.replace(/(\p{L}+)( ?)- (\p{L}+|\d+)/gu, (all: string, left: string, space: string, right: string) => {
    if (/^\d/.test(right)) {
      return /^\p{Lu}{2,}$/u.test(left) || /^covid$/i.test(left) ? `${left}-${right}` : all;
    }
    if (space) {
      return SPACED_COMPOUND_FIRST.has(left.toLowerCase()) && !NOT_SECOND_PART.has(right.toLowerCase())
        ? `${left}-${right}` : all;
    }
    if (SUSPENDED_NEXT.has(right.toLowerCase())) return all;
    if (!words || !hyphenated) {
      const lower = pagesText.toLowerCase();
      words = new Set(lower.match(/\p{L}+/gu) ?? []);
      hyphenated = new Set(lower.match(/\p{L}+-\p{L}+/gu) ?? []);
    }
    const joined = `${left}${right}`.toLowerCase();
    return words.has(joined) && !hyphenated.has(`${left}-${right}`.toLowerCase()) ? `${left}${right}` : `${left}-${right}`;
  });
}

/** The keyword text so far ends in a separator, so the list must go on. */
const KW_ENDS_OPEN = /(?:[,;&]|\band|\bor)\s*$/i;
/** A heading the keyword list never runs into. */
const KW_STOP_LINE =
  /^(?:(?:\d+|[IVX]+)\.?\s+)?(?:CHAPTER|INTRODUCTION|BACKGROUND|ABSTRA[CK]T?|TABLE\s+OF|LIST\s+OF|ACKNOWLEDG|DEDICATION)\b/i;

/** Lines that can carry on a keyword list: each part between commas or
 *  semicolons is a short phrase (6 words at most), never a sentence. */
function looksLikeKeywords(line: string): boolean {
  return line.split(/[,;]/).every((part) => part.trim().split(/\s+/).length <= 6);
}

/** Join the lines a keyword list wraps onto ("Theory of Reasoned" /
 *  "Action, climate neutrality"). The first next line is joined when the list
 *  ends in a separator (, ; & and or), when that line has commas or semicolons
 *  itself, or when it is a short ending such as "advancement." (4 words at
 *  most, full stop). After that, only while the list still ends in a
 *  separator, at most 3 lines in all. Never an empty line, a heading, a
 *  running header (see runningHeads) or a line with a sentence-long part.
 *  `end` is the index of the first line not joined. */
function keywordContinuation(first: string, lines: string[], from: number, isRunningHead: (line: string) => boolean): { text: string; end: number } {
  let text = first;
  let end = from;
  for (let j = from; j < lines.length && j < from + 3; j++) {
    const next = lines[j].trim();
    if (!next || KW_STOP_LINE.test(next) || isRunningHead(next) || !looksLikeKeywords(next)) break;
    const open = KW_ENDS_OPEN.test(text) || /\p{L}-$/u.test(text);
    const firstJoin = j === from;
    const joins = open || (firstJoin && (/[,;]/.test(next) || (/\.$/.test(next) && next.split(/\s+/).length <= 4)));
    if (!joins) break;
    // A word broken at a hyphen ("socio-" / "economic") is joined without a space.
    text = /\p{L}-$/u.test(text) ? text + next : `${text} ${next}`;
    end = j + 1;
  }
  return { text, end };
}

/** The keyword text after the label → the list: a trailing sentence dropped,
 *  split on , ; and "and", at most 10. */
function parseKeywordText(kwRaw: string): string[] {
  return kwRaw
    ? kwRaw
        .split(/\.\s|\n/)[0]                 // drop a trailing sentence
        .split(/[,;]|\band\b/i)
        .map((k) => k.trim().replace(/[.;:]+$/, ""))
        // "self - efficacy" → "self-efficacy": a hyphen with a space on BOTH
        // sides, between letters ("pre- or post-test" keeps its space).
        .map((k) => k.replace(/(\p{L}) +- +(\p{L})/gu, "$1-$2"))
        .filter((k) => k.length > 1 && k.length < 60)
        .slice(0, 10)
    : [];
}

/** `pageStarts`: the line index in `text` where each page starts (readPages
 *  gives it). Without it, running heads inside the abstract are kept, as the
 *  page breaks are not known. */
export function extractAbstractAndKeywords(
  text: string,
  pageStarts: readonly number[] = [],
): { abstract: string; keywords: string[] } {
  const flat = text.replace(/[ \t\u00a0]+/g, " ");

  const lines = flat.split("\n");
  const isRunningHead = runningHeads(lines);
  const timesSeen = lineCounts(lines);
  const starts = new Set(pageStarts);

  // --- Abstract: after the heading, stop at the next section heading.
  // Length-bounded (40–4000 chars) so a missing terminator cannot run away.
  // Terminators must START A LINE: with /i, a bare \bBACKGROUND\b also matches
  // "against a background of…" mid-abstract and cuts the abstract short.
  // Most must also END the line (after an optional "2"/"1."/"I." number and a
  // trailing page number): a wrapped line can begin "introduction of hybrid
  // lines…" or "contents of nitrogen…". Only KEYWORDS, CHAPTER 1 and TABLE OF
  // CONTENTS may run on, as in "Keywords: rice, soil".
  // ABSTRAK / BUOD: a Filipino-language abstract that follows the English one.
  const sectionEnd = String.raw`(?:(?:\d+|[IVX]+)\.?\s+)?(?:INTRODUCTION|BACKGROUND|CONTENTS|ACKNOWLEDG\w*|DEDICATION|DECLARATION|LIST\s+OF\s+(?:FIGURES|TABLES)|APPROVAL\s+SHEET|BIOGRAPHICAL\s+SKETCH|CERTIFICATION|ABSTRAK|BUOD)[ \t]*(?:[ivxlc\d]+[ \t]*)?\n`;
  const abstractRe = new RegExp(
    String.raw`\bABSTRACT\b[ \t]*([^\n]*)\n?([\s\S]{40,4000}?)(?=\n\s*(?:KEY\s?WORDS?|CHAPTER\s+(?:1|I|ONE)\b|TABLE\s+OF\s+CONTENTS|${sectionEnd}))`,
    "gi",
  );
  let abstract = "";
  for (let m; (m = abstractRe.exec(flat)); ) {
    // Skip table-of-contents entries such as "ABSTRACT ........ 3" or "Abstract v":
    // in a thesis the contents page often comes before the abstract itself.
    // Resume just past this heading, or the skipped match swallows the real one.
    if (CONTENTS_ENTRY.test(m[1])) {
      abstractRe.lastIndex = m.index + "ABSTRACT".length;
      continue;
    }
    // Text on the heading line itself ("ABSTRACT: This study…") is abstract
    // text, so the header-block check only applies when the heading stood alone.
    const sameLine = m[1].replace(/^[:.\-\u2013\u2014]\s*/, "");
    // Running header / footer lines belong to the page, not the abstract:
    // first those at a page break inside it, then those at its end.
    const bodyAt = m.index + m[0].length - m[2].length;
    const firstLine = flat.slice(0, bodyAt).split("\n").length - 1;
    const inner = starts.size ? stripMiddleRunningHeads(m[2], firstLine, lines, starts, isRunningHead, timesSeen) : m[2];
    const body = stripTrailingRunningHeads(inner, isRunningHead);
    abstract = joinHyphens(
      `${sameLine}\n${sameLine.trim() ? body : stripHeaderBlock(body)}`
        .replace(/\s+/g, " ")
        .trim()
        .replace(TRAILING_PAGE_MARKS, "$1"),
      flat,
    );
    break;
  }

  // --- Keywords: ONE LINE, plus the lines it wraps onto (keywordContinuation).
  // \bKEY\s?WORDS?\b matches KEYWORD, KEYWORDS, "KEY WORD" and "KEY WORDS".
  let kwRaw = "";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\bKEY\s?WORDS?\b\s*[:.\-\u2013\u2014]?\s*(.*)$/i);
    if (m) {
      let at = i;
      kwRaw = m[1].trim();
      if (!kwRaw) {
        while (++at < lines.length && !lines[at].trim());
        kwRaw = (lines[at] ?? "").trim();
      }
      kwRaw = keywordContinuation(kwRaw, lines, at + 1, isRunningHead).text;
      break;
    }
  }

  return { abstract, keywords: parseKeywordText(kwRaw) };
}

/** A keywords label that starts a line: "Keywords: rice, soil", "KEY WORDS —
 *  rice", or "Keywords" alone with the list on the next line. "Keywords are
 *  …" (a sentence) is not one: text after the label needs : . or a dash. */
const TYPED_KW_LINE = /^\s*KEY\s?WORDS?\s*(?:[:.\-–—]\s*(.*))?$/i;
/** The same label after the last sentence of a line ("… in Isabela. Keywords:
 *  rice, soil"), as when a pasted abstract lost its line break. Only with : or
 *  a dash here, so a sentence such as "… used these keywords. Rice …" is left alone. */
const TYPED_KW_TAIL = /([.!?]["”)]?)\s+KEY\s?WORDS?\s*[:\-–—]\s*(.+)$/i;

/**
 * A "Keywords:" line pasted or typed into the abstract box (Register, errata
 * #80): the study's printed keywords, read with the same rules as from a PDF
 * (wrapped lines joined, split on , ; and "and", a trailing sentence dropped,
 * at most 10). Returns the abstract without that line and the keywords, or
 * null when the text has no such line. The last such line counts.
 */
export function takeKeywordsLine(typed: string): { abstract: string; keywords: string[] } | null {
  const lines = typed.split("\n");
  const noRunningHeads = () => false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const own = TYPED_KW_LINE.exec(lines[i]);
    const tail = own ? null : TYPED_KW_TAIL.exec(lines[i]);
    if (!own && !tail) continue;
    // Text before the label on the same line stays in the abstract.
    const before = tail ? lines[i].slice(0, tail.index + tail[1].length) : "";
    let at = i;
    let kwRaw = ((own ? own[1] : tail![2]) ?? "").trim();
    if (!kwRaw) {
      // The label alone: the list is on the next line with text.
      while (++at < lines.length && !lines[at].trim());
      kwRaw = (lines[at] ?? "").trim();
    }
    const { text, end } = keywordContinuation(kwRaw, lines, at + 1, noRunningHeads);
    const rest = [...lines.slice(0, i), ...(before.trim() ? [before] : []), ...lines.slice(end)];
    return { abstract: rest.join("\n").trim(), keywords: parseKeywordText(text) };
  }
  return null;
}

/** How far a PDF read has got (errata #82), for the line under the spinner. */
export type ReadProgress =
  | { kind: "loading" }
  | { kind: "download"; loaded: number; total: number | null }
  | { kind: "page"; page: number };

const mb = (bytes: number) => (bytes / 1048576).toFixed(1);

/** "Downloading 3.1 of 11.6 MB…", "Reading page 5 (up to 40)…". */
export function progressText(p: ReadProgress): string {
  if (p.kind === "loading") return "Starting the PDF reader…";
  if (p.kind === "download") {
    return p.total && p.total >= p.loaded ? `Downloading ${mb(p.loaded)} of ${mb(p.total)} MB…` : `Downloading ${mb(p.loaded)} MB…`;
  }
  return `Reading page ${p.page} (up to ${MAX_PAGES})…`;
}

/** What reading the pages gave. `pages` holds the text of every page read
 *  (index 0 = page 1), so the study details (pdfDetails.ts) can be read from
 *  the title page and the abstract page without reading them twice.
 *  `problem` is MSG_SCANNED or MSG_NOT_FOUND, or null. */
export interface PagesRead {
  abstract: string;
  keywords: string[];
  pagesRead: number;
  pages: string[];
  problem: string | null;
}

/** Read pages one at a time (page 1 first) and stop early. extractAbstractAndKeywords
 *  only returns an abstract once the heading that ENDS it has been read, so
 *  "abstract found" also means "its end is known". One more page is then read,
 *  because the Keywords line is sometimes printed at the top of the next page.
 *  With no abstract, reading goes on to MAX_PAGES (or the last page).
 *  `pageText(n)` gives the text of page n (1-based), lines ending in "\n".
 *  `onPage(n)` is told before page n is read (the "Reading page n" line). */
export async function readPages(
  numPages: number,
  pageText: (n: number) => Promise<string>,
  onPage?: (n: number) => void,
): Promise<PagesRead> {
  const last = Math.min(numPages, MAX_PAGES);
  let text = "";
  let scanText = "";
  let stopAfter = last;
  let pagesRead = 0;
  const pages: string[] = [];
  const pageStarts: number[] = [];                    // line index of each page's first line
  let lineCount = 0;
  for (let n = 1; n <= stopAfter; n++) {
    onPage?.(n);
    const raw = await pageText(n);
    pages.push(raw);
    const page = raw + "\n";                          // page break
    pageStarts.push(lineCount);
    lineCount += page.split("\n").length - 1;
    text += page;
    if (n <= SCAN_CHECK_PAGES) scanText += page;
    pagesRead = n;
    if (stopAfter === last && extractAbstractAndKeywords(text, pageStarts).abstract) {
      stopAfter = Math.min(n + 1, last);
    }
  }
  const { abstract, keywords } = extractAbstractAndKeywords(text, pageStarts);
  const problem = !abstract && scanText.replace(/\s/g, "").length < MIN_TEXT_CHARS ? MSG_SCANNED
    : !abstract && keywords.length === 0 ? MSG_NOT_FOUND
    : null;
  return { abstract, keywords, pagesRead, pages, problem };
}

/** readPages for the abstract and keywords only. Throws MSG_SCANNED or
 *  MSG_NOT_FOUND, as before. */
export async function extractFromPages(
  numPages: number,
  pageText: (n: number) => Promise<string>,
): Promise<{ abstract: string; keywords: string[]; pagesRead: number }> {
  const { abstract, keywords, pagesRead, problem } = await readPages(numPages, pageText);
  if (problem) throw new Error(problem);
  return { abstract, keywords, pagesRead };
}
