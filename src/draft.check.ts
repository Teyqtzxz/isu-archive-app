// Examples for draft.ts (unsaved Register / Edit drafts, the remembered staff
// tab). Run with:
//   node src/draft.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import {
  STAFF_VIEW_KEY, clearAllDrafts, clearDraft, draftKey, editViewId, parseDraft, parseStaffView, readDraft,
  readStaffView, sameAsStart, saveStaffView, writeDraft, type DraftFields, type RegisterDraft,
} from "./draft.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got:  ${String(got)}\n      want: ${String(want)}`}`);
}

/** A Map pretending to be sessionStorage. */
function fakeStore() {
  const m = new Map<string, string>();
  const s = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return { m, store: () => s };
}
/** Storage blocked: every access throws, as in a locked-down browser. */
const blocked = () => { throw new Error("SecurityError: storage is blocked"); };

const blank: DraftFields = {
  form: { driveLink: "", title: "", department: "", year: "2026", adviser: "" },
  authors: [], newAuthor: "", abstract: "", keywords: [], newKw: "",
};
const draft: RegisterDraft = {
  v: 1, uid: "uid-A", studyId: null,
  form: { driveLink: "https://drive.google.com/file/d/abc/view", title: "Rice yield", department: "Agriculture", year: "2025", adviser: "Dr. Maria Santos" },
  authors: ["Juan Dela Cruz"], newAuthor: "Ana Re", abstract: "This study…", keywords: ["rice"], newKw: "soi",
  step: "save", readState: "success", keptCurrent: false, readError: "",
  lastRead: { source: "file:study.pdf:1234:99", ok: true }, pdfName: "", baseUpdatedAt: "",
};
const raw = JSON.stringify(draft);
const want = { uid: "uid-A", studyId: null };
const edit = (o: Record<string, unknown>) => JSON.stringify({ ...draft, ...o });

console.log("— Stored draft is read back —");
const back = parseDraft(raw, want);
check("round trip: title", back?.form.title, "Rice yield");
check("round trip: department", back?.form.department, "Agriculture");
check("round trip: authors", back?.authors.join("|"), "Juan Dela Cruz");
check("round trip: typed, not yet added", back?.newAuthor, "Ana Re");
check("round trip: abstract", back?.abstract, "This study…");
check("round trip: step", back?.step, "save");
check("round trip: lastRead ok", back?.lastRead?.ok, true);
check("details step with no read state", parseDraft(edit({ step: "details", readState: null }), want)?.step, "details");
check("lastRead may be null", parseDraft(edit({ lastRead: null }), want)?.lastRead, null);

console.log("— Ignored drafts —");
check("nothing stored", parseDraft(null, want), null);
check("empty string", parseDraft("", want), null);
check("bad JSON", parseDraft("{not json", want), null);
check("JSON null", parseDraft("null", want), null);
check("a number", parseDraft("42", want), null);
check("old version", parseDraft(edit({ v: 0 }), want), null);
check("future version", parseDraft(edit({ v: 2 }), want), null);
check("another account (uid)", parseDraft(raw, { uid: "uid-B", studyId: null }), null);
check("no signed-in uid", parseDraft(raw, { uid: "", studyId: null }), null);
check("Register draft is not an Edit draft", parseDraft(raw, { uid: "uid-A", studyId: "s1" }), null);
check("another study's Edit draft", parseDraft(edit({ studyId: "s2" }), { uid: "uid-A", studyId: "s1" }), null);
check("same study's Edit draft", parseDraft(edit({ studyId: "s1" }), { uid: "uid-A", studyId: "s1" })?.studyId, "s1");
check("missing form", parseDraft(edit({ form: undefined }), want), null);
check("title not a string", parseDraft(edit({ form: { ...draft.form, title: 7 } }), want), null);
check("authors not a list", parseDraft(edit({ authors: "Juan" }), want), null);
check("a keyword not a string", parseDraft(edit({ keywords: ["rice", 3] }), want), null);
check("11 keywords (max 10)", parseDraft(edit({ keywords: Array.from({ length: 11 }, (_, i) => `k${i}`) }), want), null);
check("absurdly long abstract", parseDraft(edit({ abstract: "x".repeat(20001) }), want), null);
check("unknown step", parseDraft(edit({ step: "extracting" }), want), null);
check("save step without a read state", parseDraft(edit({ readState: null }), want), null);
check("details step with a read state", parseDraft(edit({ step: "details" }), want), null);
check("keptCurrent not a boolean", parseDraft(edit({ keptCurrent: "yes" }), want), null);
check("bad lastRead", parseDraft(edit({ lastRead: { source: 1, ok: true } }), want), null);
check("unknown department → blank", parseDraft(edit({ form: { ...draft.form, department: "CAS" } }), want)?.form.department, "");

