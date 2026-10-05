// PDF auto-extraction (docs/06): download a shared thesis PDF through the
// Google Drive API, read its first pages with pdf.js, and pull out the
// abstract and keywords with regex. Pure — no Firebase import.
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/** Browser key from docs/06 §0. Restricted to our three sites and to the
 *  Drive API only; safe to commit (preamble rule 11). */
const DRIVE_API_KEY = "AIzaSyCidmWQuqPAb5T5OM2hlsOdLHY7L7El_lw";

/** Theses put the abstract after the title page, approval sheet, certificate,
 *  acknowledgements, dedication, contents and lists of tables/figures. A real
 *  bachelor's project report tested on 2026-10-05 had it on page 11, so 8 was
 *  too few. Reading 15 pages of text takes well under a second. */
export const MAX_PAGES = 15;

/** Fewer letters than this in the pages read → treat the PDF as scanned. */
const MIN_TEXT_CHARS = 50;

/** Accepts /file/d/{id}/view · /file/d/{id} · ?id={id} · /open?id={id} */
export function driveFileId(link: string): string | null {
  const m = link.match(/(?:file\/d\/|[?&]id=)([-\w]{25,})/);
  return m ? m[1] : null;
}

/** The Drive API download URL — the only Drive endpoint that allows browser CORS. */
export function driveLinkToFileUrl(link: string): string | null {
  const id = driveFileId(link);
  if (!id) return null;
  return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${DRIVE_API_KEY}`;
}

/** Reject bad links before spending a PDF download on them. */
export function validateDriveLink(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return "Please paste a Google Drive link.";
  if (!/^https?:\/\/(drive|docs)\.google\.com\//i.test(trimmed)) {
    return "That does not look like a Google Drive link.";
  }
  if (!driveLinkToFileUrl(trimmed)) {
    return "Could not find a file id in that link. Make sure it is a shared file link.";
  }
  return null;
}

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
 *  "(iv)", "| 4", "- 5 -") and the running header of a blank back page
 *  ("vi Abstract"), possibly several of them in a row. */
const TRAILING_PAGE_MARKS =
  /([.!?)\]"\u201d])(?:\s+(?:[|\-\u2013\u2014]?\s*\(?(?:[ivxlc]+|\d{1,4})\)?\s*[|\-\u2013\u2014]?|abstract))+\s*$/i;

function firstNonEmptyLine(lines: string[], from: number): string {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim()) return lines[i].trim();
  }
  return "";
}

const DRIVE_BUSY =
  "Google Drive is busy or limiting downloads right now. Wait a few minutes and try again, or type the abstract and keywords.";

/** Waits between retries. Google asks clients to back off on 5xx (Drive API
 *  "Resolve errors" guide); a few seconds is enough for one registration. */
const RETRY_DELAYS_MS = [1000, 3000];

/** fetch() that retries on Drive's temporary failures. A 5xx without CORS
 *  headers reaches the page as a network error (fetch throws), not as a
 *  status, so both count as temporary. 4xx answers are returned at once. */
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url);
      if (res.status < 500) return res;
    } catch {
      if (!navigator.onLine) {
        throw new Error("You appear to be offline. Check your internet connection and try again.");
      }
    }
    if (attempt >= RETRY_DELAYS_MS.length) {
      if (res) throw new Error(`Google Drive returned an error (${res.status}). ${DRIVE_BUSY}`);
      throw new Error(DRIVE_BUSY);
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
}

/** Download the PDF through the Drive API. */
async function downloadDrivePdf(driveLink: string): Promise<ArrayBuffer> {
  const fileUrl = driveLinkToFileUrl(driveLink.trim());
  if (!fileUrl) throw new Error("Invalid Google Drive link");

  // Fetch first so a sharing problem becomes a clear message instead of an
  // InvalidPDFException from pdf.js.
  const res = await fetchWithRetry(fileUrl);
  if (res.status === 403 || res.status === 404) {
    // Drive also answers 403 when it is rate-limiting downloads; only the
    // body tells the two apart.
    const body = await res.text().catch(() => "");
    if (/rateLimit|quota/i.test(body)) throw new Error(DRIVE_BUSY);
    throw new Error(
      "Could not open that file. Make sure it is shared as 'Anyone with the link → Viewer'.",
    );
  }
  if (!res.ok) throw new Error(`Google Drive returned an error (${res.status}). Try again.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("pdf")) {
    throw new Error("That Drive file is not a PDF.");
  }
  return res.arrayBuffer();
}

