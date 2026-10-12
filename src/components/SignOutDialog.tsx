import { useEffect, useRef } from "react";
import { Icon } from "./shared";

/** "Are you sure?" before signing out, so a stray tap on Sign Out does not
 *  end the session. Escape, the backdrop and Cancel all keep the user signed in. */
export function SignOutDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe choice, so Enter does not sign out by accident.
    cancelBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="modal-overlay confirm-overlay">
      <div onClick={onCancel} className="modal-backdrop" />
      <div className="animate-slide-up-modal confirm-box" role="alertdialog" aria-modal="true"
        aria-labelledby="signout-title" aria-describedby="signout-desc">
        <div className="confirm-icon"><Icon name="logout" size={20} /></div>
        <h2 className="confirm-title" id="signout-title">Sign out?</h2>
        <p className="confirm-desc" id="signout-desc">You will need to sign in with your ISU Google account again to use the e-library.</p>
        <div className="confirm-actions">
          <button ref={cancelBtn} onClick={onCancel} className="btn btn-outline-green confirm-btn">Cancel</button>
          <button onClick={onConfirm} className="btn confirm-btn confirm-btn-danger">Sign Out</button>
        </div>
      </div>
    </div>
  );
}
