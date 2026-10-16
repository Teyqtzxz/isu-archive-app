// Examples for trie.ts. Run with:  node src/trie.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import { Trie } from "./trie.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

// The drawing in docs/16 §3 holds these five words.
const trie = new Trie<string>();
for (const w of ["soil", "soils", "sorghum", "irrigation", "irrigate"]) trie.insert(w, w);
const sorted = (xs: string[]) => [...xs].sort();

console.log("— Prefixes —");
check("“soi” → soil, soils", sorted(trie.withPrefix("soi")), ["soil", "soils"]);
check("“so” → soil, soils, sorghum", sorted(trie.withPrefix("so")), ["soil", "soils", "sorghum"]);
check("“irrigat” → irrigate, irrigation", sorted(trie.withPrefix("irrigat")), ["irrigate", "irrigation"]);
check("a whole word is its own prefix: “soil” → soil, soils", sorted(trie.withPrefix("soil")), ["soil", "soils"]);
check("a prefix that matches nothing → []", trie.withPrefix("zzz"), []);
check("longer than any key → []", trie.withPrefix("soilsx"), []);
check("empty prefix → everything", trie.withPrefix("").length, 5);

console.log("\n— Keys are code points —");
const accents = new Trie<string>();
accents.insert("niño", "niño");
accents.insert("nino", "nino");
check("“niñ” finds only niño (ñ is its own letter)", accents.withPrefix("niñ"), ["niño"]);
check("“nin” finds only nino", accents.withPrefix("nin"), ["nino"]);
check("“ni” finds both", sorted(accents.withPrefix("ni")), ["nino", "niño"]);

console.log("\n— Several values under one key —");
const shared = new Trie<number>();
shared.insert("rice", 1);
shared.insert("rice", 2);
check("both values are kept", shared.withPrefix("ric"), [1, 2]);

console.log("\n— Empty and very long keys —");
const edge = new Trie<string>();
edge.insert("", "empty key");
check("a value under the empty key is found by the empty prefix", edge.withPrefix(""), ["empty key"]);
const long = "a".repeat(5000);
edge.insert(long, "long");
check("a 5000-letter key is found (no recursion to overflow)", edge.withPrefix("aaa"), ["long"]);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
