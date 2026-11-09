// Examples for stats.ts. Run with:  node src/stats.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
//
// "This month" depends on the time zone, so the checks run in Manila time
// whatever the machine is set to. Node re-reads TZ when it is assigned, and
// no Date is created before this line (stats.ts makes none on import).
process.env.TZ = "Asia/Manila";

import { adviserKey, countAdded, countAddedByMonth, countByYear, topAdvisers } from "./stats.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}

const at = (registeredAt: string | null) => ({ registeredAt });
// 08:00 Manila time on these days: the same date in UTC, so "now" is unambiguous.
const oct2026 = new Date("2026-10-16T00:00:00Z");
const sep2026 = new Date("2026-09-30T00:00:00Z");
const jan2026 = new Date("2026-01-01T00:00:00Z");

console.log("— Time zone —");
check("the checks run in UTC+8", new Date("2026-01-01T00:00:00Z").getTimezoneOffset(), -480);

console.log("— Month boundary —");
// 16:30 UTC on 30 September is 00:30 on 1 October in Manila.
check("2026-09-30T16:30Z counts as October", countAdded([at("2026-09-30T16:30:00Z")], oct2026), { thisMonth: 1, thisYear: 1 });
check("2026-09-30T16:30Z is not September", countAdded([at("2026-09-30T16:30:00Z")], sep2026), { thisMonth: 0, thisYear: 1 });
check("2026-09-30T15:59Z is still September", countAdded([at("2026-09-30T15:59:00Z")], oct2026), { thisMonth: 0, thisYear: 1 });

console.log("— Year boundary —");
// 17:00 UTC on 31 December 2025 is 01:00 on 1 January 2026 in Manila.
check("2025-12-31T17:00Z counts as 2026", countAdded([at("2025-12-31T17:00:00Z")], jan2026), { thisMonth: 1, thisYear: 1 });
check("2025-12-31T17:00Z is not 2025", countAdded([at("2025-12-31T17:00:00Z")], new Date("2025-12-31T00:00:00Z")), { thisMonth: 0, thisYear: 0 });
check("same month, last year", countAdded([at("2025-10-05T02:00:00Z")], oct2026), { thisMonth: 0, thisYear: 0 });

console.log("— Missing dates —");
check("null never counted", countAdded([at(null)], oct2026), { thisMonth: 0, thisYear: 0 });
check('"" never counted', countAdded([at("")], oct2026), { thisMonth: 0, thisYear: 0 });
check("unreadable date never counted", countAdded([at("not a date")], oct2026), { thisMonth: 0, thisYear: 0 });
check("empty list", countAdded([], oct2026), { thisMonth: 0, thisYear: 0 });

console.log("— Mixed list —");
check(
  "2 this month, 3 this year",
  countAdded([
    at("2026-10-01T03:00:00Z"),
    at("2026-09-30T20:00:00Z"), // 1 Oct 04:00 Manila
    at("2026-03-15T03:00:00Z"),
    at("2025-12-31T10:00:00Z"), // 31 Dec 18:00 Manila — last year
    at(null),
  ], oct2026),
  { thisMonth: 2, thisYear: 3 },
);

// ─── Library charts (errata #76) ────────────────────────────────────────────
const ofYear = (year: unknown) => ({ year: year as number });
const yearRows = (rows: { label: string; count: number }[]) => rows.map(r => `${r.label}:${r.count}`);
const sum = (rows: { count: number }[]) => rows.reduce((n, r) => n + r.count, 0);

console.log("— Studies by year —");
check("empty library: no rows", countByYear([]), []);
check("one study: one row", yearRows(countByYear([ofYear(2024)])), ["2024:1"]);
check(
  "a gap year is kept as 0, oldest first",
  yearRows(countByYear([ofYear(2024), ofYear(2021), ofYear(2024), ofYear(2022)])),
  ["2021:1", "2022:1", "2023:0", "2024:2"],
);
const wide = [1975, 2010, 2014, 2015, 2015, 2020, 2026, 2026].map(ofYear);
const wideRows = countByYear(wide);
check(
  "1975 → 2026: the newest 12 years, older ones in Before 2015",
  yearRows(wideRows),
  ["Before 2015:3", "2015:2", "2016:0", "2017:0", "2018:0", "2019:0", "2020:1", "2021:0", "2022:0", "2023:0", "2024:0", "2025:0", "2026:2"],
);
check("1975 → 2026: rows add up to the 8 studies", sum(wideRows), 8);
check("1975 → 2026: the Before row is marked as such", wideRows[0], { label: "Before 2015", kind: "before", year: 2015, count: 3 });
check("exactly 12 years: no Before row", yearRows(countByYear([ofYear(2015), ofYear(2026)])).length, 12);
check("13 years: one Before row", yearRows(countByYear([ofYear(2014), ofYear(2026)]))[0], "Before 2015:1");
check(
  "an unreadable year goes in No year, at the end",
  yearRows(countByYear([ofYear(2025), ofYear(0), ofYear(undefined), ofYear("abc"), ofYear(2024.5), ofYear("2025")])),
  ["2025:2", "No year:4"],
);
check("only unreadable years: one No year row", yearRows(countByYear([ofYear(null)])), ["No year:1"]);
{
  // 1000 studies over 40 years: still 13 rows, still 1000.
  const many = Array.from({ length: 1000 }, (_, i) => ofYear(1987 + (i % 40)));
  const rows = countByYear(many);
  check("1000 studies over 40 years: 13 rows", rows.length, 13);
  check("1000 studies over 40 years: rows add up to 1000", sum(rows), 1000);
}

