// College statistics — pure counting over the live thesis list. No React,
// no Firestore: the dashboards already hold every thesis, so the numbers are
// always in step with what Search finds. (The field and these names still say
// "department": errata #87 kept the Firestore field name.)
import { registeredAtISO, type Thesis } from "./types.ts";
import { COLLEGE_NAMES } from "./colleges.ts";
import { isNameTitle, tokenize } from "./search.ts";
import { adviserNames } from "./validation.ts";

export interface DepartmentCount {
  department: string;
  count: number;
}

export interface KeywordCount {
  keyword: string;
  count: number;
}

/**
 * One row per college (its full name), in COLLEGE_NAMES order, zeros
 * included — an empty college is a statistic too. Old department names have
 * already been read as their college (data.ts). A thesis whose value is still
 * not one of the 12 (hand-edited, or empty) is counted under "Other", which
 * only appears when there is one, so the rows always add up to the total.
 */
export function countByDepartment(theses: Pick<Thesis, "department">[]): DepartmentCount[] {
  const counts = new Map<string, number>(COLLEGE_NAMES.map(d => [d, 0]));
  let other = 0;
  for (const t of theses) {
    const n = counts.get(t.department);
    if (n === undefined) other++;
    else counts.set(t.department, n + 1);
  }
  const rows = COLLEGE_NAMES.map(d => ({ department: d, count: counts.get(d) ?? 0 }));
  if (other > 0) rows.push({ department: "Other", count: other });
  return rows;
}

/**
 * The most used keywords, highest count first, ties A–Z. Matching ignores case
 * and surrounding spaces ("Rice" and "rice " are one keyword), the spelling
 * shown is the first one seen, and a keyword counts once per thesis even if
 * it was typed twice.
 */
