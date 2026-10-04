# 06 — PDF Auto-Extraction

**Status:** ◐ BUILT — 2026-10-04, branch `step-06-pdf`. Drive API key created and the §0
day-1 spike printed `200 application/pdf` from `localhost:8443` (and the key is refused from
other sites). pdfjs-dist 6.4.299, worker `pdf.worker.min.mjs`. Pending the §8 checks by hand
and a test with real ISU thesis PDFs.
**Owner:** C · **Depends on:** 04 · **Next:** 07 or 08

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Install pdfjs-dist,
> create `src/extractPdf.ts` using the code below (download through the Google
> Drive API, never a direct Drive URL), and wire it into `RegisterForm`,
> replacing the existing setTimeout mock. Preserve the three processing states.
> Do not start step 07."*

---

## 0. Before any code — the Drive API key (manual, ~10 minutes)

**Why the Drive API.** A browser may only download a file from another site if
that site allows it (CORS). Google Drive's ordinary download links
(`drive.google.com/uc?…`, `drive.usercontent.google.com/download?…`) do not, so a
direct `fetch` from `isu-archive-9253b.web.app` is blocked and auto-fill would
fail on every thesis. The **Drive API v3** endpoint is designed to be called from
web pages and does allow it. It is **free** — no billing account, no per-request
charge, only generous rate limits that one-at-a-time registration never
approaches.

**Setup — A does this (A owns the Firebase / Google Cloud project, `10` §3):**

1. https://console.cloud.google.com → select the `isu-archive-9253b` project
   (Firebase created it)
2. **APIs & Services → Library → Google Drive API → Enable**
3. **APIs & Services → Credentials → Create credentials → API key**
4. Edit the key:
   - **Application restrictions → Websites**, add
     `http://localhost:8443/*`, `https://isu-archive-9253b.web.app/*`,
     `https://isu-archive-9253b.firebaseapp.com/*`
   - **API restrictions → Restrict key → Google Drive API** only
5. Give the key to C. It goes into `src/extractPdf.ts` as `DRIVE_API_KEY` and is
   committed — restricted to your domains and to downloads of files that are
   already public, so it is as safe to commit as the Firebase web config
   (preamble rule 11).

**Day-1 spike — do this before building anything else in this step.** In the
browser devtools console on `http://localhost:8443`, with a real ISU thesis PDF
shared as "Anyone with the link → Viewer":

```js
const r = await fetch("https://www.googleapis.com/drive/v3/files/<FILE_ID>?alt=media&key=<KEY>");
console.log(r.status, r.headers.get("content-type"));   // expect 200 application/pdf
```

If this prints 200 you are clear. If it is blocked or 403s, stop and tell the
group before writing `extractPdf.ts` — manual entry remains the fallback, but
the demo plan changes.

---

## 1. The feature

Staff paste a Google Drive share link and click Submit. The app then:

1. Downloads the PDF **in the browser** through the Google Drive API — no server
2. Reads text from the **first pages only** (`MAX_PAGES`, §4)
3. Finds the `ABSTRACT` section and the `KEYWORDS` line with regex
4. Fills the form so staff can review, edit, and confirm

If the PDF is scanned, image-only, or the fetch fails, the app falls back to
manual entry. That fallback is a designed state, not an error path.

---

## 2. What to replace

`RegisterForm` already has the correct UI and state machine:

```typescript
type ExtractionState = "idle" | "extracting" | "success" | "needs_review";
```

- **PROCESSING** — yellow bar, spinner, "Reading PDF and filling in details..."
- **READY TO REVIEW** — green bar, editable abstract textarea, keyword chips, "Confirm & Save"
- **NEEDS MANUAL ENTRY** — yellow warning, empty fields, "Save Manually"

**Keep all three states and the whole UI.** Replace only the fake data source.

The prototype currently runs:

```typescript
setTimeout(() => {
  setExtractState(Math.random() > 0.3 ? "success" : "needs_review");
  setAbstract(MOCK_ABSTRACT);
  setKeywords(MOCK_KEYWORDS);
}, 1800);
```

That is a 70% chance of success **at random**. Delete the whole `setTimeout` block
and replace it with §5 below. `grep -n "MOCK_ABSTRACT\|Math.random" src/` must
return nothing when you are done.

---

## 3. Install

```bash
npm install pdfjs-dist
```

This dependency is pre-approved for this step (preamble rule 6).

### The worker is required

In pdfjs-dist v4 and later, an unset `workerSrc` produces
`Warning: Setting up fake worker` and then a hang or a hard failure on
`getDocument()`. Set it once at module load, before any call:

```typescript
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
```

