// Examples for theme.ts, and checks on the dark palette in index.css. Run with:
//   node src/theme.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import { readFileSync } from "node:fs";
import { parseChoice, resolveTheme, toggledChoice } from "./theme.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got:  ${String(got)}\n      want: ${String(want)}`}`);
}

console.log("— Saved choice —");
check("nothing saved → system", parseChoice(null), "system");
check("light", parseChoice("light"), "light");
check("dark", parseChoice("dark"), "dark");
check("system", parseChoice("system"), "system");
check("unknown value → system", parseChoice("DARK"), "system");

console.log("— What the screen shows —");
check("system on a dark device", resolveTheme("system", true), "dark");
check("system on a light device", resolveTheme("system", false), "light");
check("light on a dark device", resolveTheme("light", true), "light");
check("dark on a light device", resolveTheme("dark", false), "dark");

console.log("— Header button —");
check("dark → light", toggledChoice("dark"), "light");
check("light → dark", toggledChoice("light"), "dark");

// ─── index.css ─────────────────────────────────────────────────────────────
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

/** The custom properties declared directly inside the block that opens at `selector {`. */
function tokensOf(selector: string): Map<string, string> {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error(`index.css: no block "${selector}"`);
  const body = css.slice(start + selector.length + 2, css.indexOf("}", start));
  const map = new Map<string, string>();
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
}
const light = tokensOf(":root");
const dark = tokensOf(':root[data-theme="dark"]');
const system = tokensOf(':root:not([data-theme="light"]):not([data-theme="dark"])');

console.log("— Dark blocks —");
check("System (device dark) block = Dark block",
  JSON.stringify([...system]), JSON.stringify([...dark]));
check("every dark token also has a light value",
  [...dark.keys()].filter(k => !light.has(k)).join(", "), "");
check("ISU brand tokens are not changed in dark",
  [...dark.keys()].filter(k => k.startsWith("--isu-") || k.startsWith("--gray-")).join(", "), "");

// ─── Contrast (WCAG 2.1, AA = 4.5:1 for normal text) ───────────────────────
type RGB = [number, number, number];
function resolve(value: string, depth = 0): string {
  const m = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (!m || depth > 5) return value;
  return resolve(dark.get(m[1]) ?? light.get(m[1]) ?? value, depth + 1);
}
/** A colour token as RGB; a see-through one is blended over `under`. */
function rgbOf(token: string, under?: RGB): RGB {
  const v = token.startsWith("--") ? resolve(`var(${token})`) : token;
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)) as RGB;
  const rgba = v.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba && under) {
    const a = Number(rgba[4]);
    return [1, 2, 3].map((i, j) => Math.round(Number(rgba[i]) * a + under[j] * (1 - a))) as RGB;
  }
  throw new Error(`cannot read colour ${token} = ${v}`);
}
function luminance([r, g, b]: RGB): number {
  const c = [r, g, b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(fg: string, bg: string, base = "--surface"): number {
  const back = rgbOf(bg, rgbOf(base));
  const [a, b] = [luminance(rgbOf(fg, back)), luminance(back)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// [text, background, where] — every text colour on every background it sits on.
const PAIRS: [string, string, string][] = [
  ["--text", "--page-bg", "page headings"],
  ["--text", "--surface", "card text"],
  ["--text", "--surface-raised", "menu item hover"],
  ["--text-body", "--surface", "body text, abstracts, summary"],
  ["--text-body", "--surface-hover", "abstract preview, sources box"],
  ["--text-body", "--input-bg", "typed text in inputs"],
  ["--text-body", "--warn-soft", "summary key terms"],
  ["--text-body", "--highlight-bg", "query word highlight"],
  ["--text-secondary", "--surface", "secondary text"],
  ["--text-secondary", "--surface-raised", "info pill, keyword minis"],
  ["--text-secondary", "--fill-muted", "theme picker, role chip"],
  ["--text-muted", "--page-bg", "results count, page foot"],
  ["--text-muted", "--surface", "meta lines, labels"],
  ["--text-muted", "--surface-raised", "muted on raised"],
  ["--text-muted", "--fill-muted", "overlap label"],
  ["--text-subtle", "--surface", "optional label, empty detail"],
  ["--text-subtle", "--input-bg", "placeholders"],
  ["--text-subtle", "--page-bg", "login footer"],
  ["--text-subtle", "--fill-muted", "step still to do"],
  ["--accent", "--surface", "links, green text"],
  ["--accent", "--page-bg", "green text on the page"],
  ["--accent", "--accent-soft", "chips, score pill, banners"],
  ["--accent", "--surface-hover", "links in the preview"],
  ["--on-fill", "--accent-fill", "green buttons"],
  ["--on-fill", "--accent-fill-hover", "green buttons, hover"],
  ["--on-fill", "--header-bg", "header text"],
  ["--on-fill", "--hero-to", "student hero text"],
  ["rgba(255, 255, 255, 0.68)", "--header-bg", "header subtitle"],
  ["rgba(255, 255, 255, 0.72)", "--header-bg", "staff tabs, search placeholder"],
  ["--tab-active", "--header-bg", "active tab underline (graphic, 3:1)"],
  ["--title-text", "--surface", "study titles"],
  ["--title-text", "--badge-bg", "outline-blue button hover"],
  ["--badge-text", "--badge-bg", "department badge"],
  ["--warn-text", "--warn-soft", "keyword chips, review bar"],
  ["--danger", "--surface", "red text and links"],
  ["--danger", "--danger-soft", "red text on hover"],
  ["--error-text", "--danger-soft", "error boxes"],
  ["--error-text", "--surface", "field errors"],
  ["--on-fill", "--danger-fill", "danger button"],
  ["--on-fill", "--danger-fill-hover", "danger button, hover"],
  ["--toast-text", "--toast-bg", "toast"],
  ["--isu-yellow-ink", "--isu-yellow", "yellow button, student avatar"],
  ["--on-fill", "--isu-blue", "role chip, staff avatar"],
];

console.log("— Dark contrast (AA 4.5:1; the tab underline is a graphic, 3:1) —");
for (const [fg, bg, where] of PAIRS) {
  const r = ratio(fg, bg, bg === "--header-bg" || bg === "--hero-to" ? bg : "--surface");
  const need = where.includes("graphic") ? 3 : 4.5;
  const ok = r >= need;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2)}:1  ${fg} on ${bg} — ${where}`);
}

console.log(failed ? `\n${failed} FAILED.` : "\nAll passed.");
if (failed) process.exitCode = 1;
