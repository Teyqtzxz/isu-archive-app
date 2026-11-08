// PDF auto-extraction (docs/06): download a shared thesis PDF through the
// Google Drive API (or take one chosen from this computer) and read it with
// pdf.js. When to stop reading and how the abstract and keywords are found
// live in pdfText.ts, which has no pdf.js import so it can be tested in Node.
// No Firebase import.
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { driveFileId, pdfFileProblem, validateDriveLink } from "./validation";
import { extractFromPages } from "./pdfText";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
// Moved to validation.ts with the other input rules; re-exported for old imports.
export { driveFileId, validateDriveLink };
// Moved to pdfText.ts (errata #78); re-exported for old imports.
export { MAX_PAGES, extractAbstractAndKeywords } from "./pdfText";

/** Browser key from docs/06 §0. Restricted to our three sites and to the
 *  Drive API only; safe to commit (preamble rule 11). */
const DRIVE_API_KEY = "AIzaSyCidmWQuqPAb5T5OM2hlsOdLHY7L7El_lw";

/** The Drive API download URL — the only Drive endpoint that allows browser CORS. */
export function driveLinkToFileUrl(link: string): string | null {
  const id = driveFileId(link);
  if (!id) return null;
  return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${DRIVE_API_KEY}`;
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
      "This file is protected, so it can't be read from Google Drive. Choose the PDF from this computer instead.",
    );
  }
  if (!res.ok) throw new Error(`Google Drive returned an error (${res.status}). Try again.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("pdf")) {
    throw new Error("That Drive file is not a PDF.");
  }
  return res.arrayBuffer();
}

/** Shared by both sources: open the PDF and read it page by page until the
 *  abstract is found (pdfText.ts extractFromPages, at most MAX_PAGES pages). */
async function extractFromBytes(
  data: ArrayBuffer,
): Promise<{ abstract: string; keywords: string[] }> {
  const task = pdfjsLib.getDocument({ data });
  try {
    const pdf = await task.promise.catch(() => {
      throw new Error("That file could not be opened as a PDF. It may be damaged.");
    });
    const { abstract, keywords } = await extractFromPages(pdf.numPages, async (n) => {
      const content = await (await pdf.getPage(n)).getTextContent();
      let text = "";
      for (const item of content.items as any[]) {
        if (typeof item.str !== "string") continue;   // skip markup/annotation items
        text += item.str;
        text += item.hasEOL ? "\n" : " ";            // keep line breaks
      }
      return text;
    });
    return { abstract, keywords };
  } finally {
    void task.destroy();                              // free the worker and its copy of the file
  }
}

export async function extractFromDrive(
  driveLink: string,
): Promise<{ abstract: string; keywords: string[] }> {
  const invalid = validateDriveLink(driveLink);
  if (invalid) throw new Error(invalid);
  return extractFromBytes(await downloadDrivePdf(driveLink));
}

/** Backup source: a PDF picked from this computer. No Drive download, so a
 *  Drive outage or rate limit cannot stop auto-fill. */
export async function extractFromFile(
  file: File,
): Promise<{ abstract: string; keywords: string[] }> {
  // Not a PDF, empty, or over MAX_PDF_MB (validation.ts).
  const problem = pdfFileProblem(file);
  if (problem) throw new Error(problem.message);
  return extractFromBytes(await file.arrayBuffer());
}
