/// <reference types="vite/client" />

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface ElectronAPI {
  openExternal: (url: string) => Promise<void>;
  startOAuthFlow: (config: {
    provider: string;
    clientId: string;
    scope: string;
    state: string;
  }) => Promise<{
    success: boolean;
    code?: string;
    state?: string;
    error?: string;
  }>;
  saveCsvZip: (
    files: Array<{ name: string; content: string }>,
    defaultName: string
  ) => Promise<{ success: boolean; error?: string }>;
  saveJsonFile: (
    content: string,
    defaultName: string
  ) => Promise<{ success: boolean; error?: string }>;
  readFirebaseConfig: () => Promise<FirebaseConfig | null>;
  writeFirebaseConfig: (
    config: FirebaseConfig
  ) => Promise<{ success: boolean; error?: string }>;
  deleteFirebaseConfig: () => Promise<{ success: boolean; error?: string }>;
}

interface Window {
  electron?: ElectronAPI;
}
