import { cleanup, fireEvent, screen } from "@testing-library/react";

import { afterEach, beforeEach, expect, vi } from "vitest";

import { openExternal } from "../../../lib/openExternal";

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: null as null | { uid: string; email?: string },
    signOut: vi.fn(),
  },
  db: {},
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  fetchOAuthState: vi.fn(),
  openExternal: vi.fn(),
  navigate: vi.fn(),
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
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

vi.mock("../../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
  };
});

function docSnap(data: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function okJson(payload: unknown, ok = true): Response {
  return {
    ok,
    redirected: false,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function lastOpenedUrl(): URL {
  const rawUrl = vi.mocked(openExternal).mock.calls.at(-1)?.[0];
  expect(rawUrl).toBeTruthy();
  return new URL(rawUrl as string);
}

async function fillOsfManualForm() {
  fireEvent.click(await screen.findByText("Use Personal Access Token instead"));
  fireEvent.click(screen.getByRole("button", { name: "Enter Manual Token" }));
  fireEvent.change(
    screen.getByPlaceholderText("Parent Project ID (e.g., abc12)"),
    {
      target: { value: "abc12" },
    },
  );
  fireEvent.change(screen.getByPlaceholderText("Paste your OSF token here"), {
    target: { value: "osf-token" },
  });
}

const originalLocation = window.location;

function stubLocation() {
  const location = { href: "http://localhost/" };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: location,
  });
  return location;
}

function registerSettingsOAuthTokensHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    delete (window as any).electron;
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.searchParams = new URLSearchParams();
    mocks.getDoc.mockResolvedValue(docSnap({}));
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.fetchOAuthState.mockResolvedValue("signed-state-123");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okJson({ success: true })),
    );
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    cleanup();
    mocks.auth.currentUser = null;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
}

function registerSettingsOAuthCallbackPagesHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mocks.auth.currentUser = { uid: "user-123", email: "user@test.dev" };
    mocks.searchParams = new URLSearchParams();
    mocks.getDoc.mockResolvedValue(
      docSnap({ osfTokens: { access_token: "ok" } }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
}

export {
  docSnap,
  fillOsfManualForm,
  lastOpenedUrl,
  mocks,
  okJson,
  originalLocation,
  registerSettingsOAuthCallbackPagesHooks,
  registerSettingsOAuthTokensHooks,
  stubLocation,
};
