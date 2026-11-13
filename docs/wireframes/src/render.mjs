// Renders docs/wireframes/src/wireframes.html into one PNG per sheet
// (docs/wireframes/NN-name.png) and one PDF with every sheet
// (docs/wireframes/ISU-E-Library-Wireframes.pdf).
// Needs only Node 22+ (built-in WebSocket) and Google Chrome or Microsoft Edge.
// Usage: node docs/wireframes/src/render.mjs [path-to-chrome]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..");
const page = pathToFileURL(join(here, "wireframes.html")).href;
const candidates = [
  process.argv[2],
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) throw new Error("Chrome or Edge not found; pass its path as the first argument.");

const profile = mkdtempSync(join(tmpdir(), "wf-"));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(browser, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === "page");
  } catch {}
}
if (!target) throw new Error("Browser did not start.");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const waiting = new Map();
const events = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    const { ok, no } = waiting.get(m.id);
    waiting.delete(m.id);
    m.error ? no(new Error(m.error.message)) : ok(m.result);
  } else if (m.method) events.push(m.method);
});
const send = (method, params = {}) => new Promise((ok, no) => { const id = ++seq; waiting.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const open = async (url) => {
  events.length = 0;
  await send("Page.navigate", { url });
  for (let i = 0; i < 100 && !events.includes("Page.loadEventFired"); i++) await sleep(50);
  await evalJs("document.fonts.ready.then(() => true)");
};

await send("Page.enable");
await send("Runtime.enable");
await open(page);
const frames = await evalJs("window.FRAMES");
const slug = (s) => s.toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const made = [];
for (const f of frames) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false });
  await open(`${page}?f=${encodeURIComponent(f.id)}`);
  const r = await evalJs(`(() => { const b = document.querySelector('.sheet').getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: Math.ceil(b.width), h: Math.ceil(b.height) }; })()`);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  const file = `${f.id}-${slug(f.name)}.png`;
  writeFileSync(join(outDir, file), Buffer.from(shot.data, "base64"));
  made.push({ ...f, file, w: r.w, h: r.h });
  console.log(file, `${r.w}x${r.h}`);
}

// PDF: a cover page, then one page per PNG, each page the size of its image.
const pages = made.map((m, i) => `@page p${i}{size:${m.w}px ${m.h}px;margin:0} .p${i}{page:p${i}}`).join("\n");
const rows = made.map((m) => `<tr><td>${m.id}</td><td>${m.name}</td></tr>`).join("");
const html = `<!doctype html><meta charset="utf-8"><style>@page cover{size:1100px 1400px;margin:0}.cover{page:cover;padding:90px;font-family:Arial,sans-serif;height:1400px;box-sizing:border-box}${pages}
body{margin:0} img{display:block} .pg{break-after:page} h1{font-size:44px;margin:0 0 8px} h2{font-weight:400;color:#555;margin:0 0 40px} table{border-collapse:collapse;font-size:17px} td{padding:5px 18px 5px 0;border-bottom:1px solid #ddd}</style>
<div class="cover pg"><h1>ISU Research Study E-Library</h1><h2>Wireframes (low fidelity) · Deliverable 3 · Isabela State University – Echague Campus</h2><p style="font-size:17px;max-width:880px">One wireframe for each frame of the clickable Figma prototype, with the same numbers and names. Grayscale on purpose: they show layout, content and navigation, not colours. Every name, title and number is made up. Under each wireframe: what each click opens and the SRS requirements the screen covers.</p><table>${rows}</table></div>
${made.map((m, i) => `<div class="pg p${i}"><img src="${pathToFileURL(join(outDir, m.file)).href}" width="${m.w}" height="${m.h}"></div>`).join("")}`;
const tmpHtml = join(profile, "all.html");
writeFileSync(tmpHtml, html);
await open(pathToFileURL(tmpHtml).href);
const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
writeFileSync(join(outDir, "ISU-E-Library-Wireframes.pdf"), Buffer.from(pdf.data, "base64"));
console.log("ISU-E-Library-Wireframes.pdf", made.length, "wireframes");

ws.close();
proc.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
