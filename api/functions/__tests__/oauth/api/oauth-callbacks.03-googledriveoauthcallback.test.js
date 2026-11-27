/**
 * Tests for oauth/callbacks/{dropbox,github,google-drive,osf}.js
 *
 * Shared shape (Dropbox/GitHub/Google Drive):
 *   - OPTIONS preflight → 204
 *   - Missing code or uid → 400 text "Missing code or uid"
 *   - Happy path web → POST token endpoint, save Firestore, res.redirect(settings)
 *   - Happy path Electron (referer localhost:8888) → 200 JSON
 *   - Token error → web redirect to settings?status=error… / Electron 500 JSON
 *
 * OSF differs:
 *   - access_denied → redirect with error
 *   - missing code → 400 JSON
 *   - missing state → 400 JSON
 *   - happy path: fetches token + profile + existing-project filter (reuse or create) + saves tokens
 *   - refreshOSFToken: success and failure
 *   - getOSFAuthorizationUrl: builds URL with all params
 */
import { jest } from "@jest/globals";
import fetchMock from "../../helpers/fetch-mock.js";
import { makeFsMock, makeReq, makeRes } from "../../helpers/firestore-mock.js";

const fs = makeFsMock();

jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (...args) => args[args.length - 1],
}));
jest.unstable_mockModule("../../../app.js", () => ({ db: fs.db, app: {} }));
// T-5: bypass HMAC validation in callback tests. The state-validation
// logic itself has its own unit tests.
const mockValidateOAuthState = jest.fn(() => ({ ok: true, uid: "u1", ts: Date.now() }));
jest.unstable_mockModule("../../../oauth/state-service.js", () => ({
  validateOAuthState: mockValidateOAuthState,
  createOAuthState: jest.fn(() => "mock-state"),
}));

const { dropboxOAuthCallback } = await import("../../../oauth/api/callbacks/dropbox.js");
const { githubOAuthCallback } = await import("../../../oauth/api/callbacks/github.js");
const { googleDriveOAuthCallback } = await import(
  "../../../oauth/api/callbacks/google-drive.js"
);
const {
  osfOAuthCallback,
  refreshOSFToken,
  getOSFAuthorizationUrl,
} = await import("../../../oauth/api/callbacks/osf.js");

beforeEach(() => {
  fs.refsByPath.clear();
  fs.colsByPath.clear();
  fs.db.collection.mockClear();
  // Default user doc for CAS snapshots: no provider tokens yet.
  fs.getRef("users/u1").get.mockResolvedValue({ exists: false, data: () => undefined });
  fetchMock.__reset();
  delete process.env.FUNCTIONS_EMULATOR;
});

// ─── Dropbox ───────────────────────────────────────────────────────────────

