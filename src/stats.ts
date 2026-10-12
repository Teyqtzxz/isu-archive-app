// Department statistics — pure counting over the live thesis list. No React,
// no Firestore: the dashboards already hold every thesis, so the numbers are
// always in step with what Search finds.
import { DEPARTMENTS, type Thesis } from "./types";

export interface DepartmentCount {
  department: string;
  count: number;
}

export interface KeywordCount {
  keyword: string;
  count: number;
}

/**
 * One row per department, in DEPARTMENTS order, zeros included — an empty
 * department is a statistic too. A thesis whose department is not one of the
 * ten (an old or hand-edited record) is counted under "Other", which only
 * appears when there is one, so the rows always add up to the total.
 */
export function countByDepartment(theses: Pick<Thesis, "department">[]): DepartmentCount[] {
  const counts = new Map<string, number>(DEPARTMENTS.map(d => [d, 0]));
  let other = 0;
  for (const t of theses) {
    const n = counts.get(t.department);
    if (n === undefined) other++;
    else counts.set(t.department, n + 1);
  }
  const rows = DEPARTMENTS.map(d => ({ department: d as string, count: counts.get(d) ?? 0 }));
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
