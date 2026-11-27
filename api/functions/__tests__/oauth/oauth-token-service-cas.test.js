/**
 * SDD-EXP-OAUTH-001 · T01–T03, T08–T10, T21–T27, T31–T33 (token-service).
 * CAS persistence, adoption of concurrent winners, local disconnect
 * protection and confirmatory re-read after invalid_grant.
 */
import { jest } from "@jest/globals";

process.env.DROPBOX_CLIENT_ID = "test-dropbox-client";
process.env.DROPBOX_CLIENT_SECRET = "test-dropbox-secret";
process.env.GOOGLE_DRIVE_CLIENT_ID = "test-google-client";
process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-google-secret";

const userData = new Map();
const mockRefresh = jest.fn();

const refsByUid = new Map();
function getUserRef(uid) {
  if (!refsByUid.has(uid)) {
    const ref = {
      uid,
      get: jest.fn(async () => ({
        exists: userData.has(uid),
        data: () => structuredClone(userData.get(uid)),
      })),
      set: jest.fn(async (data, opts) => {
        if (opts?.merge) userData.set(uid, { ...(userData.get(uid) ?? {}), ...data });
        else userData.set(uid, data);
      }),
      update: jest.fn(async (data) => {
        userData.set(uid, { ...(userData.get(uid) ?? {}), ...data });
      }),
    };
    refsByUid.set(uid, ref);
  }
  return refsByUid.get(uid);
}

const mockDb = {
  collection: jest.fn(() => ({ doc: jest.fn((uid) => getUserRef(uid)) })),
  runTransaction: jest.fn(async (fn) => {
    const transaction = {
      get: async (ref) => ({
        exists: userData.has(ref.uid),
        data: () => structuredClone(userData.get(ref.uid)),
      }),
      set: async (ref, data, opts) => {
        if (opts?.merge) userData.set(ref.uid, { ...(userData.get(ref.uid) ?? {}), ...data });
        else userData.set(ref.uid, data);
      },
      update: async (ref, data) => {
        userData.set(ref.uid, { ...(userData.get(ref.uid) ?? {}), ...data });
      },
      delete: async (ref) => { userData.delete(ref.uid); },
    };
    return await fn(transaction);
  }),
};

jest.unstable_mockModule("../../app.js", () => ({ db: mockDb, app: {} }));
jest.unstable_mockModule("../../oauth/refresh.js", () => ({
  refreshAccessToken: mockRefresh,
}));
jest.unstable_mockModule("../../oauth/api/callbacks/osf.js", () => ({
  refreshOSFToken: jest.fn(),
}));

const { getValidToken } = await import("../../oauth/index.js");

function storedTokens() {
  return userData.get("u1")?.dropboxTokens;
}

beforeEach(() => {
  userData.clear();
  refsByUid.clear();
  mockRefresh.mockReset();
});

const expired = (extra = {}) => ({
  access_token: "old-at",
  refresh_token: "old-rf",
  expires_at: Date.now() - 1000,
  ...extra,
});

