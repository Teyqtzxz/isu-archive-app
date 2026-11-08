// The pop-up message (Toast in components/shared.tsx): three kinds, each with
// its own time, screen-reader role and close button (errata #81, docs/04).
//   success  green tick, 3 s           "Study posted!", "Study updated", "Study deleted"
//   notice   amber "!", 6 s            something was dropped (a deleted study, a stale Edit draft)
//   error    red "!", 8 s, with ×      something failed (profile, delete, sign-out)
// The timer waits while the mouse or keyboard focus is on the toast and starts
// again in full when it leaves (WCAG 2.2.1), as "Removed … Undo" does.

export type ToastKind = "success" | "notice" | "error";

export type ToastRule = {
  /** How long it stays when nothing holds it. */
  ms: number;
  /** "alert" interrupts the screen reader; "status" waits its turn (aria-live polite). */
  role: "status" | "alert";
  /** A × "Close message" button. */
  closable: boolean;
  /** The mark in the circle. */
  icon: "tick" | "bang";
};

export const TOAST_RULES: Readonly<Record<ToastKind, ToastRule>> = {
  success: { ms: 3000, role: "status", closable: false, icon: "tick" },
  notice: { ms: 6000, role: "status", closable: false, icon: "bang" },
  error: { ms: 8000, role: "alert", closable: true, icon: "bang" },
};

/** What App keeps: the id makes each toast new, even with the same words. */
export type ToastState = { id: number; message: string; kind: ToastKind };

/** The aria attributes for a kind: errors are an alert (implicitly assertive),
 *  never also aria-live="polite"; the others a polite status. */
export function toastAria(kind: ToastKind): { role: "status" | "alert"; "aria-live"?: "polite" } {
  return TOAST_RULES[kind].role === "alert" ? { role: "alert" } : { role: "status", "aria-live": "polite" };
}
