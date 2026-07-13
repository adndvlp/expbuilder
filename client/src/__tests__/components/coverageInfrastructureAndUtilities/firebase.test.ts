import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "./testHarness";

describe("coverage infrastructure: firebase module", () => {
  it("initializes the web production build without Electron or emulators", async () => {
    const app = { name: "web-app" };
    const auth = { currentUser: null };
    const db = { app };
    const initializeApp = vi.fn(() => app);
    const connectAuthEmulator = vi.fn();
    const connectFirestoreEmulator = vi.fn();
    vi.stubEnv("DEV", "");
    delete (window as any).electron;
    vi.doUnmock("../../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(() => auth),
      connectAuthEmulator,
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(() => db),
      connectFirestoreEmulator,
    }));

    const firebase = await import("../../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("initializes Firebase from custom Electron credentials and exposes async getters", async () => {
    const app = { name: "custom-app" };
    const auth = { currentUser: null };
    const db = { app };
    const initializeApp = vi.fn(() => app);
    const getAuth = vi.fn(() => auth);
    const getFirestore = vi.fn(() => db);
    const connectAuthEmulator = vi.fn();
    const connectFirestoreEmulator = vi.fn();
    const customConfig = {
      apiKey: "custom-key",
      authDomain: "custom.firebaseapp.com",
      projectId: "custom",
      storageBucket: "custom.appspot.com",
      messagingSenderId: "123",
      appId: "app",
    };

    vi.doUnmock("../../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({ getAuth, connectAuthEmulator }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore,
      connectFirestoreEmulator,
    }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => customConfig),
    };

    const firebase = await import("../../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    await expect(firebase.getFirebaseAuth()).resolves.toBe(auth);
    await expect(firebase.getFirebaseDb()).resolves.toBe(db);
    expect(initializeApp).toHaveBeenCalledWith(customConfig);
    expect(getAuth).toHaveBeenCalledWith(app);
    expect(getFirestore).toHaveBeenCalledWith(app);
    await waitFor(() => {
      expect(connectAuthEmulator).toHaveBeenCalledWith(
        auth,
        "http://localhost:9099",
      );
      expect(connectFirestoreEmulator).toHaveBeenCalledWith(
        db,
        "localhost",
        8080,
      );
    });
  });

  it("falls back to default Firebase config when Electron returns no api key", async () => {
    const app = { name: "default-app" };
    const initializeApp = vi.fn(() => app);

    vi.doUnmock("../../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(() => ({ currentUser: null })),
      connectAuthEmulator: vi.fn(),
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(() => ({ app })),
      connectFirestoreEmulator: vi.fn(),
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => ({})),
    };

    const firebase = await import("../../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    expect(log).toHaveBeenCalledWith("Using default Firebase configuration");
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
  });

  it("falls back to default Firebase config when Electron config loading fails", async () => {
    const app = { name: "fallback-app" };
    const error = new Error("read failed");
    const initializeApp = vi.fn(() => app);

    vi.doUnmock("../../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(() => ({ currentUser: null })),
      connectAuthEmulator: vi.fn(),
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(() => ({ app })),
      connectFirestoreEmulator: vi.fn(),
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => {
        throw error;
      }),
    };

    const firebase = await import("../../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBe(app);
    expect(log).toHaveBeenCalledWith(
      "Error loading custom Firebase config, using default",
      error,
    );
    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key" }),
    );
  });
});