/** Read the first MAX_PAGES pages, preserving line breaks. */
async function readPdfText(data: ArrayBuffer): Promise<string> {
  const task = pdfjsLib.getDocument({ data });
  try {
    const pdf = await task.promise.catch(() => {
      throw new Error("That file could not be opened as a PDF. It may be damaged.");
    });
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    let text = "";
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items as any[]) {
        if (typeof item.str !== "string") continue;   // skip markup/annotation items
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      text += "\n";                                   // page break
    }
    return text;
  } finally {
    void task.destroy();                              // free the worker and its copy of the file
  }
}

export function extractAbstractAndKeywords(
  text: string,
): { abstract: string; keywords: string[] } {
  const flat = text.replace(/[ \t\u00a0]+/g, " ");

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
    if (/^(?:[\s.]*\.{3}|(?:\.\s){3}|[ivxlc\d]+\s*$)/i.test(m[1])) {
      abstractRe.lastIndex = m.index + "ABSTRACT".length;
      continue;
    }
    // Text on the heading line itself ("ABSTRACT: This study…") is abstract
    // text, so the header-block check only applies when the heading stood alone.
    const sameLine = m[1].replace(/^[:.\-\u2013\u2014]\s*/, "");
    abstract = `${sameLine}\n${sameLine.trim() ? m[2] : stripHeaderBlock(m[2])}`
      .replace(/\s+/g, " ")
      .trim()
      .replace(TRAILING_PAGE_MARKS, "$1");
    break;
  }

  // --- Keywords: bounded to ONE LINE.
  // \bKEY\s?WORDS?\b matches KEYWORD, KEYWORDS, "KEY WORD" and "KEY WORDS".
  const lines = flat.split("\n");
  let kwRaw = "";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\bKEY\s?WORDS?\b\s*[:.\-\u2013\u2014]?\s*(.*)$/i);
    if (m) {
      kwRaw = m[1].trim() || firstNonEmptyLine(lines, i + 1);
      break;
    }
  }

  const keywords = kwRaw
    ? kwRaw
        .split(/\.\s|\n/)[0]                 // drop a trailing sentence
        .split(/[,;]|\band\b/i)
        .map((k) => k.trim().replace(/[.;:]+$/, ""))
        .filter((k) => k.length > 1 && k.length < 60)
        .slice(0, 10)
    : [];

  return { abstract, keywords };
}

/** Shared by both sources: read the text, then find the abstract and keywords. */
async function extractFromBytes(
  data: ArrayBuffer,
): Promise<{ abstract: string; keywords: string[] }> {
  const text = await readPdfText(data);
  if (text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    throw new Error(
      "This PDF has no readable text — it is probably scanned. Please type the abstract and keywords.",
    );
  }
  const { abstract, keywords } = extractAbstractAndKeywords(text);
  if (!abstract && keywords.length === 0) {
    throw new Error("Could not find an abstract or keywords in that PDF. Please type them in.");
  }
  return { abstract, keywords };
}

export async function extractFromDrive(
  driveLink: string,
): Promise<{ abstract: string; keywords: string[] }> {
  const invalid = validateDriveLink(driveLink);
  if (invalid) throw new Error(invalid);
  return extractFromBytes(await downloadDrivePdf(driveLink));
}

/** Larger than any thesis PDF; stops someone picking a huge file by mistake. */
const MAX_FILE_MB = 100;

/** Backup source: a PDF picked from this computer. No Drive download, so a
 *  Drive outage or rate limit cannot stop auto-fill. */
export async function extractFromFile(
  file: File,
): Promise<{ abstract: string; keywords: string[] }> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new Error("That file is not a PDF.");
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`That PDF is larger than ${MAX_FILE_MB} MB. Please type the abstract and keywords.`);
  }
  return extractFromBytes(await file.arrayBuffer());
}
