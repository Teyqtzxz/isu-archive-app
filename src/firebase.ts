// Firebase app, auth and Firestore handles. Owned by A (docs/10 §2).
//
// The web config is public by design and is committed on purpose (docs/03 §3,
// docs/10 §3) — every browser downloads it anyway. The security boundary is
// firestore.rules, not this file.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC3RM6qnEQbdObmYVnktagihqshHbP6qsw",
  authDomain: "isu-archive-9253b.firebaseapp.com",
  projectId: "isu-archive-9253b",
  storageBucket: "isu-archive-9253b.firebasestorage.app",
  messagingSenderId: "465848464073",
  appId: "1:465848464073:web:bc2d3890ebe3c32d059318",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