Check the real filename against your installed version — look in
`node_modules/pdfjs-dist/build/`. v4/v5 ship `pdf.worker.min.mjs`; older v3 used
`pdf.worker.js`. If the `?url` import does not resolve under your Vite version, use
`new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` instead.

---

## 4. `src/extractPdf.ts`

Pure functions, no Firebase imports.

```typescript
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/** Browser key from §0. Restricted to our domains and the Drive API; safe to commit. */
const DRIVE_API_KEY = "REPLACE_WITH_KEY_FROM_A";

/** Theses often put the abstract after the title page, approval sheet and
 *  acknowledgements, so 4 pages can miss it. Tune against real ISU PDFs (§8). */
const MAX_PAGES = 8;

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

function firstNonEmptyLine(lines: string[], from: number): string {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim()) return lines[i].trim();
  }
  return "";
}

/** Download and read the first MAX_PAGES pages, preserving line breaks. */
async function readPdfText(driveLink: string): Promise<string> {
  const fileUrl = driveLinkToFileUrl(driveLink);
  if (!fileUrl) throw new Error("Invalid Google Drive link");

  // Fetch first so a sharing problem becomes a clear message instead of an
  // InvalidPDFException from pdf.js.
  const res = await fetch(fileUrl);
  if (res.status === 403 || res.status === 404) {
    throw new Error(
      "Could not open that file. Make sure it is shared as 'Anyone with the link → Viewer'.",
    );
  }
  if (!res.ok) throw new Error(`Google Drive returned an error (${res.status}). Try again.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("pdf")) {
    throw new Error("That Drive file is not a PDF.");
  }

  const pdf = await pdfjsLib.getDocument({ data: await res.arrayBuffer() }).promise;
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
}

