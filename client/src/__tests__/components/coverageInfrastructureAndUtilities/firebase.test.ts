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
      onAuthStateChanged: vi.fn(),
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
    vi.doMock("firebase/auth", () => ({
      getAuth,
      onAuthStateChanged: vi.fn(),
      connectAuthEmulator,
    }));
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

  it("does not initialize Firebase when Electron has no saved api key", async () => {
    const initializeApp = vi.fn();

    vi.doUnmock("../../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(),
      onAuthStateChanged: vi.fn(),
      connectAuthEmulator: vi.fn(),
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(),
      connectFirestoreEmulator: vi.fn(),
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => ({})),
    };

    const firebase = await import("../../../lib/firebase");

    await expect(firebase.getFirebaseApp()).resolves.toBeUndefined();
    await expect(firebase.getFirebaseAuth()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Firebase is not configured yet");
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("does not initialize Firebase when Electron config loading fails", async () => {
    const initializeApp = vi.fn();
    const error = new Error("read failed");

    vi.doUnmock("../../../lib/firebase");
    vi.doMock("firebase/app", () => ({ initializeApp }));
    vi.doMock("firebase/auth", () => ({
      getAuth: vi.fn(),
      onAuthStateChanged: vi.fn(),
      connectAuthEmulator: vi.fn(),
    }));
    vi.doMock("firebase/firestore", () => ({
      getFirestore: vi.fn(),
      connectFirestoreEmulator: vi.fn(),
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => {
        throw error;
      }),
    };

    const firebase = await import("../../../lib/firebase");

    await expect(firebase.getFirebaseAuth()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "Error loading custom Firebase config",
      error,
    );
    expect(initializeApp).not.toHaveBeenCalled();
  });
});
