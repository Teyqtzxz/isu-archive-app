# 06 — PDF Auto-Extraction

**Status:** ☑ DONE — PRs #14, #15, #16 and the second round of §8 fixes. Drive API key
created and the §0 day-1 spike printed `200 application/pdf` from `localhost:8443` (and
the key is refused from other sites). pdfjs-dist 6.4.299, worker `pdf.worker.min.mjs`.
The extraction code was checked by script against ten real bachelor's theses (§8
"Results"), and on 2026-10-05 a real thesis was **registered through the app** (Register
→ "read a PDF from this computer", arXiv 1407.7143, abstract on page 11): the filled-in
abstract matched the PDF's abstract page word for word (268 words) and the save
succeeded. Still worth one run with an actual ISU thesis when one is available.
**2026-11-08 (errata #78):** the PDF is now read page by page and reading stops one page
after the abstract ends, at most 40 pages (was a fixed first 15); a contents line whose
page number has a space inside ("ABSTRACT x i") is skipped. §4 and §8 third round.
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
2. Reads text **page by page from page 1** and stops one page after the abstract ends,
   never more than `MAX_PAGES` = 40 pages (§4)
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
- **DETAILS FILLED IN** — green bar, editable abstract textarea, keyword chips, "Confirm & Save"
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

> **Now split in two (errata #78).** `src/extractPdf.ts` keeps the Drive download and
> pdf.js; `src/pdfText.ts` (no pdf.js, tested by `node src/pdfText.check.ts`) holds
> `extractAbstractAndKeywords` and `extractFromPages`, which decides how far to read.
> Both "From this computer" and "From Google Drive" go through the same
> `extractFromBytes` → `extractFromPages`, so they read the same pages.
>
> **How far it reads.** Page 1, then page 2, and so on. After each page the text so far
> is searched. `extractAbstractAndKeywords` only returns an abstract once the heading that
> *ends* it (Keywords, Introduction, Chapter 1, …) has been read, so "found" also means
> "its end is known". Then **one more page** is read, because the Keywords line is
> sometimes at the top of the next page, and reading stops. With no abstract it goes on
> to `MAX_PAGES` = 40 (or the last page), so a long thesis with no abstract costs 40
> pages, never 2,000. A thesis with the abstract on page 5 stops at page 6 or 7.
>
> **Scanned PDFs.** Fewer than 50 letters in the **first 15 pages** (`SCAN_CHECK_PAGES`)
> and no abstract → "probably scanned", the same window as before the cap went up. A
> scanned PDF that prints only a page number on each page has 21 letters in 15 pages
> but 71 in 40, so counting all 40 would have stopped calling it scanned.
>
> The listing below is the original step-06 version; read the two files for the
> current code.

```typescript
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/** Browser key from §0. Restricted to our domains and the Drive API; safe to commit. */
const DRIVE_API_KEY = "REPLACE_WITH_KEY_FROM_A";

/** Theses often put the abstract after the title page, approval sheet and
 *  acknowledgements, so 4 pages can miss it. Tune against real ISU PDFs (§8). */
const MAX_PAGES = 40;   // a cap, not a fixed read: was 8, then 15 — §8 third round

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
      "This file is protected, so it can't be read from Google Drive. Choose the PDF from this computer instead.",
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
  // Length-bounded (40–4000 chars) so a missing terminator cannot run away.
  // Terminators must START A LINE: with /i, a bare \bBACKGROUND\b also matches
  // "against a background of…" mid-abstract and cuts the abstract short.
  // Most must also END the line (after an optional "2"/"1."/"I." number and a
  // trailing page number): a wrapped line can begin "introduction of hybrid
  // lines…" or "contents of nitrogen…". Only KEYWORDS, CHAPTER 1 and TABLE OF
  // CONTENTS may run on, as in "Keywords: rice, soil".
  const sectionEnd = String.raw`(?:(?:\d+|[IVX]+)\.?\s+)?(?:INTRODUCTION|BACKGROUND|CONTENTS|ACKNOWLEDG\w*|DEDICATION|DECLARATION|LIST\s+OF\s+(?:FIGURES|TABLES)|APPROVAL\s+SHEET|BIOGRAPHICAL\s+SKETCH|CERTIFICATION)[ \t]*(?:[ivxlc\d]+[ \t]*)?\n`;
  const abstractRe = new RegExp(
    String.raw`\bABSTRACT\b[ \t]*([^\n]*)\n?([\s\S]{40,4000}?)(?=\n\s*(?:KEY\s?WORDS?|CHAPTER\s+(?:1|I|ONE)\b|TABLE\s+OF\s+CONTENTS|${sectionEnd}))`,
    "gi",
  );
  let abstract = "";
  for (let m; (m = abstractRe.exec(flat)); ) {
    // Skip table-of-contents entries such as "ABSTRACT ........ 3" or "Abstract v":
    // in a thesis the contents page often comes before the abstract itself.
    // Resume just past this heading, or the skipped match swallows the real one.
    // A page number may have spaces inside: "x i", "1 2" (errata #78).
    if (/^(?:[\s.]*\.{3}|(?:\.\s){3}|[ivxlc](?:\s*[ivxlc])*\s*$|\d(?:\s*\d)*\s*$)/i.test(m[1])) {
      abstractRe.lastIndex = m.index + "ABSTRACT".length;
      continue;
    }
    abstract = `${m[1].replace(/^[:.\-\u2013\u2014]\s*/, "")}\n${m[2]}`
      .replace(/\s+/g, " ")
      .trim()
      // Drop the page number printed under the abstract: "(iv)", "| 4", "- 5 -".
      .replace(/([.!?)\]"\u201d])\s+[|\-\u2013\u2014]?\s*\(?(?:[ivxlc]+|\d{1,4})\)?\s*[|\-\u2013\u2014]?$/i, "$1");
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
garbage. **But a keyword list can wrap** (errata #78 round 2: 13 of 30 real theses), so
the lines it wraps onto are joined, with strict limits: the first next line only when
the list ends in `,` `;` `&` "and" "or", or that line has commas or semicolons itself,
or it is a short ending like "advancement."; after that only while the list still ends
in a separator; at most 3 lines; never an empty line, a heading (CHAPTER,
INTRODUCTION, …), a running header, or a line whose parts are longer than 6 words
(a sentence). A word broken at a hyphen ("socio-" / "economic") is joined without a
space, and "self - efficacy" becomes "self-efficacy".

**Match `KEY WORDS`.** `\bKEY\s?WORDS?\b` covers `KEYWORD`, `KEYWORDS`, `KEY WORD`
and `KEY WORDS`, in any case. The spaced spelling is common in real theses. Do not
"simplify" the pattern to `KEYWORDS?`, which never matches it.

**Length-bound the abstract.** The non-greedy `+?` still needs a terminator. The
`{40,4000}` guard stops a missing terminator from swallowing the whole document — the
match then **fails** and the abstract is empty (manual entry), it is not truncated. So
the terminator list has to cover what really follows an abstract: in the six real
theses of §8 that was `Contents`, `Acknowledgements` and a numbered `2 Introduction`,
none of which the first version listed. 4000, not 3000, because one-page thesis
abstracts reach ~2,200 characters.

**Most terminators must be the whole line.** Starting a line is not enough: a wrapped
sentence can put "introduction of hybrid lines…" or "contents of nitrogen…" at the
start of a line. Only `KEYWORDS`, `CHAPTER 1` and `TABLE OF CONTENTS` may run on
("Keywords: rice, soil"); the rest must end the line, allowing a section number before
("2 Introduction", "I. INTRODUCTION") and a page number after.

**Skip the table of contents.** Theses often print the contents page *before* the
abstract, so the first `ABSTRACT` in the text is the entry `Abstract ........ v`. A
heading line that is only dot leaders or a page number is skipped (also a number
printed with a space inside, "ABSTRACT x i" for xi or "1 2" for 12 — DANDO 2022), and
the search resumes just past it — a plain `matchAll` would let the skipped match swallow the real
heading.

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

> **Superseded on 2026-10-12 (errata #50).** The review step was removed on
> the professor's request: every saved study is `POSTED`, and `ARCHIVED`,
> `NEEDS_REVIEW`, `DRAFT`, `isPending()`, `STATUSES`, the status filter and
> "Mark as Archived" no longer exist. Text below that mentions them is history.
> The current rules are in `00-AI-PREAMBLE.md` ("Status — one value"). Both buttons now post (`POSTED`), and "Save Manually" requires an
> abstract.

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

- Submit is always clickable; clicking with something missing shows exactly what
  (a disabled button gave no reason — staff who had chosen a local PDF could not
  tell that the Drive link was still required)
- Validate before downloading — `validateDriveLink` returns a message, show it
- Show a word count under the abstract (the prototype already does)
- Keywords are chips: staff can remove one with X, and add one by typing + Enter.
  Keep both.

---

## 7. Sharing, CORS and large files

The download goes through the Drive API (§0), which allows browser requests.
It only works for files shared as **"Anyone with the link → Viewer"**: a
restricted file returns 403 and §4 reports it as protected. Reading
private files would need each staff member to grant Drive access via OAuth — out
of scope.

**Protected files (professor's feedback, 2026-10-12).** Students read the whole
study in Google's view-only viewer but must not download it, so each study PDF
is shared as **Isabela State University → Viewer** with "People who can
download, copy, print" set to **Editors** (checklist in `08` §7b). Such
no-download (and Restricted) files **cannot be read through the Drive API**, so
for them the 403 message is:
"This file is protected, so it can't be read from Google Drive. Choose the PDF
from this computer instead." Choosing the PDF from this computer is therefore
the **normal** path; the Drive download is still tried when no PDF is chosen,
and works for files that are not protected.

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

**Main source: a PDF from this computer (added 2026-10-04 as a backup; the main path since
2026-10-12).** Above the Drive link, **"Choose PDF from this computer"** lets staff pick the
study PDF from their own laptop; `extractFromFile()` hands it to the same pdf.js + regex
pipeline, so no Drive download happens and neither a Drive block nor a protected file can stop
auto-fill. The Drive link is still required and saved — it is what students open ("Read full
study", view-only) and what staff open ("Open in Drive"). Files over 100 MB or not ending in
`.pdf` are refused.

**Back and Edit details.** The form has **"← Back to dashboard"**; the review screen has
**"← Edit details"**, which returns to the form with every field kept. Continuing again with the
same link/file does not re-read the PDF when the last read succeeded, so edits to the abstract
and keywords survive and Drive is not asked for the same file twice. If the last read failed
(e.g. Drive busy), it tries again but keeps anything typed in the meantime.

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
each abstract actually starts. Reading stops by itself after the abstract; `MAX_PAGES`
(40) is only the cap for a PDF with no abstract.

- [ ] The §0 day-1 spike printed `200 application/pdf` from `localhost:8443`

- [ ] A real text-based thesis PDF → PROCESSING → DETAILS FILLED IN
- [ ] Abstract and keywords come from the actual PDF text
- [ ] Keyword chips contain **only keywords** — no page 2–4 text bleeding in
- [ ] A PDF that writes `KEY WORDS:` with a space parses correctly
- [ ] Staff can edit the abstract and add/remove keyword chips
- [ ] "Confirm & Save" writes a document with `status: "POSTED"`
- [ ] A scanned/image-only PDF → NEEDS MANUAL ENTRY, empty fields; "Save Manually"
      refuses an empty abstract, then posts once one is typed (`status: "POSTED"`)
- [ ] An abstract containing the word "background" or "introduction" mid-text is
      **not** cut short
- [ ] A view-only study file (ISU → Viewer, download limited to Editors) shows "This file is protected, so it can't be
      read from Google Drive. Choose the PDF from this computer instead."
- [ ] Choosing that same PDF from this computer fills in the abstract and keywords
- [ ] `grep -rn "drive.usercontent" src/` returns nothing
- [ ] A garbage link shows a specific error message and does not crash
- [ ] A non-Drive URL is rejected before any download starts
- [ ] `grep -rn "MOCK_ABSTRACT\|Math.random" src/` returns nothing
- [ ] `npm run build` passes

### Results — 2026-10-05

No ISU thesis PDFs were available online (the ISU library and other Philippine
repositories need a login or show a bot check, which must not be bypassed), so six real
bachelor's/undergraduate theses from arXiv were used, read from disk with the same
`extractAbstractAndKeywords` and `MAX_PAGES` as the app:

| Thesis (arXiv) | Pages | Abstract heading on page | Before fix | After fix |
|---|---|---|---|---|
| 1511.07101 — CAPM risk–return (finance) | 50 | 2 (contents entry first) | contents dot leaders | ✓ 1,191 chars |
| 1908.10714 — neural architecture design | 58 | 3 | nothing (→ manual) | ✓ 1,191 chars |
| 1911.09518 — video copy detection | 56 | 3 | ✓, ended in page number "(iv)" | ✓ 1,310 chars |
| 1912.00337 — DC servo motor control (NIT Silchar) | 138 | 5 | nothing (→ manual) | ✓ 2,139 chars |
| 2309.15869 — Vietnamese speech recognition | 70 | 3 (contents entry first) | nothing (→ manual) | ✓ 1,517 chars |
| 2501.02203 — AWS IAM (Seoul National Univ.) | 25 | 2 | ✓ + 4 keywords | ✓ + 4 keywords |

The abstract started on page 2–5 in every case. (The second round below found one
on page 11, so `MAX_PAGES` is now 15.)

Text-level cases for an ISU-style layout (approval sheet, acknowledgment, contents entry
`Abstract ........ v`, then `ABSTRACT` and `KEY WORDS:`), "background" / "introduction"
/ "contents" starting a wrapped line, `1. INTRODUCTION`, `DEDICATION` after the abstract,
and an abstract ending in "Region II": 3 of 7 passed before the fix, 7 of 7 after.

**How these were checked:** by a script that runs the app's own `extractPdf.ts` on
PDFs read from disk — not through the app's Register screen.

### Results — second round, 2026-10-05

Four more real bachelor's theses from arXiv (no Philippine repository could be used:
DLSU's Animo Repository is behind a bot check, which must not be bypassed). Same method:
the app's own `extractPdf.ts`, only the pdf.js import swapped for its Node build.

| Thesis (arXiv) | Pages | Abstract on page | Before this round | After |
|---|---|---|---|---|
| 1407.7143 — VIT B.Tech project report (India) | 65 | **11** (contents entry `Abstract ix` on p. 5) | nothing (→ manual): only 8 pages read | ✓ 1,933 chars |
| 1906.06254 — Nazarbayev Univ. bachelor's | 43 | 5 | abstract preceded by "Physics Department … by Khalykbek Yelshibekov" | ✓ 533 chars, header block dropped |
| 1604.01830 — WiggleZ undergraduate thesis | 6 | 5 | ended in "v vi Abstract" (page no. + blank page's running header) | ✓ 1,289 chars |
| 1211.0689 — Invenio bachelor's thesis | 70 | 3 | English abstract + German *Zusammenfassung* on the same page, both kept | unchanged — known limitation |

Changes from this round, all in `extractAbstractAndKeywords` / `MAX_PAGES`:

- `MAX_PAGES` 8 → 15: a real project report put the abstract on page 11, behind a
  certificate, acknowledgement, contents, lists of tables/figures and abbreviations.
- A **header block** at the top of the abstract page is dropped: "Label: value" lines
  (`Title:`, `Researcher(s):`, `Adviser:`, `Degree:` … — the usual Philippine layout)
  or a short run of department / degree / title / "by Author" lines. Text on the heading
  line itself ("ABSTRACT: This study…") is never treated as a header, and if less than
  150 characters would remain the block is kept.
- **Trailing page furniture** is removed repeatedly: page numbers ("v", "(iv)", "| 4")
  and a blank back page's running header ("vi Abstract").
- `ABSTRAK` and `BUOD` (a Filipino-language abstract after the English one) end the
  English abstract.

Text-level regression cases, 11 of 11 pass: Philippine "Title / Researcher / Adviser"
header (also with a title wrapping onto two lines), English then `ABSTRAK`, text on the
heading line, contents entry before the real abstract, mid-abstract "background", a short
two-line abstract that must not be mistaken for a header, a trailing "(iv)", and an
abstract ending "Region II." / "Region II" (must be kept) or "Region II." followed by
page number "v".

**Known limitation:** a page with the abstract in two languages and no Filipino/English
heading between them (Invenio: English, then the German version) keeps both. Staff trim
it in the editable abstract box before saving.

Only one of the first six PDFs had a keywords line. Its `identity and access management`
became two chips (`identity`, `access management`) because keywords are also split on
"and"; staff can fix that in the review step.

### Results — third round, 2026-11-08 (errata #78)

30 real theses (mostly UP Open University; the two Geneston-Dino files are the same
file). Same method: the app's own `extractPdf.ts` through `extractFromFile` ("From this
computer"), only the pdf.js import swapped for its Node build; pages read counted by
wrapping `getPage`; time is the middle of 3 runs in Node (no download).

Two problems with the old fixed 15 pages:

- **2025 CALAMLAM** (138 pages): front matter to page xvii, abstract heading on page 17
  → "Could not find an abstract or keywords". Now found (1,599 characters), 19 pages read.
  The PDF has no Keywords line anywhere, so no keywords.
- **DANDO 2022** (150 pages): the contents line is "ABSTRACT x i" (xi with a space), not
  skipped, so the **contents page** was filled in as the abstract ("x i CHAPTER I:
  INTRODUCTION 1 Background of the Study 1 …"). Now the real abstract on page 11
  (1,249 characters), same 2 keywords, 12 pages read.

| PDF | Pages | Abstract on page | Pages read before → after | Result |
|---|---|---|---|---|
| 2025 CALAMLAM | 138 | 17 | 15 → 19 | nothing → ✓ found |
| ALFONSO 2024 | 74 | 13 | 15 → 14 | same |
| ANTOLIN 2023 | 138 | 11 | 15 → 13 | same |
| ARCANGEL 2025 | 155 | 8 | 15 → 10 | same |
| ASUNCION 2020 | 135 | 12 | 15 → 15 | same |
| CALIMLIM 2024 | 117 | 13 | 15 → 15 | same |
| CAMACHO_HG 2026 | 77 | 11 | 15 → 12 | same |
| CLARO-AZUCENA 2022 | 136 | none (no abstract or keywords on any of the 136 pages) | 15 → 40 | same: "Please type them in" (since errata #80: "Please type or paste the abstract."; keywords then come from it) |
| CRUZ 2026 | 112 | 5 | 15 → 7 | same |
| DANDO 2022 | 150 | 11 | 15 → 12 | contents page → ✓ real abstract |
| DELA PENA 2023 | 156 | 12 | 15 → 14 | same |
| DIMAANO 2024 | 39 | 12 | 15 → 13 | same |
| FULLEROS-2025 | 82 | 10 | 15 → 11 | same |
| GARCES 2024 | 118 | 7 | 15 → 9 | same |
| GESULGA 2025 | 53 | 10 | 15 → 11 | same |
| GREGORIO 2022 | 2,613 | 12 | 15 → 14 | same (128 → 117 ms) |
| Geneston-Dino (2 copies) | 104 | 13 | 15 → 15 | same |
| JACA-2022 | 48 | 8 | 15 → 10 | same |
| LACAP 2024 | 50 | 9 | 15 → 11 | same |
| NAVARRO 2023 | 78 | 10 | 15 → 12 | same |
| NGOJO 2025 | 180 | 12 | 15 → 14 | same |
| PANES 2025 | 57 | 8 | 15 → 9 | same |
| POCAAN-2021 | 77 | 5 | 15 → 8 | same |
| SUBABA 2024 | 97 | 12 | 15 → 14 | same |
| TAN-2020 | 97 | 11 | 15 → 15 | same |
| TARUC 2024 | 98 | 11 | 15 → 12 | same |
| VIZCARA-2022 | 58 | 12 | 15 → 14 | same |
| [Espan_a] R&DM 300 | 156 | 7 | 15 → 9 | same |
| [N300] Caraan | 96 | 8 | 15 → 9 | same |

"Same" means the same abstract and keywords, character for character. For all 30, a
full 40-page read gives the same result as the early stop. Time per PDF 43–217 ms (was
78–191 ms); the longest after is CALAMLAM, which now reads 19 pages, and CLARO-AZUCENA,
which reads 40 (176 ms).

**Not tested here:** "From Google Drive" with a real download (it uses the same
`extractFromBytes`, but the key only works from our sites) and a read in the browser.

#### Review round 2, 2026-11-08 — the end of the abstract and the keyword lines

Same 30 PDFs, same method. Three fixes in `pdfText.ts`:

- **Running header / page number at the end of the abstract.** Five abstracts ended in
  page furniture: the study's short title with a page number, printed under the
  abstract or at the top of the next page (ASUNCION 2020, LACAP 2024, NGOJO 2025, and
  TAN-2020 twice: a blank page's header, then the next page's), or "Page 8" (JACA-2022).
  A trailing line is dropped when its words, with a page number, are on **at least two
  lines** of the text read (so it is repeated from page to page) and what is left ends
  a sentence. "Page N" joins the trailing page marks. All five now end on their last
  sentence.
- **Wrapped keyword lines** (rules in §4 "Bound the keyword capture"). 13 theses
  had a cut list, not 3: ALFONSO ("food" → "food security" + 5 more), ANTOLIN, ARCANGEL,
  CALIMLIM, CAMACHO_HG, DELA PENA, FULLEROS, GARCES, Geneston-Dino, LACAP, PANES,
  TARUC, [Espan_a]. All now give the whole printed list.
- **"self - efficacy" → "self-efficacy"** in keywords (a hyphen with a space on both
  sides, between letters; "pre- or post-test" and "2019 - 2024" are kept).

18 of 30 changed (5 abstracts, 14 keyword lists, LACAP both), all to what the PDF
prints; the other 12 are the same character for character, and no page count changed.
Time per PDF 36–209 ms (round 1: 43–217). A first version of the header rule was slow
on long lines (201 ms of text rules on CLARO-AZUCENA's 40 pages); it now reads the
page number from the end of the line and counts headers only when needed (15 ms).

**Known limit:** a running header in the **middle** of an abstract that runs over two
pages is kept (ASUNCION, CALIMLIM, TAN, VIZCARA: e.g. "… Care Nurses xiii The study
showed …"). Staff can delete it in the abstract box; a later round could drop it with
the same repeated-header test.

---

**Next:** `07-combined-summary.md`, then `08-deployment.md`.
