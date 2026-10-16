// Examples for stats.ts. Run with:  node src/stats.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
//
// "This month" depends on the time zone, so the checks run in Manila time
// whatever the machine is set to. Node re-reads TZ when it is assigned, and
// no Date is created before this line (stats.ts makes none on import).
process.env.TZ = "Asia/Manila";

import { countAdded } from "./stats.ts";

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

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
