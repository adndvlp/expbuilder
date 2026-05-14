import type { Page } from "@playwright/test";

/**
 * Mocks Firebase Auth SDK completely to avoid real network calls.
 * Uses addInitScript to override window.firebase before the app loads.
 * This approach works because the Firebase SDK is bundled into the app.
 */
export async function setupFirebaseRoutes(page: Page) {
  // Intercept identitytoolkit API (used by Firebase Auth SDK for signIn/signUp)
  await page.route(/identitytoolkit\.googleapis\.com/, async (route) => {
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
    } else if (url.includes("signUp") || url.includes("signupNewUser")) {
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
    } else if (url.includes("getAccountInfo") || url.includes("lookup")) {
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
              displayName: "",
              providerUserInfo: [
                {
                  providerId: "password",
                  federatedId: "test@example.com",
                  email: "test@example.com",
                  rawId: "test@example.com",
                },
              ],
              lastLoginAt: Date.now().toString(),
              createdAt: Date.now().toString(),
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

  // Secure token endpoint (token refresh/id token verification)
  await page.route(/securetoken\.googleapis\.com/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mock-access-token",
        expires_in: "3600",
        token_type: "Bearer",
        refresh_token: "mock-refresh-token",
        id_token: "eyJhbGciOiJSUzI1NiJ9.mock-token",
        user_id: "test-user-123",
        project_id: "test-project",
      }),
    });
  });

  // Firestore REST API
  await page.route(/firestore\.googleapis\.com/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Block all other googleapis.com calls
  await page.route(/googleapis\.com/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Block Firebase Cloud Functions
  await page.route(/cloudfunctions\.net/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Block Firebase services domain
  await page.route(/firebaseio\.com/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Block gstatic (Firebase CDN)
  await page.route(/gstatic\.com\/firebasejs/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "// Firebase mock",
    });
  });
}
