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
  "This PDF has no readable text — it is probably scanned. Please type the abstract and keywords.";
export const MSG_NOT_FOUND = "Could not find an abstract or keywords in that PDF. Please type them in.";

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
 *  Matched from the end (no backtracking over the line), as this runs on
 *  every line of up to 40 pages. */
const PAGE_NUMBER_AT_END = /\s+(?:[ivxlc]+|[IVXLC]+|\d{1,4})$/u;

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
 *  running header (see runningHeads) or a line with a sentence-long part. */
function keywordContinuation(first: string, lines: string[], from: number, isRunningHead: (line: string) => boolean): string {
  let text = first;
  for (let j = from; j < lines.length && j < from + 3; j++) {
    const next = lines[j].trim();
    if (!next || KW_STOP_LINE.test(next) || isRunningHead(next) || !looksLikeKeywords(next)) break;
    const open = KW_ENDS_OPEN.test(text) || /\p{L}-$/u.test(text);
    const firstJoin = j === from;
    const joins = open || (firstJoin && (/[,;]/.test(next) || (/\.$/.test(next) && next.split(/\s+/).length <= 4)));
    if (!joins) break;
    // A word broken at a hyphen ("socio-" / "economic") is joined without a space.
    text = /\p{L}-$/u.test(text) ? text + next : `${text} ${next}`;
  }
  return text;
}

export function extractAbstractAndKeywords(
  text: string,
): { abstract: string; keywords: string[] } {
  const flat = text.replace(/[ \t\u00a0]+/g, " ");

  const lines = flat.split("\n");
  const isRunningHead = runningHeads(lines);

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
    // Running header / footer lines at the end belong to the page, not the abstract.
    const body = stripTrailingRunningHeads(m[2], isRunningHead);
    abstract = `${sameLine}\n${sameLine.trim() ? body : stripHeaderBlock(body)}`
      .replace(/\s+/g, " ")
      .trim()
      .replace(TRAILING_PAGE_MARKS, "$1");
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
      kwRaw = keywordContinuation(kwRaw, lines, at + 1, isRunningHead);
      break;
    }
  }

  const keywords = kwRaw
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

  return { abstract, keywords };
}

/** Read pages one at a time (page 1 first) and stop early. extractAbstractAndKeywords
 *  only returns an abstract once the heading that ENDS it has been read, so
 *  "abstract found" also means "its end is known". One more page is then read,
 *  because the Keywords line is sometimes printed at the top of the next page.
 *  With no abstract, reading goes on to MAX_PAGES (or the last page).
 *  `pageText(n)` gives the text of page n (1-based), lines ending in "\n".
 *  Throws MSG_SCANNED or MSG_NOT_FOUND, as before. */
export async function extractFromPages(
  numPages: number,
  pageText: (n: number) => Promise<string>,
): Promise<{ abstract: string; keywords: string[]; pagesRead: number }> {
  const last = Math.min(numPages, MAX_PAGES);
  let text = "";
  let scanText = "";
  let stopAfter = last;
  let pagesRead = 0;
  for (let n = 1; n <= stopAfter; n++) {
    const page = (await pageText(n)) + "\n";          // page break
    text += page;
    if (n <= SCAN_CHECK_PAGES) scanText += page;
    pagesRead = n;
    if (stopAfter === last && extractAbstractAndKeywords(text).abstract) {
      stopAfter = Math.min(n + 1, last);
    }
  }
  const { abstract, keywords } = extractAbstractAndKeywords(text);
  if (!abstract && scanText.replace(/\s/g, "").length < MIN_TEXT_CHARS) throw new Error(MSG_SCANNED);
  if (!abstract && keywords.length === 0) throw new Error(MSG_NOT_FOUND);
  return { abstract, keywords, pagesRead };
}
