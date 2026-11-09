// Create account, then the verification email (errata #84). Pure: Firebase is
// passed in by data.ts, so verifySend.check.ts can run it on fake data.
//
// Firebase signs the new user in as soon as the account exists, so App.tsx
// may already show "Check your ISU inbox" before the email is sent. A failed
// send therefore cannot be thrown back to the Create account form (it may be
// gone); it is put in a SendFailureBox that the inbox screen listens to, so
// that screen shows the error and offers Resend at once.

export type SendFailureBox = {
  /** The email could not be sent: tell the listeners (now and later). */
  report(err: unknown): void;
  /** A new account, a sent email or a sign-out: nothing to show any more. */
  clear(): void;
  /** Called at once if a failure is already waiting, then on every report. */
  subscribe(listener: (err: unknown) => void): () => void;
};

export function createSendFailureBox(): SendFailureBox {
  let waiting: { err: unknown } | null = null;
  const listeners = new Set<(err: unknown) => void>();
  return {
    report(err) {
      waiting = { err };
      for (const l of listeners) l(err);
    },
    clear() {
      waiting = null;
    },
    subscribe(listener) {
      listeners.add(listener);
      if (waiting) listener(waiting.err);
      return () => { listeners.delete(listener); };
    },
  };
}

/**
 * The account is created first; a failure there is thrown (the form shows it).
 * After that nothing throws: a failed name is only logged, and a failed
 * verification email is logged AND reported to the box, because without it
 * the user would wait for an email that never comes.
 */
export async function createAccountThenVerify<U>(steps: {
  create: () => Promise<U>;
  setName: (user: U) => Promise<void>;
  sendVerification: (user: U) => Promise<void>;
  box: SendFailureBox;
  warn: (what: string, err: unknown) => void;
}): Promise<U> {
  steps.box.clear();
  const user = await steps.create();
  await steps.setName(user).catch((err: unknown) => steps.warn("could not save the name", err));
  await steps.sendVerification(user).catch((err: unknown) => {
    steps.warn("could not send the verification email", err);
    steps.box.report(err);
  });
  return user;
}
