import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./shared";

/**
 * "Are you sure?" before something that cannot be taken back (signing out,
 * deleting a study). Cancel is focused, so Enter never confirms by accident;
 * Escape, the backdrop and Cancel all cancel. The confirm button is red.
 * Pass a stable onCancel (useCallback), or the Escape listener is re-added
 * on every render.
 */
export function ConfirmDialog({ icon, title, detail, description, confirmLabel, onConfirm, onCancel }: {
  icon: IconName;
  title: string;
  /** Optional bold line under the title, e.g. the study being deleted. */
  detail?: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  // Focus the safe choice once, when the dialog opens.
  useEffect(() => { cancelBtn.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay confirm-overlay">
      <div onClick={onCancel} className="modal-backdrop" />
      <div className="animate-slide-up-modal confirm-box" role="alertdialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={descId}>
        <div className="confirm-icon"><Icon name={icon} size={20} /></div>
        <h2 className="confirm-title" id={titleId}>{title}</h2>
        {detail && <p className="confirm-detail">{detail}</p>}
        <p className="confirm-desc" id={descId}>{description}</p>
        <div className="confirm-actions">
          <button ref={cancelBtn} onClick={onCancel} className="btn btn-outline-green confirm-btn">Cancel</button>
          <button onClick={onConfirm} className="btn confirm-btn confirm-btn-danger">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