console.log("— Changed or not (draft kept, \"Leave site?\") —");
check("blank form = start", sameAsStart(blank, blank), true);
check("a title typed", sameAsStart({ ...blank, form: { ...blank.form, title: "R" } }, blank), false);
check("year changed", sameAsStart({ ...blank, form: { ...blank.form, year: "2024" } }, blank), false);
check("an author added", sameAsStart({ ...blank, authors: ["Juan Dela Cruz"] }, blank), false);
check("an author typed, not added", sameAsStart({ ...blank, newAuthor: "J" }, blank), false);
check("a keyword typed, not added", sameAsStart({ ...blank, newKw: "s" }, blank), false);
check("typed then deleted again", sameAsStart({ ...blank, form: { ...blank.form, title: "" } }, blank), true);
const study: DraftFields = { ...draft, form: { ...draft.form } };
check("Edit: untouched study = start", sameAsStart({ ...draft, form: { ...draft.form } }, study), true);
check("Edit: authors reordered", sameAsStart({ ...draft, authors: ["B", "A"] }, { ...study, authors: ["A", "B"] }), false);
check("Edit: abstract edited", sameAsStart({ ...draft, abstract: "Changed" }, study), false);

console.log("— Remembered staff tab —");
const view = (o: Record<string, unknown>) => JSON.stringify({ v: 1, uid: "uid-A", view: "statistics", ...o });
check("a tab", parseStaffView(view({}), "uid-A"), "statistics");
check("search", parseStaffView(view({ view: "search" }), "uid-A"), "search");
check("edit a study", parseStaffView(view({ view: "edit:s1" }), "uid-A"), "edit:s1");
check("edit with no id", parseStaffView(view({ view: "edit:" }), "uid-A"), null);
check("unknown tab", parseStaffView(view({ view: "admin" }), "uid-A"), null);
check("another account", parseStaffView(view({}), "uid-B"), null);
check("old version", parseStaffView(view({ v: 0 }), "uid-A"), null);
check("bad JSON", parseStaffView("statistics", "uid-A"), null);
check("nothing stored", parseStaffView(null, "uid-A"), null);
check("editViewId", editViewId("edit:s1"), "s1");
check("editViewId of a tab", editViewId("register"), null);

console.log("— Storage (a fake sessionStorage) —");
const { m, store } = fakeStore();
writeDraft(draft, store);
writeDraft({ ...draft, studyId: "s1" }, store);
saveStaffView("uid-A", "register", store);
m.set("isu-theme", "dark");
check("Register key", draftKey(null), "isu-draft:new");
check("Edit key", draftKey("s1"), "isu-draft:edit:s1");
check("written and read back", readDraft("uid-A", null, store)?.form.title, "Rice yield");
check("another account reads nothing", readDraft("uid-B", null, store), null);
check("staff tab read back", readStaffView("uid-A", store), "register");
clearDraft(null, store);
check("Cancel / Save / Discard clears the Register draft", readDraft("uid-A", null, store), null);
check("… but not the Edit draft", readDraft("uid-A", "s1", store)?.studyId, "s1");
clearAllDrafts(store);
check("sign-out clears the Edit draft", m.has("isu-draft:edit:s1"), false);
check("sign-out clears the staff tab", m.has(STAFF_VIEW_KEY), false);
check("sign-out leaves other keys (the theme)", m.get("isu-theme"), "dark");
writeDraft({ ...draft, uid: "" }, store);
check("no uid → nothing written", m.has("isu-draft:new"), false);

console.log("— Storage blocked: the form works as before —");
check("read → no draft", readDraft("uid-A", null, blocked), null);
check("read tab → none", readStaffView("uid-A", blocked), null);
let threw = false;
try {
  writeDraft(draft, blocked); clearDraft(null, blocked); clearAllDrafts(blocked); saveStaffView("uid-A", "register", blocked);
} catch {
  threw = true;
}
check("write / clear never throw", threw, false);
check("no sessionStorage at all (Node) → no draft", readDraft("uid-A", null), null);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
