import { cleanup } from "@testing-library/react";

import { afterEach, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: { uid: "user-123", email: "user@test.dev" } as null | {
      uid: string;
      email?: string;
    },
  },
  db: {},
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  fetchOAuthState: vi.fn(),
}));

vi.mock("../../../lib/firebase", () => ({
  auth: mocks.auth,
  db: mocks.db,
  app: { name: "test-app" },
  getFirebaseAuth: vi.fn(async () => mocks.auth),
  getFirebaseDb: vi.fn(async () => mocks.db),
  getFirebaseApp: vi.fn(async () => ({ name: "test-app" })),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => mocks.auth),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mocks.auth.currentUser);
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => mocks.db),
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  updateDoc: mocks.updateDoc,
  setDoc: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock("../../../lib/oauthState", () => ({
  fetchOAuthState: mocks.fetchOAuthState,
}));

function docSnap(data: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function okResponse(ok = true, redirected = false): Response {
  return {
    ok,
    redirected,
    json: vi.fn(async () => ({ success: ok })),
  } as unknown as Response;
}

async function loadProviderTokens() {
  const [
    { default: GoogleDriveToken },
    { default: DropboxToken },
    { default: GithubToken },
  ] = await Promise.all([
    import("../../../pages/Settings/GoogleDrive/GoogleDriveToken"),
    import("../../../pages/Settings/Dropbox/DropboxToken"),
    import("../../../pages/Settings/Github/GithubToken"),
  ]);

  return [
    {
      Component: GoogleDriveToken,
      providerArg: "google-drive",
      endpoint: "googleDriveOAuthCallback",
      successAlert: "Google Drive connected successfully!",
    },
    {
      Component: DropboxToken,
      providerArg: "dropbox",
      endpoint: "dropboxOAuthCallback",
      successAlert: "Dropbox connected successfully!",
    },
    {
      Component: GithubToken,
      providerArg: "github",
      endpoint: "githubOAuthCallback",
      successAlert: "GitHub connected successfully!",
    },
  ] as const;
}

function registerSettingsOAuthElectronFlowsHooks() {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okResponse(true)),
    );
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    (window as any).electron = {
      startOAuthFlow: vi.fn(async () => ({
        success: true,
        code: "auth-code",
        state: "signed-state-123",
      })),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    cleanup();
    delete (window as any).electron;
  });
}

export {
  docSnap,
  loadProviderTokens,
  mocks,
  okResponse,
  registerSettingsOAuthElectronFlowsHooks,
};
