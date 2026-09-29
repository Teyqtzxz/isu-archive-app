# 06 — PDF Auto-Extraction

**Status:** ☐ TODO
**Owner:** C · **Depends on:** 04 · **Next:** 07 or 08

**Prompt to your AI:**
> *"Follow `00-AI-PREAMBLE.md` first, then implement this file. Install pdfjs-dist,
> create `src/extractPdf.ts` using the code below, and wire it into `RegisterForm`,
> replacing the existing setTimeout mock. Preserve the three processing states.
> Do not start step 07."*

---

## 1. The feature

Staff paste a Google Drive share link and click Submit. The app then:

1. Downloads the PDF **in the browser** — no server
2. Reads text from the **first 4 pages only**
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
and replace it with §6 below. `grep -n "MOCK_ABSTRACT\|Math.random" src/` must
return nothing when you are done.

---

## 3. Install

```bash
npm install pdfjs-dist
```

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

const MAX_PAGES = 4;

/** Accepts /file/d/{id}/view · /file/d/{id} · ?id={id} · /open?id={id} */
export function driveLinkToFileUrl(link: string): string | null {
  const m = link.match(/(?:file\/d\/|[?&]id=)([-\w]{25,})/);
  if (!m) return null;
  return `https://drive.usercontent.google.com/download?id=${m[1]}&export=download`;
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

  // Fetch first so we can detect Drive's HTML interstitial with a clear message
  // instead of an InvalidPDFException from pdf.js.
  const res = await fetch(fileUrl, { redirect: "follow" });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("pdf")) {
    throw new Error(
      "Google returned a warning page instead of the PDF. Check the file is shared as 'Anyone with the link'.",
    );
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
  const abstractMatch = flat.match(
    /\bABSTRACT\b\s*[:.\-\u2013\u2014]?\s*([\s\S]{40,3000}?)(?=\b(?:KEY\s?WORDS?|INTRODUCTI?ON|CHAPTER\s+1|BACKGROUND)\b)/i,
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

### Four things in there that are easy to get wrong

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

Pass it to `saveThesis()` from `data.ts`. Do not hardcode it in the save function.

---

## 6. Validation and UX

- Disable Submit until the link is non-empty
- Validate before downloading — `validateDriveLink` returns a message, show it
- Show a word count under the abstract (the prototype already does)
- Keywords are chips: staff can remove one with X, and add one by typing + Enter.
  Keep both.

---

## 7. CORS and the large-file interstitial

`getDocument` fetches from Google Drive in the browser, which works for files
shared as **"Anyone with the link → Viewer"**. Restricted or commenter-only links
403 from the browser and there is no way around it without the Drive API.

For files above ~100 MB, or ones Google chooses to virus-scan, Drive returns an
**HTML warning page** rather than the PDF. The `content-type` check in §4 catches
this and reports it as a sharing problem.

If extraction fails for any reason, the `needs_review` state handles it. Rehearse
that path in your demo too — it is part of the design, and "what happens when the
PDF is scanned?" is a question you should be able to answer while clicking through
the app.

---

## 8. Verification

Test against **real PDFs**, not ones you imagine. Take 3–4 actual thesis PDFs
shared as "Anyone with the link", and paste the extracted text into a scratch
script to inspect it before trusting it in the form.

- [ ] A real text-based thesis PDF → PROCESSING → READY TO REVIEW
- [ ] Abstract and keywords come from the actual PDF text
- [ ] Keyword chips contain **only keywords** — no page 2–4 text bleeding in
- [ ] A PDF that writes `KEY WORDS:` with a space parses correctly
- [ ] Staff can edit the abstract and add/remove keyword chips
- [ ] "Confirm & Save" writes a document with `status: "ARCHIVED"`
- [ ] A scanned/image-only PDF → NEEDS MANUAL ENTRY, empty fields, "Save Manually" works
- [ ] "Save Manually" writes a document with `status: "NEEDS_REVIEW"`
- [ ] A garbage link shows a specific error message and does not crash
- [ ] A non-Drive URL is rejected before any download starts
- [ ] `grep -rn "MOCK_ABSTRACT\|Math.random" src/` returns nothing
- [ ] `npm run build` passes

---

**Next:** `07-combined-summary.md`, then `08-deployment.md`.
