// Examples for auth.ts. Run with:  node src/auth.check.ts
// (Node 22.18+ runs TypeScript directly; nothing to install.)
// Every line prints PASS or FAIL; the run ends with a non-zero exit on any FAIL.
import {
  AUTH_MSG, PASSWORD_MIN, SLOW_WAIT_MS, authErrorCode, authErrorMessage, checkConfirm, checkEmail, checkFullName,
  checkNewPassword, checkPassword, isIsuEmail, maskEmail, messageFor, passwordRules, toIsuEmail,
} from "./auth.ts";
import { MSG as FORM_MSG, type Checked } from "./validation.ts";

let failed = 0;
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      got:  ${g}${ok ? "" : `\n      want: ${w}`}`);
}
const saved = (value: string): Checked => ({ value, error: null });
const err = (value: string, error: string): Checked => ({ value, error });
/** The labels of the rules a password does not meet yet. */
const missing = (typed: string) => passwordRules(typed).filter(r => !r.ok).map(r => r.label);
const LEN = `At least ${PASSWORD_MIN} characters`;

console.log("— Username → ISU email —");
check("username gets the ISU domain", toIsuEmail("juan.delacruz"), "juan.delacruz@isu.edu.ph");
check("spaces and capitals", toIsuEmail("  Juan.DelaCruz "), "juan.delacruz@isu.edu.ph");
check("full address kept, lowercased", toIsuEmail("Juan.DelaCruz@ISU.edu.ph"), "juan.delacruz@isu.edu.ph");
check("blank stays blank", toIsuEmail("   "), "");

console.log("\n— ISU only —");
check("ISU address", checkEmail("juan.delacruz@isu.edu.ph"), saved("juan.delacruz@isu.edu.ph"));
check("username only", checkEmail("juan.delacruz"), saved("juan.delacruz@isu.edu.ph"));
check("Gmail rejected", checkEmail("juan@gmail.com"), err("juan@gmail.com", AUTH_MSG.notIsu));
check("a subdomain is not ISU", checkEmail("juan@mail.isu.edu.ph"), err("juan@mail.isu.edu.ph", AUTH_MSG.notIsu));
check("look-alike domain rejected", checkEmail("juan@isu.edu.ph.evil.com"), err("juan@isu.edu.ph.evil.com", AUTH_MSG.notIsu));
check("blank", checkEmail(""), err("", AUTH_MSG.emailRequired));
check("space inside", checkEmail("juan dela cruz"), err("juan dela cruz@isu.edu.ph", AUTH_MSG.emailFormat));
check("nothing after @", checkEmail("juan@"), err("juan@", AUTH_MSG.emailFormat));
check("two @", checkEmail("a@b@isu.edu.ph"), err("a@b@isu.edu.ph", AUTH_MSG.emailFormat));
check("isIsuEmail ignores case", isIsuEmail("A@ISU.EDU.PH"), true);
check("isIsuEmail null", isIsuEmail(null), false);

console.log("\n— Passwords —");
check("sign in: blank", checkPassword(""), AUTH_MSG.passwordRequired);
check("sign in: any length is sent (no hint)", checkPassword("abc"), null);
check("sign in: an older password still passes", checkPassword("abcd1234"), null);
check("new: blank", checkNewPassword(""), AUTH_MSG.newPasswordRequired);
check("new: meets every rule", checkNewPassword("Abcd123!"), null);
check("new: 8 letters and numbers are NOT enough", checkNewPassword("abcd1234"), AUTH_MSG.passwordShort);
check(`new: ${PASSWORD_MIN - 1} is too short`, checkNewPassword("Abcd12!"), AUTH_MSG.passwordShort);
check("new: no uppercase", checkNewPassword("abcd123!"), AUTH_MSG.passwordShort);
check("new: no lowercase", checkNewPassword("ABCD123!"), AUTH_MSG.passwordShort);
check("new: no number", checkNewPassword("Abcdefg!"), AUTH_MSG.passwordShort);
check("new: no symbol", checkNewPassword("Abcd1234"), AUTH_MSG.passwordShort);
check("rules: only the length is missing", missing("Abcd12!"), [LEN]);
check("rules: only uppercase is missing", missing("abcd123!"), ["An uppercase letter"]);
check("rules: only lowercase is missing", missing("ABCD123!"), ["A lowercase letter"]);
check("rules: only the number is missing", missing("Abcdefg!"), ["A number"]);
check("rules: only the symbol is missing", missing("Abcd1234"), ["A symbol"]);
check("rules: blank misses all five", missing("").length, 5);
check("rules: a good password misses none", missing("Abcd123!"), []);
check("rules: checklist order and words", passwordRules("").map(r => r.label),
  [LEN, "An uppercase letter", "A lowercase letter", "A number", "A symbol"]);
check("new: spaces count towards the length", checkNewPassword("  Ab1!  "), null);
check("new: nothing trimmed (7 + a space is 8)", checkNewPassword("Abcd12! "), null);
check("new: a space is not a symbol", checkNewPassword("Abcd 123"), AUTH_MSG.passwordShort);
check("new: other spaces are not symbols either", missing("Abcd\u00a0123\t"), ["A symbol"]);
check("new: an emoji is one character (7, though 8 in UTF-16)", missing("Abc12😀!"), [LEN]);
check("new: an emoji is a symbol", checkNewPassword("Abcd123😀"), null);
check("new: Ñ is an uppercase letter", missing("Ñandu123!"), []);
check("new: ñ is a lowercase letter", missing("ANDUñ123!"), []);
check("new: an accent mark is part of its letter, not a symbol", missing("Cafe\u0301 1234"), ["A symbol"]);
check("hint keeps the Gmail note, no rule of length alone", AUTH_MSG.passwordHint, "Not your Gmail password.");
for (const [name, text] of [["passwordShort", AUTH_MSG.passwordShort], ["weakPassword", AUTH_MSG.weakPassword]]) {
  check(`${name} states every rule`,
    [`at least ${PASSWORD_MIN} characters`, "uppercase", "lowercase", "number", "symbol"].every(w => text.includes(w)), true);
}

console.log("\n— Slow sign-in message —");
check("15 seconds", SLOW_WAIT_MS, 15_000);
check("agreed wording", AUTH_MSG.slowWait, "This is taking longer than usual. Check your internet connection.");

console.log("\n— Confirm password —");
check("match", checkConfirm("abcd1234", "abcd1234"), null);
check("mismatch", checkConfirm("abcd1234", "abcd1235"), "The passwords don't match.");
check("case matters", checkConfirm("Abcd1234", "abcd1234"), AUTH_MSG.mismatch);
check("a trailing space matters", checkConfirm("abcd1234", "abcd1234 "), AUTH_MSG.mismatch);
check("blank confirm", checkConfirm("abcd1234", ""), AUTH_MSG.confirmRequired);

console.log("\n— Full name (author-name rules) —");
check("full name", checkFullName("Juan Dela Cruz"), saved("Juan Dela Cruz"));
check("lowercase gets capitals", checkFullName("juan dela cruz"), saved("Juan Dela Cruz"));
check("comma form", checkFullName("Dela Cruz, Juan"), saved("Dela Cruz, Juan"));
check("ñ and accents", checkFullName("José Peña"), saved("José Peña"));
check("blank", checkFullName("  "), err("", AUTH_MSG.nameRequired));
check("one word", checkFullName("Maria"), err("Maria", AUTH_MSG.nameFull));
check("surname with particle alone", checkFullName("Dela Cruz"), err("Dela Cruz", AUTH_MSG.nameFull));
check("digit rejected (form message)", checkFullName("Juan Cruz 2"), err("Juan Cruz 2", FORM_MSG.nameChars));

console.log("\n— Masked email —");
check("mask", maskEmail("juan.delacruz@isu.edu.ph"), "j•••@isu.edu.ph");
check("no @ kept", maskEmail("juan"), "juan");

console.log("\n— Firebase error codes → words —");
check("wrong password", authErrorMessage("auth/invalid-credential", "sign-in"), "Email or password is incorrect.");
check("unknown email: SAME words", authErrorMessage("auth/user-not-found", "sign-in"), AUTH_MSG.wrongCredentials);
check("old wrong-password code: same", authErrorMessage("auth/wrong-password", "sign-in"), AUTH_MSG.wrongCredentials);
check("too many sign-ins", authErrorMessage("auth/too-many-requests", "sign-in"), AUTH_MSG.tooManySignIn);
check("too many emails", authErrorMessage("auth/too-many-requests", "email"), AUTH_MSG.tooManyEmails);
check("already has an account", authErrorMessage("auth/email-already-in-use", "create"), AUTH_MSG.emailInUse);
check("weak password", authErrorMessage("auth/weak-password", "create"), AUTH_MSG.weakPassword);
check("console password policy", authErrorMessage("auth/password-does-not-meet-requirements", "new-password"), AUTH_MSG.weakPassword);
check("provider off", authErrorMessage("auth/operation-not-allowed", "sign-in"), AUTH_MSG.passwordOff);
check("closing the Google window is silent", authErrorMessage("auth/popup-closed-by-user", "google"), null);
check("expired link", authErrorMessage("auth/expired-action-code", "new-password"), AUTH_MSG.badLink);
check("unknown code: generic", authErrorMessage("auth/something-new", "sign-in"), AUTH_MSG.failed);
check("code from an error object", authErrorCode({ code: "auth/invalid-credential" }), "auth/invalid-credential");
check("not an auth code", authErrorCode({ code: "permission-denied" }), "");
check("data.ts's own message kept", messageFor(new Error("Please sign in with your ISU Google account (@isu.edu.ph)."), "google"),
  "Please sign in with your ISU Google account (@isu.edu.ph).");
check("Firebase error mapped", messageFor({ code: "auth/network-request-failed", message: "Firebase: Error (auth/network-request-failed)." }, "sign-in"), AUTH_MSG.offline);
check("a thrown string", messageFor("oops", "sign-in"), AUTH_MSG.failed);

console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
if (failed) process.exit(1);
