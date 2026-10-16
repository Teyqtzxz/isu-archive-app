import { useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { applyCompletion, autocomplete, type Completion, type SmartSearchIndex, type SuggestionField } from "../smartSearch";

const FIELD_NAMES: Record<SuggestionField, string> = {
  title: "Title", keyword: "Keyword", author: "Author", adviser: "Adviser", abstract: "Abstract",
};

/** A search box with autocomplete (smartSearch.ts, docs/16): the student
 *  dashboard box and the Search screen box. It is the plain <input> it
 *  replaces plus a suggestion list, following the ARIA combobox pattern.
 *  Returns the input and the list side by side, so the parent's icon and
 *  clear button keep their places; the parent must be position: relative.
 *
 *  Keyboard: ↓ / ↑ move through the list, Enter or Tab picks the highlighted
 *  suggestion, Esc closes it. With nothing highlighted, Enter does what it did
 *  before (`onEnter`) and Tab moves focus as usual.
 *  The list closes on Esc, on leaving the box, after a pick and when the box
 *  is emptied; it never opens while the box is empty. */
export function SmartSearchInput({
  index, value, onChange, onEnter, inputRef, className, placeholder, maxLength, ariaLabel,
}: {
  index: SmartSearchIndex;
  value: string;
  onChange: (value: string) => void;
  /** Enter with no suggestion highlighted (the dashboard runs its search). */
  onEnter?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  className: string;
  placeholder: string;
  maxLength: number;
  ariaLabel: string;
}) {
  const listId = useId();
  // Open only after typing (or ↓): a box that arrives already filled, such as
  // the Search screen opened from the dashboard, does not pop a list up.
  const [open, setOpen] = useState(false);
  // The highlighted row, or -1 for none.
  const [active, setActive] = useState(-1);

  // A Trie walk: cheap enough for every keystroke (docs/16 §5).
  const suggestions = useMemo(() => autocomplete(index, value), [index, value]);
  const showList = open && value !== "" && suggestions.length > 0;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function handleChange(next: string) {
    onChange(next);
    setActive(-1);
    // Emptying the box closes the list; typing opens it.
    setOpen(next !== "");
  }

  function pick(c: Completion) {
    onChange(applyCompletion(value, c));
    close();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // While an input method (Japanese, Chinese, some phone keyboards) is still
    // composing a word, Enter, Tab and the arrows belong to it — Enter confirms
    // the composed text. Picking or searching then would act on half a word.
    if (e.nativeEvent.isComposing) return;
    const count = suggestions.length;
    if (e.key === "ArrowDown" && count > 0 && value !== "") {
      e.preventDefault();
      setOpen(true);
      setActive(showList ? (active + 1) % count : 0);
    } else if (e.key === "ArrowUp" && showList) {
      e.preventDefault();
      setActive(active <= 0 ? count - 1 : active - 1);
    } else if ((e.key === "Enter" || e.key === "Tab") && showList && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Enter") {
      close();
      onEnter?.();
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  const optionId = (i: number) => `${listId}-option-${i}`;

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={close}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={className}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
      />
      {/* Always in the page (aria-controls must point at something); empty and
          hidden while closed. */}
      <ul id={listId} role="listbox" aria-label="Search suggestions" className="smart-list" hidden={!showList}>
        {showList && suggestions.map((c, i) => (
          <li
            key={c.text}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            className="smart-option"
            // mousedown would blur the input first and close the list before
            // the click lands; preventDefault keeps the focus in the box.
            onMouseDown={e => e.preventDefault()}
            onClick={() => pick(c)}
          >
            <span className="smart-option-text">{c.text}</span>
            <span className="smart-option-meta">
              {FIELD_NAMES[c.field]} · {c.studies} {c.studies === 1 ? "study" : "studies"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
