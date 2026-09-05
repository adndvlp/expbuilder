import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function envFirebaseConfig(): FirebaseConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function isUsableConfig(config: unknown): config is FirebaseConfig {
  return Boolean(
    config &&
      typeof config === "object" &&
      "apiKey" in config &&
      typeof (config as FirebaseConfig).apiKey === "string" &&
      (config as FirebaseConfig).apiKey.length > 0,
  );
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let isInitialized = false;

async function resolveFirebaseConfig(): Promise<FirebaseConfig | null> {
  const isElectron = typeof window !== "undefined" && !!window.electron?.readFirebaseConfig;
  if (isElectron) {
    try {
      const customConfig = await window.electron!.readFirebaseConfig();
      if (isUsableConfig(customConfig)) {
        console.log("Using custom Firebase configuration");
        return customConfig;
      }
      console.log("Firebase is not configured yet");
      return null;
    } catch (error) {
      console.log("Error loading custom Firebase config", error);
      return null;
    }
  }
  return envFirebaseConfig();
}

async function initializeFirebase() {
  /* v8 ignore start -- module-private re-entry guard; initPromise invokes this once per module instance. */
  if (isInitialized) return { app, auth, db };
  /* v8 ignore stop */

  const firebaseConfig = await resolveFirebaseConfig();
  if (!firebaseConfig) {
    isInitialized = true;
    app = undefined;
    auth = undefined;
    db = undefined;
    return { app, auth, db };
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  if (import.meta.env.DEV) {
    import("firebase/auth").then(({ connectAuthEmulator }) => {
      try {
        if (auth) connectAuthEmulator(auth, "http://localhost:9099");
      } catch {
        // Emulator might not be running
      }
    });
    import("firebase/firestore").then(({ connectFirestoreEmulator }) => {
      try {
        if (db) connectFirestoreEmulator(db, "localhost", 8080);
      } catch {
        // Emulator might not be running
      }
    });
  }

  isInitialized = true;
  return { app, auth, db };
}

let initPromise = initializeFirebase();

export const getFirebaseApp = () => initPromise.then(({ app }) => app);
export const getFirebaseAuth = () => initPromise.then(({ auth }) => auth);
export const getFirebaseDb = () => initPromise.then(({ db }) => db);

initPromise.then(({ app: nextApp, auth: nextAuth, db: nextDb }) => {
  app = nextApp;
  auth = nextAuth;
  db = nextDb;
});

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  getFirebaseAuth().then((firebaseAuth) => {
    if (cancelled) return;
    if (!firebaseAuth) {
      callback(null);
      return;
    }
    unsubscribe = onAuthStateChanged(firebaseAuth, callback);
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export { auth, db, app };
