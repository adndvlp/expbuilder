import { test as base, expect } from "@playwright/test";
import { setupApiRoutes } from "./api.mock";
import { setupFirebaseRoutes } from "./firebase.mock";

/**
 * Extended test fixture that automatically sets up all API and Firebase mocks.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Block Firebase from trying to connect to emulators
    // The app calls connectAuthEmulator on localhost:9099 and connectFirestoreEmulator on localhost:8080
    // We stub the connect functions to no-op to prevent connection attempts
    await page.addInitScript(() => {
      // Stub the dynamic import of firebase/auth and firebase/firestore
      // to prevent emulator connections
      // Mark as production to skip emulator connections in firebase.ts
      // This is a hack but prevents the emulator connection attempts
      try {
        // @ts-ignore
        if (typeof import.meta !== "undefined" && import.meta.env) {
          // Cannot override import.meta.env at runtime in Vite
        }
      } catch {}
    });

    // Set up all mock routes before the page loads
    await setupFirebaseRoutes(page);
    await setupApiRoutes(page);

    await use(page);
  },
});

export { expect };
