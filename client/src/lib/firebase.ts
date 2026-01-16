import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Configuración por defecto
const defaultConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Variables para la app inicializada
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let isInitialized = false;

// Función para inicializar Firebase
async function initializeFirebase() {
  if (isInitialized) return { app, auth, db };

  let firebaseConfig = defaultConfig;

  // En Electron, intentar cargar config personalizada
  const isElectron = !!window.electron?.readFirebaseConfig;
  if (isElectron) {
    try {
      const customConfig = await window.electron!.readFirebaseConfig();
      if (customConfig && customConfig.apiKey) {
        console.log("Using custom Firebase configuration");
        firebaseConfig = customConfig;
      } else {
        console.log("Using default Firebase configuration");
      }
    } catch (e) {
      console.log("Error loading custom Firebase config, using default", e);
    }
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Conectar a emuladores locales en desarrollo
  if (import.meta.env.DEV) {
    // Auth Emulator
    import("firebase/auth").then(({ connectAuthEmulator }) => {
      try {
        connectAuthEmulator(auth, "http://localhost:9099");
      } catch {
        // Emulator might not be running
      }
    });
    // Firestore Emulator
    import("firebase/firestore").then(({ connectFirestoreEmulator }) => {
      try {
        connectFirestoreEmulator(db, "localhost", 8080);
      } catch {
        // Emulator might not be running
      }
    });
  }

  isInitialized = true;
  return { app, auth, db };
}

// Inicializar inmediatamente
const initPromise = initializeFirebase();

// Exportar una promesa que se resuelve con los objetos inicializados
export const getFirebaseApp = () => initPromise.then(({ app }) => app);
export const getFirebaseAuth = () => initPromise.then(({ auth }) => auth);
export const getFirebaseDb = () => initPromise.then(({ db }) => db);

// Para compatibilidad, exportar también de forma síncrona (se inicializarán después)
initPromise.then(({ app: _app, auth: _auth, db: _db }) => {
  app = _app;
  auth = _auth;
  db = _db;
});

// Exportaciones síncronas que estarán disponibles después de la inicialización
export { auth, db, app };
