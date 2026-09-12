import { describe, expect, it } from "vitest";
import { resolvePublicFirebaseConfig } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/resolvePublicFirebaseConfig";

const FULL_ENV = {
  VITE_FIREBASE_API_KEY: "env-key",
  VITE_FIREBASE_AUTH_DOMAIN: "env.firebaseapp.com",
  VITE_FIREBASE_DATABASE_URL: "https://env-default-rtdb.firebaseio.com",
  VITE_FIREBASE_PROJECT_ID: "env-proj",
  VITE_FIREBASE_STORAGE_BUCKET: "env.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "111",
  VITE_FIREBASE_APP_ID: "1:111:web:aaa",
};

const ACTIVE = {
  apiKey: "active-key",
  authDomain: "active.firebaseapp.com",
  projectId: "active-proj",
  storageBucket: "active.appspot.com",
  messagingSenderId: "222",
  appId: "1:222:web:bbb",
};

describe("resolvePublicFirebaseConfig", () => {
  it("prefers the active backend over the build env", () => {
    expect(resolvePublicFirebaseConfig(FULL_ENV, ACTIVE)).toEqual({
      apiKey: "active-key",
      authDomain: "active.firebaseapp.com",
      databaseURL: "https://env-default-rtdb.firebaseio.com",
      projectId: "active-proj",
      storageBucket: "active.appspot.com",
      messagingSenderId: "222",
      appId: "1:222:web:bbb",
    });
  });

  it("falls back to the build env without an active backend", () => {
    expect(resolvePublicFirebaseConfig(FULL_ENV, null)).toEqual({
      apiKey: "env-key",
      authDomain: "env.firebaseapp.com",
      databaseURL: "https://env-default-rtdb.firebaseio.com",
      projectId: "env-proj",
      storageBucket: "env.appspot.com",
      messagingSenderId: "111",
      appId: "1:111:web:aaa",
    });
  });

  it("derives databaseURL from the project only when missing", () => {
    const { databaseURL, projectId } = resolvePublicFirebaseConfig(
      { ...FULL_ENV, VITE_FIREBASE_DATABASE_URL: "" },
      ACTIVE,
    );
    expect(projectId).toBe("active-proj");
    expect(databaseURL).toBe("https://active-proj-default-rtdb.firebaseio.com");
  });

  it("leaves databaseURL undefined with neither baked value nor project", () => {
    expect(
      resolvePublicFirebaseConfig({}, null).databaseURL,
    ).toBeUndefined();
  });

  it("treats blank strings as missing", () => {
    const resolved = resolvePublicFirebaseConfig(
      { VITE_FIREBASE_API_KEY: "   ", VITE_FIREBASE_PROJECT_ID: "env-proj" },
      null,
    );
    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.projectId).toBe("env-proj");
  });
});
