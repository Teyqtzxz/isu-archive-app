// Examples for toast.ts (the three kinds of pop-up message, errata #81).
// Run with:
//   node src/toast.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import { TOAST_RULES, toastAria, type ToastKind } from "./toast.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n      got:  ${String(got)}\n      want: ${String(want)}`}`);
}

// Times: a success goes fast, a dropped thing stays longer, an error longest.
check("success stays 3 s", TOAST_RULES.success.ms, 3000);
check("notice stays 6 s", TOAST_RULES.notice.ms, 6000);
check("error stays 8 s", TOAST_RULES.error.ms, 8000);
check("success < notice < error", TOAST_RULES.success.ms < TOAST_RULES.notice.ms && TOAST_RULES.notice.ms < TOAST_RULES.error.ms, true);

// Roles: only an error interrupts.
check("success is a status", TOAST_RULES.success.role, "status");
check("notice is a status", TOAST_RULES.notice.role, "status");
check("error is an alert", TOAST_RULES.error.role, "alert");

// Only an error has ×.
check("success has no ×", TOAST_RULES.success.closable, false);
check("notice has no ×", TOAST_RULES.notice.closable, false);
check("error has ×", TOAST_RULES.error.closable, true);

// Marks: a tick only for success.
check("success shows a tick", TOAST_RULES.success.icon, "tick");
check("notice shows !", TOAST_RULES.notice.icon, "bang");
check("error shows !", TOAST_RULES.error.icon, "bang");

// The aria attributes put on the toast.
check("error: role alert", toastAria("error").role, "alert");
check("error: no aria-live polite beside the alert", toastAria("error")["aria-live"], undefined);
check("error: only role", Object.keys(toastAria("error")).join(","), "role");
check("success: role status", toastAria("success").role, "status");
check("success: aria-live polite", toastAria("success")["aria-live"], "polite");
check("notice: role status", toastAria("notice").role, "status");
check("notice: aria-live polite", toastAria("notice")["aria-live"], "polite");

// Exactly the three kinds, each with a positive time.
const kinds = Object.keys(TOAST_RULES).sort().join(",");
check("exactly three kinds", kinds, "error,notice,success");
for (const k of Object.keys(TOAST_RULES) as ToastKind[]) {
  check(`${k}: time is a whole positive number of ms`, Number.isInteger(TOAST_RULES[k].ms) && TOAST_RULES[k].ms > 0, true);
}

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
