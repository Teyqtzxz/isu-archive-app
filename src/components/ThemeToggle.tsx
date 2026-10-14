// The theme controls: a moon/sun button for every header and the Light /
// Dark / System choice for Settings and the student account menu. The rules
// live in src/theme.ts; this file only keeps every control on screen in step.
import { useId, useSyncExternalStore } from "react";
import {
  THEME_CHOICES, applyChoice, deviceIsDark, readChoice, resolveTheme, saveChoice,
  toggledChoice, watchDevice, type ThemeChoice,
} from "../theme";
import { Icon, type IconName } from "./shared";

// One shared choice for the whole page, so the header button and the
// Settings picker never disagree.
let current: ThemeChoice = readChoice();
const listeners = new Set<() => void>();
if (typeof document !== "undefined") applyChoice(current);

function setChoice(choice: ThemeChoice) {
  current = choice;
  saveChoice(choice);
  applyChoice(choice);
  listeners.forEach(l => l());
}

function subscribeChoice(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** The saved choice, what the screen shows (System follows the device live), and setters. */
export function useTheme() {
  const choice = useSyncExternalStore(subscribeChoice, () => current);
  const deviceDark = useSyncExternalStore(watchDevice, deviceIsDark);
  const shown = resolveTheme(choice, deviceDark);
  return { choice, shown, setChoice, toggle: () => setChoice(toggledChoice(shown)) };
}

/** Moon in light (click → dark), sun in dark (click → light). `page` is the
 *  version for the login screen, which has no green header. */
export function ThemeToggle({ variant = "header" }: { variant?: "header" | "page" }) {
  const { shown, toggle } = useTheme();
  const label = shown === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className={`theme-toggle${variant === "page" ? " theme-toggle--page" : ""}`}>
      <Icon name={shown === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

const CHOICE_ICONS: Record<ThemeChoice, IconName> = { light: "sun", dark: "moon", system: "monitor" };

/** Light / Dark / System as three radio buttons (arrow keys move between them). */
export function ThemePicker() {
  const { choice } = useTheme();
  const name = useId();
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {THEME_CHOICES.map(o => (
        <label key={o.value} className={`theme-option${choice === o.value ? " theme-option--on" : ""}`}>
          <input type="radio" name={name} value={o.value} checked={choice === o.value}
            onChange={() => setChoice(o.value)} className="theme-radio" />
          <Icon name={CHOICE_ICONS[o.value]} size={15} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
