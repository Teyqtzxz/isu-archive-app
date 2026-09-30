// Firebase app, auth and Firestore handles. Owned by A (docs/10 §2).
//
// PLACEHOLDER CONFIG. Step 03 §1 creates the Firebase project; paste the real
// firebaseConfig from the console over the REPLACE_ME values below. The web
// config is public by design and is committed (docs/03 §3) — the security
// boundary is firestore.rules, not this file.
//
// initializeApp() does not contact the network, so the placeholders are safe
// until the first auth or Firestore call — and nothing calls either yet.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "isu-thesis-archive.firebaseapp.com",
  projectId: "isu-thesis-archive",
  storageBucket: "isu-thesis-archive.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
