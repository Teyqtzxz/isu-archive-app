// Examples for levenshtein.ts. Run with:  node src/levenshtein.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import { levenshtein, levenshteinTable, lettersOf } from "./levenshtein.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

console.log("— The worked examples in docs/16 §2 —");
// The same table as docs/16 §2, filled in by hand there.
check("“cat” → “cut”: full table", levenshteinTable("cat", "cut"), [
  [0, 1, 2, 3],
  [1, 0, 1, 2],
  [2, 1, 1, 2],
  [3, 2, 2, 1],
]);
check("“cat” → “cut” = 1 (change a → u)", levenshtein("cat", "cut"), 1);
check("“irigation” → “irrigation”: full table", levenshteinTable("irigation", "irrigation"), [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8],
  [3, 2, 1, 1, 1, 2, 3, 4, 5, 6, 7],
  [4, 3, 2, 2, 2, 1, 2, 3, 4, 5, 6],
  [5, 4, 3, 3, 3, 2, 1, 2, 3, 4, 5],
  [6, 5, 4, 4, 4, 3, 2, 1, 2, 3, 4],
  [7, 6, 5, 5, 4, 4, 3, 2, 1, 2, 3],
  [8, 7, 6, 6, 5, 5, 4, 3, 2, 1, 2],
  [9, 8, 7, 7, 6, 6, 5, 4, 3, 2, 1],
]);
check("“irigation” → “irrigation” = 1 (add an r)", levenshtein("irigation", "irrigation"), 1);
check("“moistrue” → “moisture” = 2 (swapped letters cost 2: no Damerau)", levenshtein("moistrue", "moisture"), 2);

console.log("\n— Edge cases —");
check("both empty = 0", levenshtein("", ""), 0);
check("empty → “abc” = 3 additions", levenshtein("", "abc"), 3);
check("“abc” → empty = 3 removals", levenshtein("abc", ""), 3);
check("identical words = 0", levenshtein("irrigation", "irrigation"), 0);
check("the distance is the same both ways", [levenshtein("soil", "spoil"), levenshtein("spoil", "soil")], [1, 1]);
check("case counts: “Rice” → “rice” = 1 (callers lowercase first)", levenshtein("Rice", "rice"), 1);

console.log("\n— ñ and accents —");
check("“niño” → “nino” = 1 (ñ and n are different letters)", levenshtein("niño", "nino"), 1);
const decomposed = "niño"; // n + combining tilde, as some PDFs paste it
check("ñ pasted as n + tilde is 2 characters …", decomposed.length, 5);
check("… but one letter after NFC", lettersOf(decomposed).length, 4);
check("“niño” typed vs pasted = 0", levenshtein("niño", decomposed), 0);
check("“Peñablanca” → “Penablanca” = 1", levenshtein("Peñablanca", "Penablanca"), 1);
check("a letter outside the basic range (𝒜) is one letter", levenshtein("𝒜b", "ab"), 1);

console.log("\n— Very long words —");
const longA = "a".repeat(2000);
const longB = "a".repeat(1999) + "b";
check("2000 letters, last one changed = 1", levenshtein(longA, longB), 1);
check("2000 vs 1000 letters, max 2 → stops at once (3)", levenshtein(longA, "a".repeat(1000), 2), 3);

console.log("\n— Early exit (max) —");
check("within max: the exact distance", levenshtein("irigation", "irrigation", 2), 1);
check("over max: max + 1", levenshtein("irrigation", "machine", 2), 3);
check("length difference alone over max: max + 1", levenshtein("soil", "soilmoisture", 2), 3);
check("max 0: equal words → 0, others → 1", [levenshtein("rice", "rice", 0), levenshtein("rice", "rise", 0)], [0, 1]);

// Many random pairs: the early-exit answer must equal the full table's
// answer whenever that is <= max, and be max + 1 otherwise.
let seed = 12345;
function random(): number {
  // A small fixed-seed generator (mulberry32), so a failure can be repeated.
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randomWord(): string {
  const letters = ["a", "b", "c", "ñ", "é", "r", "i"];
  const length = Math.floor(random() * 9);
  let word = "";
  for (let i = 0; i < length; i++) word += letters[Math.floor(random() * letters.length)];
  return word;
}
let mismatches = 0;
const PAIRS = 5000;
for (let k = 0; k < PAIRS; k++) {
  const a = randomWord();
  const b = randomWord();
  const max = Math.floor(random() * 4);
  const full = levenshteinTable(a, b)[lettersOf(a).length][lettersOf(b).length];
  const want = full <= max ? full : max + 1;
  if (levenshtein(a, b, max) !== want || levenshtein(a, b) !== full) {
    mismatches++;
    if (mismatches <= 3) console.log(`      mismatch: "${a}" "${b}" max ${max}`);
  }
}
check(`${PAIRS} random pairs: early exit = full table (when <= max)`, mismatches, 0);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