export function extractAbstractAndKeywords(
  text: string,
): { abstract: string; keywords: string[] } {
  const flat = text.replace(/[ \t\u00a0]+/g, " ");

  // --- Abstract: after the heading, stop at the next section heading.
  // Length-bounded (40–3000 chars) so a missing terminator cannot run away.
  // Terminators must START A LINE: with /i, a bare \bBACKGROUND\b also matches
  // "against a background of…" mid-abstract and cuts the abstract short.
  const abstractMatch = flat.match(
    /\bABSTRACT\b\s*[:.\-\u2013\u2014]?\s*([\s\S]{40,3000}?)(?=\n\s*(?:KEY\s?WORDS?|INTRODUCTION|CHAPTER\s+(?:1|I|ONE)\b|BACKGROUND|TABLE\s+OF\s+CONTENTS))/i,
  );
  const abstract = abstractMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";

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

export async function extractFromDrive(
  driveLink: string,
): Promise<{ abstract: string; keywords: string[] }> {
  const invalid = validateDriveLink(driveLink);
  if (invalid) throw new Error(invalid);

  const text = await readPdfText(driveLink);
  const { abstract, keywords } = extractAbstractAndKeywords(text);
  if (!abstract && keywords.length === 0) {
    throw new Error("Could not find an abstract or keywords in that PDF");
  }
  return { abstract, keywords };
}
```

### Five things in there that are easy to get wrong

**Anchor the abstract terminators to a line start.** The `/i` flag is needed for
headings typed as "Keywords" or "Introduction", but it also lets an unanchored
`BACKGROUND` or `INTRODUCTION` match ordinary words inside the abstract. The
`\n\s*` in the lookahead restricts them to headings. This relies on line breaks
being preserved — the next point.

**Preserve line breaks.** `content.items.map(i => i.str).join(" ")` flattens every
line, and the keyword pattern is line-bounded. With no newlines there is no such
thing as "the line containing KEYWORDS", so the match cannot work. Honour
`item.hasEOL`.

**Bound the keyword capture to one line.** A greedy `(.+)$` with the `s` flag
captures from `KEYWORDS:` to the end of the document — on a 4-page thesis that is
three pages of chapter text, which then becomes ten garbage keyword chips. A
`.slice(0, 10)` does not fix this; it just takes the first ten fragments of the
garbage.

**Match `KEY WORDS`.** `\bKEY\s?WORDS?\b` covers `KEYWORD`, `KEYWORDS`, `KEY WORD`
and `KEY WORDS`, in any case. The spaced spelling is common in real theses. Do not
"simplify" the pattern to `KEYWORDS?`, which never matches it.

**Length-bound the abstract.** The non-greedy `+?` still needs a terminator. The
`{40,3000}` guard means a PDF whose abstract has no following heading produces a
truncated abstract instead of the entire document.

---

## 5. Wiring into `RegisterForm`

```typescript
import { extractFromDrive, validateDriveLink } from "../extractPdf";

async function handleSubmit() {
  const invalid = validateDriveLink(form.driveLink);
  if (invalid) { setError(invalid); return; }

  setError("");
  setExtractState("extracting");
  try {
    const { abstract, keywords } = await extractFromDrive(form.driveLink);
    setAbstract(abstract);
    setKeywords(keywords);
    setExtractState("success");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Could not read that PDF.");
    setAbstract("");
    setKeywords([]);
    setExtractState("needs_review");
  }
}
```

Show the caught error. A bare `catch {}` leaves the user staring at an empty form
with no explanation, which is indistinguishable from a broken app.

### Save with the right status

| Button | Status |
|--------|--------|
| "Confirm & Save" | `ARCHIVED` |
| "Save Manually" | `NEEDS_REVIEW` |

**Already done in step 04** — `RegisterForm.handleSave` picks the status from
`extractState` and calls `onSave(thesis, status)`, which reaches `saveThesis()`.
Do not touch it; this step only replaces the fake extraction. Keep the
`extractState` values exactly as they are, since the status depends on them.

---

## 6. Validation and UX

- Disable Submit until the link is non-empty
- Validate before downloading — `validateDriveLink` returns a message, show it
- Show a word count under the abstract (the prototype already does)
- Keywords are chips: staff can remove one with X, and add one by typing + Enter.
  Keep both.

---

## 7. Sharing, CORS and large files

The download goes through the Drive API (§0), which allows browser requests.
It only works for files shared as **"Anyone with the link → Viewer"**: a
restricted file returns 403 and §4 reports it as a sharing problem. Reading
private files would need each staff member to grant Drive access via OAuth — out
of scope; ask Research staff to share the PDFs.

Do **not** switch back to `drive.google.com/uc?…` or
`drive.usercontent.google.com/download?…`. Those send no CORS headers; the
browser blocks them no matter how the file is shared.

**Temporary refusals (seen 2026-10-04).** After ~15 downloads of the same two test files in a
few minutes, Drive answered `503` to every `alt=media` request while metadata requests still
returned 200. A 503 arrives without CORS headers, so the browser reports it as a network error
("Failed to fetch"), not as a status. `extractPdf.ts` therefore retries twice (after 1 s and
3 s) on a 5xx or network error, then shows a "Drive is busy — wait a few minutes" message
instead of blaming the user's internet. A freshly uploaded file then failed the same way, and
the same request made with curl showed the real cause: Google's anti-robot page ("your computer
or network may be sending automated queries"). The block is on the **network's IP address**,
not on the key, the files or the code — metadata requests kept working. It cannot and must not
be bypassed (no CAPTCHA solving); it clears on its own, and another network (e.g. a phone
hotspot) is not affected. During testing, avoid re-downloading the same file over and over; in
the demo, register each thesis once and have the manual-entry path ready.

Very large files (≈100 MB+) that Google cannot virus-scan may be refused by the
API. Thesis PDFs are far smaller; if one hits this, manual entry covers it.

If extraction fails for any reason, the `needs_review` state handles it. Rehearse
that path in your demo too — it is part of the design, and "what happens when the
PDF is scanned?" is a question you should be able to answer while clicking through
the app.

---

## 8. Verification

Test against **real PDFs**, not ones you imagine. Take 3–4 actual ISU thesis
PDFs shared as "Anyone with the link", and paste the extracted text into a
scratch script to inspect it before trusting it in the form. Note on which page
each abstract actually starts, and adjust `MAX_PAGES` if 8 is not enough.

- [ ] The §0 day-1 spike printed `200 application/pdf` from `localhost:8443`

- [ ] A real text-based thesis PDF → PROCESSING → READY TO REVIEW
- [ ] Abstract and keywords come from the actual PDF text
- [ ] Keyword chips contain **only keywords** — no page 2–4 text bleeding in
- [ ] A PDF that writes `KEY WORDS:` with a space parses correctly
- [ ] Staff can edit the abstract and add/remove keyword chips
- [ ] "Confirm & Save" writes a document with `status: "ARCHIVED"`
- [ ] A scanned/image-only PDF → NEEDS MANUAL ENTRY, empty fields, "Save Manually" works
- [ ] "Save Manually" writes a document with `status: "NEEDS_REVIEW"`
- [ ] An abstract containing the word "background" or "introduction" mid-text is
      **not** cut short
- [ ] A file shared as "Restricted" shows the "Anyone with the link" message
- [ ] `grep -rn "drive.usercontent" src/` returns nothing
- [ ] A garbage link shows a specific error message and does not crash
- [ ] A non-Drive URL is rejected before any download starts
- [ ] `grep -rn "MOCK_ABSTRACT\|Math.random" src/` returns nothing
- [ ] `npm run build` passes

---

**Next:** `07-combined-summary.md`, then `08-deployment.md`.