describe("token-service — TTL boundary and reuse (T01, T08)", () => {
  test("valid token is reused without any refresh call", async () => {
    userData.set("u1", { dropboxTokens: { access_token: "tok", refresh_token: "rf", expires_at: Date.now() + 10 * 60 * 1000 } });
    const r = await getValidToken("dropbox", "u1");
    expect(r).toEqual({ success: true, access_token: "tok", wasRefreshed: false });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("token at exactly the 5-min margin is refreshed", async () => {
    userData.set("u1", { dropboxTokens: expired({ expires_at: Date.now() + 5 * 60 * 1000 }) });
    mockRefresh.mockResolvedValue({ success: true, access_token: "new-at", expires_in: 14400 });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(true);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("valid access token without refresh token is reused (T08)", async () => {
    userData.set("u1", { dropboxTokens: { access_token: "tok", expires_at: Date.now() + 10 * 60 * 1000 } });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(true);
    expect(r.access_token).toBe("tok");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("expired access token without refresh token reports reconnection without HTTP (T08)", async () => {
    userData.set("u1", { dropboxTokens: { access_token: "tok", expires_at: Date.now() - 1000 } });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_REAUTH_PENDING");
    expect(r.retryable).toBe(true);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("token-service — refresh persistence via CAS (T03, T06, T09)", () => {
  test("rotated refresh token is persisted with the new access token", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValue({ success: true, access_token: "new-at", refresh_token: "rotated-rf", expires_in: 14400 });
    const r = await getValidToken("dropbox", "u1");
    expect(r).toEqual({ success: true, access_token: "new-at", wasRefreshed: true });
    expect(storedTokens().access_token).toBe("new-at");
    expect(storedTokens().refresh_token).toBe("rotated-rf");
    expect(storedTokens().expires_at).toBeGreaterThan(Date.now() + 14_000 * 1000);
  });

  test("omitted refresh token keeps the previous one", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValue({ success: true, access_token: "new-at", expires_in: 14400 });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(true);
    expect(storedTokens().refresh_token).toBe("old-rf");
  });

  test("transient refresh failure leaves stored credentials untouched (T26)", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValue({ success: false, error: "Storage credentials temporarily unavailable", code: "OAUTH_TEMPORARY", retryable: true });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_TEMPORARY");
    expect(storedTokens()).toMatchObject({ access_token: "old-at", refresh_token: "old-rf" });
  });
});

describe("token-service — invalid_grant confirmatory re-read (T21, T22, T27)", () => {
  const pendingFailure = () => ({ success: false, error: "Storage authorization may need to be reconnected", code: "OAUTH_REAUTH_PENDING", retryable: true });

  test("T21: concurrent winner persisted before re-read → adopt, no permanent classification", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockImplementation(async () => {
      // Winner persisted while our request failed.
      userData.set("u1", { dropboxTokens: { access_token: "winner-at", refresh_token: "winner-rf", expires_at: Date.now() + 3600 * 1000 } });
      return pendingFailure();
    });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(true);
    expect(r.access_token).toBe("winner-at");
    expect(r.wasRefreshed).toBe(false);
    expect(storedTokens().access_token).toBe("winner-at");
  });

  test("T22: winner has not persisted yet → retryable, never marked permanent on first invalid_grant", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValue(pendingFailure());
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_REAUTH_PENDING");
    expect(r.retryable).toBe(true);
    expect(storedTokens()).toMatchObject({ access_token: "old-at", refresh_token: "old-rf" });

    // Winner persists later; the next independent attempt reuses it.
    userData.set("u1", { dropboxTokens: { access_token: "winner-at", refresh_token: "winner-rf", expires_at: Date.now() + 3600 * 1000 } });
    const second = await getValidToken("dropbox", "u1");
    expect(second.success).toBe(true);
    expect(second.access_token).toBe("winner-at");
  });

  test("T27: Firestore re-read failure during classification → TOKEN_STORE_TEMPORARY", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValue(pendingFailure());
    const ref = getUserRef("u1");
    ref.get
      .mockResolvedValueOnce({ exists: true, data: () => structuredClone(userData.get("u1")) })
      .mockRejectedValueOnce(Object.assign(new Error("firestore down"), { code: 14 }));
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(false);
    expect(r.code).toBe("TOKEN_STORE_TEMPORARY");
    expect(r.retryable).toBe(true);
  });
});

describe("token-service — CAS vs reconnection and disconnect (T23, T25, T31, T32)", () => {
  test("T23/T25: reconnection lands between refresh and CAS → refresh result discarded, reconnection adopted", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockImplementation(async () => {
      // Fresh OAuth authorization commits while our refresh response is in flight.
      userData.set("u1", { dropboxTokens: { access_token: "fresh-at", refresh_token: "fresh-rf", expires_at: Date.now() + 3600 * 1000 } });
      return { success: true, access_token: "stale-at", refresh_token: "stale-rf", expires_in: 14400 };
    });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(true);
    expect(r.access_token).toBe("fresh-at");
    expect(r.wasRefreshed).toBe(false);
    expect(storedTokens().access_token).toBe("fresh-at");
    expect(storedTokens().refresh_token).toBe("fresh-rf");
  });

  test("T31: local disconnect lands between refresh and CAS → refresh does not restore credentials", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockImplementation(async () => {
      // Client writes dropboxTokens: null (Settings disconnect) after our request.
      userData.set("u1", { dropboxTokens: null });
      return { success: true, access_token: "late-at", expires_in: 14400 };
    });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(false);
    expect(r.code).toBe("OAUTH_REAUTH_PENDING");
    expect(r.error).toMatch(/has not connected dropbox/);
    expect(storedTokens()).toBe(null);
  });

  test("T32: disconnected map (null) is treated as not connected, no HTTP", async () => {
    userData.set("u1", { dropboxTokens: null });
    const r = await getValidToken("dropbox", "u1");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/has not connected dropbox/);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("token-service — Firestore failure classification", () => {
  test("initial read failure with numeric gRPC code 14 → TOKEN_STORE_TEMPORARY (sanitized)", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    const ref = getUserRef("u1");
    ref.get.mockRejectedValueOnce(Object.assign(new Error("db boom"), { code: 14 }));
    const r = await getValidToken("dropbox", "u1");
    expect(r).toMatchObject({
      success: false,
      error: "Token storage temporarily unavailable",
      code: "TOKEN_STORE_TEMPORARY",
      retryable: true,
    });
    expect(JSON.stringify(r)).not.toContain("db boom");
  });

  test("symbolic permission-denied → TOKEN_STORE_CONFIGURATION, non-retryable", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    const ref = getUserRef("u1");
    ref.get.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const r = await getValidToken("dropbox", "u1");
    expect(r).toMatchObject({
      success: false,
      code: "TOKEN_STORE_CONFIGURATION",
      retryable: false,
    });
  });

  test("symbolic deadline-exceeded → TOKEN_STORE_TEMPORARY", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    const ref = getUserRef("u1");
    ref.get.mockRejectedValueOnce(Object.assign(new Error("deadline"), { code: "deadline-exceeded" }));
    const r = await getValidToken("dropbox", "u1");
    expect(r).toMatchObject({ success: false, code: "TOKEN_STORE_TEMPORARY", retryable: true });
  });

  test("numeric permission-denied (7) → TOKEN_STORE_CONFIGURATION", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    const ref = getUserRef("u1");
    ref.get.mockRejectedValueOnce(Object.assign(new Error("denied"), { code: 7 }));
    const r = await getValidToken("dropbox", "u1");
    expect(r).toMatchObject({ success: false, code: "TOKEN_STORE_CONFIGURATION", retryable: false });
  });
});

describe("token-service — successive and concurrent renewals (T20, T28)", () => {
  test("successive renewals without republishing persist the latest rotated refresh token", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValueOnce({ success: true, access_token: "at-1", refresh_token: "rf-1", expires_in: 14400 });
    await getValidToken("dropbox", "u1");
    userData.set("u1", { dropboxTokens: { ...storedTokens(), expires_at: Date.now() - 1000 } });
    mockRefresh.mockResolvedValueOnce({ success: true, access_token: "at-2", refresh_token: "rf-2", expires_in: 14400 });
    const r = await getValidToken("dropbox", "u1");
    expect(r.access_token).toBe("at-2");
    expect(storedTokens().refresh_token).toBe("rf-2");
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  test("concurrent refreshes returning different refresh tokens: first committed wins, loser adopts", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    let first = true;
    mockRefresh.mockImplementation(async () => {
      const value = first ? "rf-A" : "rf-B";
      first = false;
      return { success: true, access_token: "at", refresh_token: value, expires_in: 14400 };
    });
    const [a, b] = await Promise.all([getValidToken("dropbox", "u1"), getValidToken("dropbox", "u1")]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(["rf-A", "rf-B"]).toContain(storedTokens().refresh_token);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});

describe("token-service — overlapping refreshes (T10, T33)", () => {
  test("two concurrent refreshes: one CAS write wins, the other adopts; both succeed", async () => {
    userData.set("u1", { dropboxTokens: expired() });
    mockRefresh.mockResolvedValue({ success: true, access_token: "new-at", refresh_token: "new-rf", expires_in: 14400 });
    const [a, b] = await Promise.all([getValidToken("dropbox", "u1"), getValidToken("dropbox", "u1")]);
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(new Set([a.access_token, b.access_token])).toEqual(new Set(["new-at"]));
    expect(mockRefresh).toHaveBeenCalledTimes(2);
    expect(storedTokens().access_token).toBe("new-at");
    expect(storedTokens().refresh_token).toBe("new-rf");
  });
});
