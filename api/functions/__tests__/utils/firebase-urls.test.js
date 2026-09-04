import { afterEach, describe, expect, test } from "@jest/globals";
import {
  getFirebaseAppBaseUrl,
  getFunctionsBaseUrl,
  getOAuthWebAppBaseUrl,
} from "../../utils/firebase-urls.js";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
  delete process.env.FIREBASE_APP_BASE_URL;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.FUNCTIONS_EMULATOR;
});

describe("firebase-urls", () => {
  test("prefers FIREBASE_APP_BASE_URL and derives the rest from project id", () => {
    process.env.FIREBASE_APP_BASE_URL = "https://builder.example.com/";
    process.env.FIREBASE_PROJECT_ID = "my-proj";
    expect(getFirebaseAppBaseUrl()).toBe("https://builder.example.com");
    expect(getFunctionsBaseUrl()).toBe(
      "https://us-central1-my-proj.cloudfunctions.net",
    );
  });

  test("derives hosting and functions URLs from FIREBASE_PROJECT_ID", () => {
    process.env.FIREBASE_PROJECT_ID = "my-proj";
    expect(getFirebaseAppBaseUrl()).toBe("https://my-proj.firebaseapp.com");
    expect(getFunctionsBaseUrl()).toBe(
      "https://us-central1-my-proj.cloudfunctions.net",
    );
    expect(getOAuthWebAppBaseUrl()).toBe("https://my-proj.firebaseapp.com");
  });

  test("uses the emulator origin while Functions are emulated", () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.FIREBASE_PROJECT_ID = "my-proj";
    expect(getOAuthWebAppBaseUrl()).toBe("http://localhost:5173");
  });
});
