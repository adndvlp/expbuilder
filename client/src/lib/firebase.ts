import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Reemplaza estos valores con los de tu proyecto Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Conectar a emuladores locales en desarrollo
if (import.meta.env.DEV) {
  // Auth Emulator
  import("firebase/auth").then(({ connectAuthEmulator }) => {
    try {
      connectAuthEmulator(auth, "http://localhost:9099");
    } catch (e) {}
  });
  // Firestore Emulator
  import("firebase/firestore").then(({ connectFirestoreEmulator }) => {
    try {
      connectFirestoreEmulator(db, "localhost", 8080);
    } catch (e) {}
  });
}
