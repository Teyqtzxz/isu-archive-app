import { ConfirmDialog } from "./ConfirmDialog";

/** "Are you sure?" before signing out, so a stray tap on Sign Out does not
 *  end the session. Escape, the backdrop and Cancel all keep the user signed in. */
export function SignOutDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <ConfirmDialog
      icon="logout"
      title="Sign out?"
      description="You will need to sign in with your ISU Google account again to use the e-library."
      confirmLabel="Sign Out"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
