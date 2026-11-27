/**
 * SDD-EXP-OAUTH-001 · integración OAuth real (token-service + refresh con
 * HTTP simulado) hasta la frontera del adaptador de exportación, sin mocks
 * del servicio de tokens. Cubre el requisito del revisor: "al menos un
 * escenario que utilice el servicio OAuth real con HTTP simulado".
 */
import { jest } from "@jest/globals";
import fetchMock from "../helpers/fetch-mock.js";
import { makeTransactionalFirestore } from "../helpers/transactional-firestore.js";

process.env.GOOGLE_DRIVE_CLIENT_ID = "test-google-client";
process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-google-secret";
process.env.DROPBOX_CLIENT_ID = "test-dropbox-client";
process.env.DROPBOX_CLIENT_SECRET = "test-dropbox-secret";

const store = makeTransactionalFirestore();

jest.unstable_mockModule("../../app.js", () => ({ db: store.db, app: {} }));
jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (_options, handler) => handler,
}));
jest.unstable_mockModule("firebase-admin/database", () => ({ getDatabase: () => ({}) }));

const { createExportAdapter } = await import("../../experiment/sessions/export/providers/index.js");

const destination = { provider: "googledrive", owner: "u1", folder: "/f", name: "n.csv" };

beforeEach(() => {
  store.reset();
  fetchMock.__reset();
});

describe("OAuth service real (HTTP simulado) → adapter boundary", () => {
  test("transient 503 upstream → OAUTH_TEMPORARY → export 503 retryable", async () => {
    store.records.set("users/u1", {
      googleDriveTokens: { access_token: "old", refresh_token: "rf", expires_at: Date.now() - 1000 },
    });
    fetchMock.__setMockResponses([{ status: 503, body: null }]);

    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: "OAUTH_TEMPORARY",
    });
    // No se persistió ningún token inválido.
    expect(store.records.get("users/u1").googleDriveTokens.access_token).toBe("old");
  });

  test("invalid_grant upstream → OAUTH_REAUTH_PENDING retryable (no permanente a la primera)", async () => {
    store.records.set("users/u1", {
      googleDriveTokens: { access_token: "old", refresh_token: "rf", expires_at: Date.now() - 1000 },
    });
    fetchMock.__setMockResponses([
      { status: 400, body: { error: "invalid_grant", error_description: "revoked" } },
    ]);

    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: "OAUTH_REAUTH_PENDING",
    });
  });

  test("refresh success with rotated token persists via CAS and builds the adapter", async () => {
    store.records.set("users/u1", {
      googleDriveTokens: { access_token: "old", refresh_token: "rf-old", expires_at: Date.now() - 1000 },
    });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "new-at", refresh_token: "rf-rotated", expires_in: 3600 } },
    ]);

    const adapter = await createExportAdapter(destination);
    expect(adapter).toHaveProperty("write");
    const stored = store.records.get("users/u1").googleDriveTokens;
    expect(stored.access_token).toBe("new-at");
    expect(stored.refresh_token).toBe("rf-rotated");
    expect(stored.expires_at).toBeGreaterThan(Date.now() + 3500 * 1000);
  });

  test("Firestore initial read failure (numeric code 14) → TOKEN_STORE_TEMPORARY → export 503 retryable", async () => {
    store.records.set("users/u1", {
      googleDriveTokens: { access_token: "old", refresh_token: "rf", expires_at: Date.now() - 1000 },
    });
    store.failNextGetOf("users/u1", Object.assign(new Error("db down"), { code: 14 }));

    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: "TOKEN_STORE_TEMPORARY",
    });
  });

  test("boolean expires_in upstream is rejected as OAUTH_INVALID_RESPONSE", async () => {
    store.records.set("users/u1", {
      googleDriveTokens: { access_token: "old", refresh_token: "rf", expires_at: Date.now() - 1000 },
    });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "new-at", expires_in: true } },
    ]);

    await expect(createExportAdapter(destination)).rejects.toMatchObject({
      status: 503,
      retryable: true,
      code: "OAUTH_INVALID_RESPONSE",
    });
    expect(store.records.get("users/u1").googleDriveTokens.access_token).toBe("old");
  });
});
