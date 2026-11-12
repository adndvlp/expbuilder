import type { Page } from "@playwright/test";

export async function setupApiEnvironmentRoutes(page: Page) {
  // --- Firebase Auth Emulator ---
  await page.route("**/localhost:9099/**", async (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON() || {};

    if (url.includes("signInWithPassword")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#VerifyPasswordResponse",
          localId: "test-user-123",
          email: body.email || "test@example.com",
          displayName: "",
          idToken: "eyJhbGciOiJSUzI1NiJ9.mock-token",
          registered: true,
          refreshToken: "mock-refresh-token",
          expiresIn: "3600",
        }),
      });
    } else if (url.includes("signUp")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#SignupNewUserResponse",
          idToken: "eyJhbGciOiJSUzI1NiJ9.mock-token",
          email: body.email || "test@example.com",
          refreshToken: "mock-refresh-token",
          expiresIn: "3600",
          localId: "new-user-456",
        }),
      });
    } else if (url.includes("getAccountInfo")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "identitytoolkit#GetAccountInfoResponse",
          users: [
            {
              localId: "test-user-123",
              email: "test@example.com",
              emailVerified: true,
              providerUserInfo: [],
            },
          ],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }
  });

  // --- Firestore Emulator ---
  await page.route("**/localhost:8080/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // --- Socket.IO ---
  await page.route("**/socket.io/**", async (route) => {
    await route.abort();
  });
}