export function topKeywords(theses: Pick<Thesis, "keywords">[], limit = 10): KeywordCount[] {
  const counts = new Map<string, KeywordCount>();
  for (const t of theses) {
    const seen = new Set<string>();
    for (const raw of t.keywords ?? []) {
      const keyword = raw.trim();
      const key = keyword.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const row = counts.get(key);
      if (row) row.count++;
      else counts.set(key, { keyword, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}

export interface AddedCount {
  thisMonth: number;
  thisYear: number;
}

/**
 * Studies registered in `now`'s month and year, in the viewer's LOCAL time.
 * Comparing ISO strings would compare in UTC: in the Philippines (UTC+8) a
 * study registered at 07:00 on 1 October is still 30 September in UTC.
 * A record with no registeredAt ("") is never counted.
 */
export function countAdded(theses: Pick<Thesis, "registeredAt">[], now = new Date()): AddedCount {
  let thisMonth = 0;
  let thisYear = 0;
  for (const t of theses) {
    const iso = registeredAtISO(t);
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== now.getFullYear()) continue;
    thisYear++;
    if (d.getMonth() === now.getMonth()) thisMonth++;
  }
  return { thisMonth, thisYear };
}

// ─── Library charts (LibraryCharts.tsx, staff Statistics tab) ───────────────

export interface YearCount {
  /** "2024", "Before 2015" or "No year". */
  label: string;
  /** "year": one Academic Year · "before": every year older than the oldest
   *  year shown · "none": records with no readable year (old or hand-edited). */
  kind: "year" | "before" | "none";
  /** The year itself; for "before", the oldest year shown; null for "none". */
  year: number | null;
  count: number;
}

/** A readable Academic Year, or null. The form only saves 4-digit numbers,
 *  but an old or hand-edited record may hold anything. */
function yearOf(value: unknown): number | null {
  const y = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof y === "number" && Number.isInteger(y) && y > 0 ? y : null;
}

/**
 * Studies per Academic Year (the `year` field), oldest first, every year from
 * the oldest to the newest present, zeros included — a year with no study is
 * a statistic too. Only the newest `limit` years get their own row, so one
 * very old study cannot stretch the chart: older years are added up in one
 * "Before <oldest year shown>" row at the start. A record with no readable
 * year is counted in a "No year" row at the end, which only appears when
 * there is one, so the rows always add up to the number of studies.
 */
export function countByYear(theses: Pick<Thesis, "year">[], limit = 12): YearCount[] {
  const counts = new Map<number, number>();
  let none = 0;
  for (const t of theses) {
    const y = yearOf(t.year);
    if (y === null) none++;
    else counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const rows: YearCount[] = [];
  if (counts.size > 0) {
    const years = [...counts.keys()];
    const newest = Math.max(...years);
    const oldest = Math.max(Math.min(...years), newest - limit + 1);
    let before = 0;
    for (const [y, n] of counts) if (y < oldest) before += n;
    if (before > 0) rows.push({ label: `Before ${oldest}`, kind: "before", year: oldest, count: before });
    for (let y = oldest; y <= newest; y++) rows.push({ label: String(y), kind: "year", year: y, count: counts.get(y) ?? 0 });
  }
  if (none > 0) rows.push({ label: "No year", kind: "none", year: null, count: none });
  return rows;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface MonthCount {
  /** Full year, e.g. 2026. */
  year: number;
  /** 0 = January … 11 = December, as Date.getMonth(). */
  month: number;
  /** "Jan" … "Dec". */
  label: string;
  count: number;
}

/**
 * Studies added to the e-library (registeredAt: when staff posted it, not its
 * Academic Year) in each of the `months` months up to and including `now`'s,
 * oldest first, zeros included. Months are the viewer's LOCAL months, as in
 * countAdded: in the Philippines a study posted at 00:30 on 1 October is
 * still September in UTC. Each month is built from day 1, so a `now` on the
 * 31st never skips a shorter month. A record with no date or an unreadable
 * one is never counted, and nor is one dated after `now`'s month.
 */
export function countAddedByMonth(theses: Pick<Thesis, "registeredAt">[], now = new Date(), months = 12): MonthCount[] {
  const rows: MonthCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    // new Date(y, m, 1) rolls a negative or 12+ month into the right year.
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    rows.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()], count: 0 });
  }
  const first = rows[0].year * 12 + rows[0].month;
  for (const t of theses) {
    const iso = registeredAtISO(t);
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const row = rows[d.getFullYear() * 12 + d.getMonth() - first];
    if (row) row.count++;
  }
  return rows;
}

export interface AdviserCount {
  /** The spelling typed most often (spaces tidied); ties: the neatest
   *  (neatness), then A–Z. */
  adviser: string;
  count: number;
}

/** Who an adviser name is: lowercase words, titles and degrees left out
 *  (isNameTitle, the same list search ignores), spaces and punctuation
 *  ignored. "Dr. Maria Santos", "maria  santos" and "Maria Santos, Ph.D."
 *  are all "maria santos". A dot inside a word is dropped first, so "Ph.D."
 *  is the degree "phd", not the words "ph" and "d". */
export function adviserKey(name: string): string {
  return tokenize(name.replace(/\.(?=\p{L})/gu, "")).filter(w => !isNameTitle(w)).join(" ");
}

/** How neatly a name is typed: its words written as a capital and then small
 *  letters. "Dr. Stone" 2, "dr stone" and "DR. STONE" 0. */
function neatness(spelling: string): number {
  return spelling.split(" ").filter(w => /^\p{Lu}\p{Ll}/u.test(w)).length;
}

/**
 * The advisers with the most studies, highest first, ties A–Z by name
 * (titles left out, so "Dr. Zamora" sorts under Z). The same person typed
 * different ways counts once (adviserKey); people who only share a surname
 * stay apart. An empty adviser, or one that is only a title, is skipped.
 * A study with two or three advisers ("A and B", errata #86) counts once for
 * each of them (adviserNames).
 */
export function topAdvisers(theses: Pick<Thesis, "adviser">[], limit = 8): AdviserCount[] {
  const people = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const t of theses) {
    if (typeof t.adviser !== "string") continue;
    const counted = new Set<string>();
    for (const spelling of adviserNames(t.adviser)) {
      const key = adviserKey(spelling);
      if (!key || counted.has(key)) continue;
      counted.add(key);
      let p = people.get(key);
      if (!p) people.set(key, p = { count: 0, spellings: new Map() });
      p.count++;
      p.spellings.set(spelling, (p.spellings.get(spelling) ?? 0) + 1);
    }
  }
  return [...people.entries()]
    .map(([key, p]) => {
      const [adviser] = [...p.spellings.entries()]
        .sort((a, b) => b[1] - a[1] || neatness(b[0]) - neatness(a[0]) || a[0].localeCompare(b[0]))[0];
      return { key, adviser, count: p.count };
    })
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key) || a.adviser.localeCompare(b.adviser))
    .slice(0, limit)
    .map(({ adviser, count }) => ({ adviser, count }));
}
