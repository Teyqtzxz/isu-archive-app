// PDF auto-extraction (docs/06): download a shared thesis PDF through the
// Google Drive API (or take one chosen from this computer) and read it with
// pdf.js. When to stop reading and how the abstract and keywords are found
// live in pdfText.ts; the study details (title, authors, …) in pdfDetails.ts.
// Neither imports pdf.js, so both can be tested in Node. No Firebase import.
//
// pdf.js is loaded only when it is needed (errata #82): the Register / Edit
// form starts loading it (preloadPdfReader) while staff choose the file, so
// students and every other screen never download it.
import { driveFileId, pdfFileProblem, validateDriveLink } from "./validation";
import { readStudy, type StudyRead } from "./pdfDetails";
import type { ReadProgress } from "./pdfText";
// Moved to validation.ts with the other input rules; re-exported for old imports.
export { driveFileId, validateDriveLink };
// Moved to pdfText.ts (errata #78); re-exported for old imports.
export { MAX_PAGES, extractAbstractAndKeywords } from "./pdfText";
export type { ReadProgress, StudyRead };

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
  "Google Drive is busy or limiting downloads right now. Wait a few minutes and try again, or type or paste the abstract.";
const READER_FAILED = "The PDF reader could not be loaded. Check your internet connection and try again.";

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

/** The body, chunk by chunk, telling `onProgress` how much has arrived.
 *  Content-Length is readable across origins, so the total is known when
 *  Drive sends it. */
async function bodyWithProgress(res: Response, onProgress?: (p: ReadProgress) => void): Promise<ArrayBuffer> {
  const total = Number(res.headers.get("content-length")) || null;
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  onProgress?.({ kind: "download", loaded, total });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.({ kind: "download", loaded, total });
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

/** Download the PDF through the Drive API. */
async function downloadDrivePdf(driveLink: string, onProgress?: (p: ReadProgress) => void): Promise<ArrayBuffer> {
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
  return bodyWithProgress(res, onProgress);
}

type PdfJs = typeof import("pdfjs-dist");
type Reader = { lib: PdfJs; worker: InstanceType<PdfJs["PDFWorker"]> };
let reader: Promise<Reader> | null = null;

/** pdf.js and its worker, loaded once (a separate download, not in the main
 *  bundle). A failed load (offline) is tried again on the next call. */
function loadPdfReader(): Promise<Reader> {
  if (!reader) {
    const loading = (async () => {
      const [lib, { default: workerSrc }] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      lib.GlobalWorkerOptions.workerSrc = workerSrc;
      const worker = new lib.PDFWorker();
      await worker.promise;                           // the worker script is fetched and started
      return { lib, worker };
    })();
    reader = loading;
    loading.catch(() => {
      if (reader === loading) reader = null;
    });
  }
  return reader;
}

/** Start loading pdf.js and its worker now (Register / Edit opened), so the
 *  first read does not wait for them. Errors are ignored here: the read
 *  itself tries again and shows them. */
export function preloadPdfReader(): void {
  loadPdfReader().catch(() => {});
}

/** Shared by both sources: open the PDF and read it page by page until the
 *  abstract is found (pdfText.ts readPages, at most MAX_PAGES pages), then
 *  the details (pdfDetails.ts). */
async function readBytes(data: ArrayBuffer, onProgress?: (p: ReadProgress) => void): Promise<StudyRead> {
  let r: Reader;
  try {
    r = await loadPdfReader();
  } catch {
    throw new Error(READER_FAILED);
  }
  if (r.worker.destroyed) {
    reader = null;
    r = await loadPdfReader();
  }
  const task = r.lib.getDocument({ data, worker: r.worker });
  try {
    const pdf = await task.promise.catch(() => {
      throw new Error("That file could not be opened as a PDF. It may be damaged.");
    });
    return await readStudy(pdf.numPages, async (n) => {
      const content = await (await pdf.getPage(n)).getTextContent();
      let text = "";
      for (const item of content.items as any[]) {
        if (typeof item.str !== "string") continue;   // skip markup/annotation items
        text += item.str;
        text += item.hasEOL ? "\n" : " ";            // keep line breaks
      }
      return text;
    }, onProgress);
  } finally {
    void task.destroy();                              // free the document; the shared worker stays
  }
}

export async function readFromDrive(driveLink: string, onProgress?: (p: ReadProgress) => void): Promise<StudyRead> {
  const invalid = validateDriveLink(driveLink);
  if (invalid) throw new Error(invalid);
  onProgress?.({ kind: "loading" });
  preloadPdfReader();                                 // in parallel with the download
  return readBytes(await downloadDrivePdf(driveLink, onProgress), onProgress);
}

/** Backup source: a PDF picked from this computer. No Drive download, so a
 *  Drive outage or rate limit cannot stop auto-fill. */
export async function readFromFile(file: File, onProgress?: (p: ReadProgress) => void): Promise<StudyRead> {
  // Not a PDF, empty, or over MAX_PDF_MB (validation.ts).
  const problem = pdfFileProblem(file);
  if (problem) throw new Error(problem.message);
  onProgress?.({ kind: "loading" });
  return readBytes(await file.arrayBuffer(), onProgress);
}
