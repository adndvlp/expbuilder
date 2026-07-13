import { afterEach, beforeEach, vi } from "vitest";

import { auth } from "../../../lib/firebase";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
  authUser: null as { uid: string; email: string } | null,
  unsubscribe: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
  };
});

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    signOut: vi.fn(),
  })),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(mocks.authUser);
    return mocks.unsubscribe;
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
}));

vi.mock("../../../pages/Settings/GoogleDrive/GoogleDriveToken", () => ({
  default: () => <div data-testid="google-drive-token">Google Drive</div>,
}));

vi.mock("../../../pages/Settings/Dropbox/DropboxToken", () => ({
  default: () => <div data-testid="dropbox-token">Dropbox</div>,
}));

vi.mock("../../../pages/Settings/Github/GithubToken", () => ({
  default: () => <div data-testid="github-token">GitHub</div>,
}));

vi.mock("../../../pages/Settings/OsfToken", () => ({
  default: () => <div data-testid="osf-token">OSF</div>,
}));

vi.mock("../../../pages/Settings/FirebaseCredentials", () => ({
  default: () => <div data-testid="firebase-credentials">Firebase</div>,
}));

vi.mock("../../../pages/Settings/ChangePassword", () => ({
  default: () => <div data-testid="change-password">Change Password</div>,
}));

vi.mock("../../../pages/Settings/DeleteAccount", () => ({
  default: () => <div data-testid="delete-account">Delete Account</div>,
}));

vi.mock("../../../pages/Settings/ResetAppButton", () => ({
  default: () => <div data-testid="reset-app">Reset App</div>,
}));

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => payload),
    arrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  } as unknown as Response;
}

function installLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  });
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

const originalLocation = window.location;

function registerSettingsShellHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    mocks.authUser = {
      uid: "user-123",
      email: "user@test.dev",
    };
    mocks.searchParams = new URLSearchParams();
    (auth as any).signOut = vi.fn(async () => undefined);
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    }) as unknown as typeof fetch;
    (window as any).electron = {
      saveZipFile: vi.fn(async () => ({ success: true })),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (window as any).electron;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
}

export {
  fetchMock,
  installLocalStorage,
  mocks,
  okJson,
  originalLocation,
  registerSettingsShellHooks,
};