console.log("— Added per month —");
const months = (rows: { year: number; label: string; count: number }[]) => rows.map(r => `${r.label} ${r.year}:${r.count}`);
const nov2026 = new Date("2026-11-08T04:00:00Z"); // 12:00 on 8 Nov in Manila
check(
  "12 months up to this one, oldest first, zeros kept",
  months(countAddedByMonth([at("2026-11-02T03:00:00Z"), at("2026-11-05T03:00:00Z"), at("2026-03-10T03:00:00Z")], nov2026)),
  ["Dec 2025:0", "Jan 2026:0", "Feb 2026:0", "Mar 2026:1", "Apr 2026:0", "May 2026:0", "Jun 2026:0", "Jul 2026:0", "Aug 2026:0", "Sep 2026:0", "Oct 2026:0", "Nov 2026:2"],
);
// 16:30 UTC on 31 October is 00:30 on 1 November in Manila: November here,
// October in UTC.
{
  const rows = countAddedByMonth([at("2026-10-31T16:30:00Z")], nov2026);
  check("00:30 on 1 Nov in Manila counts as November", rows[11].count, 1);
  check("… and not as October", rows[10].count, 0);
  const rows2 = countAddedByMonth([at("2026-10-31T15:59:00Z")], nov2026);
  check("23:59 on 31 Oct in Manila stays October", [rows2[10].count, rows2[11].count], [1, 0]);
}
{
  // January: the 12 months reach back into last year, February to December.
  const jan = new Date("2026-01-20T04:00:00Z");
  const rows = countAddedByMonth([at("2025-02-03T03:00:00Z"), at("2025-01-31T03:00:00Z"), at("2025-12-31T16:30:00Z")], jan);
  check(
    "January: Feb 2025 → Jan 2026",
    months(rows),
    ["Feb 2025:1", "Mar 2025:0", "Apr 2025:0", "May 2025:0", "Jun 2025:0", "Jul 2025:0", "Aug 2025:0", "Sep 2025:0", "Oct 2025:0", "Nov 2025:0", "Dec 2025:0", "Jan 2026:1"],
  );
  check("January: Jan 2025 is 13 months back, not counted", sum(rows), 2);
}
{
  // On the 31st, "this month minus 1" by setMonth() lands on 3 March (31 Feb
  // rolls over), so a naive loop skips February. Every month is still there.
  const mar31 = new Date("2026-03-31T04:00:00Z");
  check(
    "today the 31st: no month skipped or repeated",
    countAddedByMonth([], mar31).map(r => r.label),
    ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
  );
  check("today the 31st: February counted", countAddedByMonth([at("2026-02-14T03:00:00Z")], mar31)[10], { year: 2026, month: 1, label: "Feb", count: 1 });
  check("today 31 Dec: Jan → Dec of the same year", countAddedByMonth([], new Date("2026-12-31T04:00:00Z")).map(r => `${r.label} ${r.year}`).join(","),
    "Jan 2026,Feb 2026,Mar 2026,Apr 2026,May 2026,Jun 2026,Jul 2026,Aug 2026,Sep 2026,Oct 2026,Nov 2026,Dec 2026");
}
check(
  "no date, empty date and bad dates are skipped",
  sum(countAddedByMonth([at(null), at(""), at("not a date"), at("2026-13-45T00:00:00Z"), at("2026-11-01T03:00:00Z")], nov2026)),
  1,
);
check("a date after this month is not counted", sum(countAddedByMonth([at("2026-12-02T03:00:00Z")], nov2026)), 0);
check("empty library: 12 zero months", countAddedByMonth([], nov2026).map(r => r.count), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

console.log("— Top advisers —");
const adv = (...names: unknown[]) => names.map(adviser => ({ adviser: adviser as string }));
check("adviserKey drops titles, degrees, case and spaces", adviserKey("  Dr.  MARIA   Santos, Ph.D. "), "maria santos");
check("adviserKey: Asst. Prof. and Engr. are titles", adviserKey("Asst. Prof. Engr. Jose Rizal, MSc"), "jose rizal");
check(
  "Dr. Maria Santos, maria santos and Maria Santos, PhD are one person",
  topAdvisers(adv("Dr. Maria Santos", "maria santos", "Maria Santos, PhD", "Maria Santos")),
  [{ adviser: "Dr. Maria Santos", count: 4 }],
);
check(
  "the most common spelling is shown",
  topAdvisers(adv("maria santos", "Maria Santos, PhD", "Maria Santos, PhD", "Dr. Maria Santos")),
  [{ adviser: "Maria Santos, PhD", count: 4 }],
);
check("tie: the neatly typed spelling wins", topAdvisers(adv("dr stone", "Dr. Stone")), [{ adviser: "Dr. Stone", count: 2 }]);
check("tie: the same in the other order", topAdvisers(adv("Dr. Stone", "dr stone")), [{ adviser: "Dr. Stone", count: 2 }]);
check("tie: neat beats ALL CAPS", topAdvisers(adv("DR. STONE", "Dr. Stone")), [{ adviser: "Dr. Stone", count: 2 }]);
check("tie: neat beats all lowercase", topAdvisers(adv("maria santos", "Maria Santos")), [{ adviser: "Maria Santos", count: 2 }]);
check("the most common spelling still wins over a neater one", topAdvisers(adv("dr stone", "dr stone", "Dr. Stone")), [{ adviser: "dr stone", count: 3 }]);
check("extra spaces do not make a new spelling", topAdvisers(adv("Maria  Santos", " Maria Santos ")), [{ adviser: "Maria Santos", count: 2 }]);
check(
  "two people who share a surname stay apart",
  topAdvisers(adv("Dr. Maria Santos", "Dr. Jose Santos", "Maria Santos")),
  [{ adviser: "Dr. Maria Santos", count: 2 }, { adviser: "Dr. Jose Santos", count: 1 }],
);
check(
  "ties: A–Z by name, titles ignored",
  topAdvisers(adv("Dr. Zamora Cruz", "Ana Reyes", "Engr. Ben Lim")),
  [{ adviser: "Ana Reyes", count: 1 }, { adviser: "Engr. Ben Lim", count: 1 }, { adviser: "Dr. Zamora Cruz", count: 1 }],
);
check(
  "top 8 only, highest first",
  topAdvisers(adv(..."ABCDEFGHIJ".split("").flatMap((c, i) => Array(10 - i).fill(`Adviser ${c}`)))).map(a => `${a.adviser}:${a.count}`),
  ["Adviser A:10", "Adviser B:9", "Adviser C:8", "Adviser D:7", "Adviser E:6", "Adviser F:5", "Adviser G:4", "Adviser H:3"],
);
check("empty, spaces-only, title-only and missing advisers are skipped", topAdvisers(adv("", "   ", "Dr.", undefined, null, "Ana Reyes")), [{ adviser: "Ana Reyes", count: 1 }]);
check("empty library: no advisers", topAdvisers([]), []);

console.log("— Two or three advisers on one study (errata #86) —");
check(
  "“A and B” counts once for each, not as one adviser “A and B”",
  topAdvisers(adv("Dr. Ana Reyes and Engr. Ben Lim", "Ana Reyes", "Engr. Ben Lim, MIT")),
  [{ adviser: "Dr. Ana Reyes", count: 2 }, { adviser: "Engr. Ben Lim", count: 2 }],
);
check("three advisers: three people", topAdvisers(adv("Ana Reyes and Ben Lim and Carla Sy")).length, 3);
check("the same person twice on one study counts once", topAdvisers(adv("Ana Reyes and Dr. Ana Reyes, PhD")), [{ adviser: "Ana Reyes", count: 1 }]);
check("“and” inside a name does not split it", topAdvisers(adv("Dr. Alexandra Anderson")), [{ adviser: "Dr. Alexandra Anderson", count: 1 }]);
check("one adviser per study: counted exactly as before", topAdvisers(adv("Dr. Maria Santos", "maria  santos", "Maria Santos, Ph.D.")),
  [{ adviser: "Dr. Maria Santos", count: 3 }]);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
