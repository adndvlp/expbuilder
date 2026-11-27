/**
 * SDD-EXP-OAUTH-001 · T03–T07 · refreshAccessToken classification.
 * Verifies: transient vs permanent OAuth failures, strict TTL validation,
 * rotated refresh token passthrough, no secrets in safe messages.
 */
import { jest } from "@jest/globals";
import fetchMock from "../helpers/fetch-mock.js";

process.env.DROPBOX_CLIENT_ID = "test-dropbox-client";
process.env.DROPBOX_CLIENT_SECRET = "test-dropbox-secret";

jest.unstable_mockModule("../../oauth/token-registry.js", () => ({
  getTokenProvider: () => ({
    tokensFieldName: "dropboxTokens",
    config: {
      clientId: process.env.DROPBOX_CLIENT_ID,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET,
      tokenUrl: "https://api.dropbox.com/oauth2/token",
    },
  }),
}));

const { refreshAccessToken } = await import("../../oauth/refresh.js");

beforeEach(() => fetchMock.__reset());

describe("refreshAccessToken — classification (SDD T04–T07)", () => {
  test("T04: 503 with non-JSON body is transient", async () => {
    fetchMock.__setMockResponses([{ status: 503, body: null }]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_TEMPORARY");
    expect(r.retryable).toBe(true);
    expect(r.httpStatus).toBe(503);
    expect(r.error).toBe("Storage credentials temporarily unavailable");
  });

  test("T04: timeout/network failure is transient", async () => {
    fetchMock.__setMockResponses([
      () => { const error = new Error("Request to https://api.dropbox.com/oauth2/token timed out after 30000ms"); error.code = "ETIMEDOUT"; throw error; },
    ]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_TEMPORARY");
    expect(r.retryable).toBe(true);
  });

  test("T05: invalid_grant is REAUTH_PENDING and retryable (never assumed permanent)", async () => {
    fetchMock.__setMockResponses([
      { status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked" } },
    ]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_REAUTH_PENDING");
    expect(r.retryable).toBe(true);
    expect(r.oauthError).toBe("invalid_grant");
    expect(r.error).toBe("Storage authorization may need to be reconnected");
  });

  test("T05: invalid_client is a permanent configuration error", async () => {
    fetchMock.__setMockResponses([
      { status: 401, body: { error: "invalid_client" } },
    ]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_CONFIGURATION");
    expect(r.retryable).toBe(false);
  });

  test("T06: 2xx without access_token is an invalid response (retryable)", async () => {
    fetchMock.__setMockResponses([{ status: 200, body: { foo: "bar" } }]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_INVALID_RESPONSE");
    expect(r.retryable).toBe(true);
  });

  test("T06: 2xx without a valid expires_in is an invalid response (no invented TTL)", async () => {
    fetchMock.__setMockResponses([{ status: 200, body: { access_token: "at" } }]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_INVALID_RESPONSE");
    expect(r.retryable).toBe(true);
  });

  test("T06: non-2xx responses never yield an access_token", async () => {
    fetchMock.__setMockResponses([
      { status: 400, body: { access_token: "sneaky", expires_in: 3600, error: "bad_request" } },
    ]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_UNKNOWN");
    expect(r.retryable).toBe(true);
  });

  test("T03: rotated refresh token is returned for persistence", async () => {
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "at-new", refresh_token: "rf-rotated", expires_in: 14400 } },
    ]);
    const r = await refreshAccessToken("dropbox", "rf-old");
    expect(r.success).toBe(true);
    expect(r.access_token).toBe("at-new");
    expect(r.expires_in).toBe(14400);
    expect(r.refresh_token).toBe("rf-rotated");
  });

  test("T03: omitted refresh token is not present in the result", async () => {
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "at-new", expires_in: 14400 } },
    ]);
    const r = await refreshAccessToken("dropbox", "rf-old");
    expect(r.success).toBe(true);
    expect(r.refresh_token).toBeUndefined();
  });

  test("T07: missing client configuration fails as OAUTH_CONFIGURATION without an HTTP call", async () => {
    process.env.DROPBOX_CLIENT_ID = "";
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_CONFIGURATION");
    expect(r.retryable).toBe(false);
    expect(fetchMock.__getCalls()).toHaveLength(0);
    process.env.DROPBOX_CLIENT_ID = "test-dropbox-client";
  });

  test("T06: boolean expires_in is rejected (strict type validation)", async () => {
    fetchMock.__setMockResponses([{ status: 200, body: { access_token: "at", expires_in: true } }]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_INVALID_RESPONSE");
  });

  test("T06: array expires_in is rejected (strict type validation)", async () => {
    fetchMock.__setMockResponses([{ status: 200, body: { access_token: "at", expires_in: [3600] } }]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_INVALID_RESPONSE");
  });

  test("T04: every HTTP 5xx is transient, including 501 and 505", async () => {
    for (const status of [501, 505]) {
      fetchMock.__reset();
      fetchMock.__setMockResponses([{ status, body: null }]);
      const r = await refreshAccessToken("dropbox", "rf");
      expect(r.success).toBe(false);
      expect(r.code).toBe("OAUTH_TEMPORARY");
      expect(r.retryable).toBe(true);
      expect(r.httpStatus).toBe(status);
    }
  });

  test("safe messages never leak raw upstream descriptions", async () => {
    fetchMock.__setMockResponses([
      { status: 400, body: { error: "invalid_grant", error_description: "secret-ish detail" } },
    ]);
    const r = await refreshAccessToken("dropbox", "rf");
    expect(JSON.stringify(r)).not.toContain("secret-ish");
  });
});
