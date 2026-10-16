// Pure edit distance: no React, no firebase. Examples in levenshtein.check.ts
// (node src/levenshtein.check.ts). Worked tables by hand in docs/16-smart-search.md.
//
// The Levenshtein distance between two words is the smallest number of
// single-letter edits that turns one into the other. Each edit costs 1:
//   - add a letter     ("irigation" → "irrigation")
//   - remove a letter  ("soill" → "soil")
//   - change a letter  ("cat" → "cut")
// Two swapped letters ("moistrue" → "moisture") cost 2 (two changes): this is
// plain Levenshtein, not Damerau-Levenshtein, which would count a swap as 1.
//
// Used by smartSearch.ts for "Did you mean…?". Search ranking does not use it.

/** The letters of a word, one array item per letter. NFC first, so an "ñ"
 *  typed as one character and an "ñ" pasted as "n" + a combining tilde are the
 *  same one letter; then split by code point ([...text]), so a letter outside
 *  the basic range is one item, never two. */
export function lettersOf(text: string): string[] {
  return [...text.normalize("NFC")];
}

/** The FULL table, row by row. table[i][j] = the distance between the first i
 *  letters of `a` and the first j letters of `b`, so the answer is the
 *  bottom-right cell. Kept for teaching and for the checks: the app itself
 *  calls levenshtein(), which keeps only two rows. */
export function levenshteinTable(a: string, b: string): number[][] {
  const x = lettersOf(a);
  const y = lettersOf(b);
  const table: number[][] = [];

  // Row 0: turning "" into the first j letters of b takes j additions.
  table.push(firstRow(y.length));

  for (let i = 1; i <= x.length; i++) {
    table.push(nextRow(table[i - 1], x[i - 1], y, i));
  }
  return table;
}

/** The distance between `a` and `b`. Same result as the full table, but only
 *  two rows are ever kept: each row is built from the one above it, so the
 *  older rows are not needed any more. Memory is two short arrays instead of
 *  a whole grid.
 *
 *  `max` (optional) lets it stop early. Every number in a row is at least as
 *  large as the smallest number in the row above (an edit never costs less
 *  than 0), so once a whole row is above `max` the final answer must be too:
 *  it stops and returns max + 1, meaning "more than max". With no `max` it
 *  always computes the exact distance. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  const x = lettersOf(a);
  const y = lettersOf(b);

  // Quick answers that need no table.
  if (x.length === 0) return capped(y.length, max);
  if (y.length === 0) return capped(x.length, max);
  // The length difference alone needs that many additions or removals.
  if (Math.abs(x.length - y.length) > max) return max + 1;

  let above = firstRow(y.length);
  for (let i = 1; i <= x.length; i++) {
    const row = nextRow(above, x[i - 1], y, i);
    if (Math.min(...row) > max) return max + 1;
    above = row;
  }
  return capped(above[y.length], max);
}

/** Row 0 of the table: 0, 1, 2, … n. */
function firstRow(n: number): number[] {
  const row: number[] = [];
  for (let j = 0; j <= n; j++) row.push(j);
  return row;
}

/** Row i of the table, from row i - 1 (`above`) and the i-th letter of a.
 *  Each cell takes the cheapest of three moves:
 *    from the left   (row[j - 1] + 1)    add      y[j - 1]
 *    from above      (above[j] + 1)      remove   letter
 *    from top-left   (above[j - 1] + 0)  same letter: free
 *                    (above[j - 1] + 1)  change letter into y[j - 1] */
function nextRow(above: number[], letter: string, y: string[], i: number): number[] {
  // Column 0: turning the first i letters of a into "" takes i removals.
  const row: number[] = [i];
  for (let j = 1; j <= y.length; j++) {
    const add = row[j - 1] + 1;
    const remove = above[j] + 1;
    const changeCost = letter === y[j - 1] ? 0 : 1;
    const change = above[j - 1] + changeCost;
    row.push(Math.min(add, remove, change));
  }
  return row;
}

/** A distance above `max` is reported as max + 1, whatever its real value. */
function capped(distance: number, max: number): number {
  return distance > max ? max + 1 : distance;
}
