import { screen } from "@testing-library/react";

import { afterEach, beforeEach, vi } from "vitest";

import { auth } from "../../../lib/firebase";

import { deleteUser, updatePassword } from "firebase/auth";

import { deleteDoc } from "firebase/firestore";

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
  };
});

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
  })),
  updatePassword: vi.fn(),
  deleteUser: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return vi.fn();
  }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

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

function getLastButton(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  return buttons[buttons.length - 1];
}

function registerSettingsAccountActionsHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    installLocalStorage();
    (auth as any).currentUser = { uid: "user-123", email: "user@test.dev" };
    vi.mocked(updatePassword).mockResolvedValue(undefined);
    vi.mocked(deleteDoc).mockResolvedValue(undefined);
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (auth as any).currentUser = null;
  });
}

export {
  getLastButton,
  installLocalStorage,
  registerSettingsAccountActionsHooks,
  routerMocks,
};