describe("googleDriveOAuthCallback", () => {
  test("OPTIONS preflight returns 204", async () => {
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ method: "OPTIONS" }), res);
    expect(res.statusCode).toBe(204);
  });

  test("400 when code or uid missing", async () => {
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c" } }), res);
    expect(res.statusCode).toBe(400);
  });

  test("happy path web → POSTs Google token endpoint, stores googleDriveTokens, redirects", async () => {
    fetchMock.__setMockResponses([
      {
        status: 200,
        body: {
          access_token: "G_AT",
          refresh_token: "G_RT",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "drive.file",
        },
      },
    ]);

    const res = makeRes();
    await googleDriveOAuthCallback(
      makeReq({ query: { code: "c", state: "u1" } }),
      res,
    );

    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=success&service=google-drive/);

    const userRef = fs.getRef("users/u1");
    const [body, opts] = userRef.set.mock.calls[0];
    expect(body.googleDriveTokens.access_token).toBe("G_AT");
    expect(body.googleDriveTokens.expires_at).toBeGreaterThan(Date.now());
    expect(opts).toEqual({ merge: true });

    const calls = fetchMock.__getCalls();
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
  });

  test("happy path Electron → JSON", async () => {
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "x", refresh_token: "G_RT", expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(
      makeReq({
        query: { code: "c", state: "u1" },
        headers: { referer: "http://localhost:8888/" },
      }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.message).toMatch(/Google Drive connected/);
  });

  test("token error → web redirect to error", async () => {
    fetchMock.__setMockResponses([
      { status: 400, body: { error_description: "invalid_grant" } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(
      makeReq({ query: { code: "c", state: "u1" } }),
      res,
    );
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=error&service=google-drive/);
  });

  test("T32: local disconnect landing between the callback snapshot and the CAS write does not restore credentials", async () => {
    // First read: pre-exchange snapshot with valid tokens.
    fs.getRef("users/u1").get
      .mockResolvedValueOnce({ exists: true, data: () => ({ googleDriveTokens: { access_token: "old", refresh_token: "old-rf", expires_at: Date.now() + 3600 * 1000 } }) })
      // Second read (CAS transaction): the client has disconnected (map = null).
      .mockResolvedValueOnce({ exists: true, data: () => ({ googleDriveTokens: null }) });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "G_AT", refresh_token: "G_RT", expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=error&service=google-drive/);
    expect(fs.getRef("users/u1").set).not.toHaveBeenCalled();
  });

  test("user-initiated reconnect from a disconnected state is allowed", async () => {
    fs.getRef("users/u1").get.mockResolvedValue({ exists: true, data: () => ({ googleDriveTokens: null }) });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "G_AT", refresh_token: "G_RT", expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=success&service=google-drive/);
  });

  test("T30: an older authorization callback does not overwrite a newer stored authorization", async () => {
    const storedTs = Date.now();
    const storedTokens = { access_token: "newer-at", refresh_token: "newer-rf", expires_at: Date.now() + 3600 * 1000, authorized_at: storedTs };
    fs.getRef("users/u1").get.mockResolvedValue({
      exists: true,
      data: () => ({ googleDriveTokens: storedTokens }),
    });
    mockValidateOAuthState.mockReturnValue({ ok: true, uid: "u1", ts: storedTs - 1000 });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "old-at", refresh_token: "old-rf", expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=error&service=google-drive/);
    expect(fs.getRef("users/u1").set).not.toHaveBeenCalled();
  });

  test("a newer authorization replaces an older stored one and persists authorized_at", async () => {
    const storedTs = Date.now() - 60_000;
    const storedTokens = { access_token: "old-at", refresh_token: "old-rf", expires_at: Date.now() + 3600 * 1000, authorized_at: storedTs };
    fs.getRef("users/u1").get.mockResolvedValue({
      exists: true,
      data: () => ({ googleDriveTokens: storedTokens }),
    });
    const newTs = Date.now();
    mockValidateOAuthState.mockReturnValue({ ok: true, uid: "u1", ts: newTs });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "new-at", refresh_token: "new-rf", expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=success&service=google-drive/);
    const [body] = fs.getRef("users/u1").set.mock.calls[0];
    expect(body.googleDriveTokens.access_token).toBe("new-at");
    expect(body.googleDriveTokens.authorized_at).toBe(newTs);
  });

  test("unexpected internal error → safe public message, never the raw error", async () => {
    fs.getRef("users/u1").get.mockRejectedValueOnce(new Error("RAW-SECRET-DETAIL"));
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=error&service=google-drive/);
    expect(res.sentBody).toContain(encodeURIComponent("Google Drive connection failed"));
    expect(res.sentBody).not.toContain("RAW-SECRET-DETAIL");
  });

  test("non-string refresh token from the provider is discarded; the previous valid one is kept", async () => {
    const storedTokens = { access_token: "old-at", refresh_token: "prev-rf", expires_at: Date.now() + 3600 * 1000 };
    fs.getRef("users/u1").get.mockResolvedValue({ exists: true, data: () => ({ googleDriveTokens: storedTokens }) });
    mockValidateOAuthState.mockReturnValue({ ok: true, uid: "u1", ts: Date.now() });
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "new-at", refresh_token: 42, expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=success&service=google-drive/);
    const [body] = fs.getRef("users/u1").set.mock.calls[0];
    expect(body.googleDriveTokens.refresh_token).toBe("prev-rf");
  });

  test("initial authorization with an invalid refresh token (no previous credentials) aborts without writing", async () => {
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "G_AT", refresh_token: 42, expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(makeReq({ query: { code: "c", state: "u1" } }), res);
    expect(res.statusCode).toBe(302);
    expect(res.sentBody).toMatch(/status=error&service=google-drive/);
    expect(fs.getRef("users/u1").set).not.toHaveBeenCalled();
  });

  test("emulator mode redirects to localhost:5173 settings on success", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    fetchMock.__setMockResponses([
      { status: 200, body: { access_token: "x", refresh_token: "G_RT", expires_in: 3600 } },
    ]);
    const res = makeRes();
    await googleDriveOAuthCallback(
      makeReq({ query: { code: "c", state: "u1" } }),
      res,
    );
    expect(res.sentBody).toMatch(/http:\/\/localhost:5173\/settings/);
  });
});

// ─── OSF ───────────────────────────────────────────────────────────────────
