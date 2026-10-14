// Light / Dark / System theme. The choice is remembered per device in
// localStorage and applied as data-theme on <html>; index.css holds the
// colours. "system" follows the device's prefers-color-scheme, live, in CSS.
// The inline script in index.html applies the saved choice before first
// paint (no white flash) and must use the same key and values as this file.
// The functions above the line are pure; examples in theme.check.ts
// (node src/theme.check.ts).

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "isu-theme";
export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** A stored value as a choice: anything unknown (nothing saved, an old or
 *  hand-edited value) is "system", the default. */
export function parseChoice(value: unknown): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/** What the screen actually shows for a choice. */
export function resolveTheme(choice: ThemeChoice, deviceIsDark: boolean): ResolvedTheme {
  return choice === "system" ? (deviceIsDark ? "dark" : "light") : choice;
}

/** The header button flips what is shown: dark → light, light → dark.
 *  (From "system" it saves the opposite of the device; Settings sets System back.) */
export function toggledChoice(shown: ResolvedTheme): ThemeChoice {
  return shown === "dark" ? "light" : "dark";
}

// ─── Browser side ──────────────────────────────────────────────────────────
// Storage can be blocked (private mode, site data off): every access is in
// try/catch and the theme still works for the visit, just not remembered.

export function readChoice(): ThemeChoice {
  try {
    return parseChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

export function saveChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* not remembered; still applied */
  }
}

export function applyChoice(choice: ThemeChoice): void {
  document.documentElement.setAttribute("data-theme", choice);
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function deviceIsDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

/** Calls `onChange` when the device switches between light and dark. */
export function watchDevice(onChange: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
