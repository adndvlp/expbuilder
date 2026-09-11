import { jest } from "@jest/globals";
import { makeReq, makeRes } from "../../helpers/firestore-mock.js";

const mockRequireAuth = jest.fn();

jest.unstable_mockModule("firebase-functions/v2/https", () => ({
  onRequest: (...args) => args[args.length - 1],
}));
jest.unstable_mockModule("../../../utils/auth.js", () => ({
  requireAuth: mockRequireAuth,
}));

const { getOAuthClientIds } = await import(
  "../../../oauth/api/public-client-ids.js"
);

const OLD_ENV = { ...process.env };

beforeEach(() => {
  mockRequireAuth.mockReset();
  process.env = { ...OLD_ENV };
  delete process.env.DROPBOX_CLIENT_ID;
  delete process.env.GOOGLE_DRIVE_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.OSF_CLIENT_ID;
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("getOAuthClientIds", () => {
  test("OPTIONS preflight returns 204", async () => {
    const res = makeRes();

    await getOAuthClientIds(makeReq({ method: "OPTIONS" }), res);

    expect(res.statusCode).toBe(204);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  test("rejects non-GET requests", async () => {
    const res = makeRes();

    await getOAuthClientIds(makeReq({ method: "POST" }), res);

    expect(res.statusCode).toBe(405);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  test("stops when Firebase auth fails", async () => {
    mockRequireAuth.mockResolvedValueOnce(null);
    const res = makeRes();

    await getOAuthClientIds(makeReq({ method: "GET" }), res);

    expect(mockRequireAuth).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("returns only configured public ids, never secrets", async () => {
    mockRequireAuth.mockResolvedValueOnce("u1");
    process.env.GOOGLE_DRIVE_CLIENT_ID = "drive-id";
    process.env.GITHUB_CLIENT_ID = "gh-id";
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = "shh";
    const res = makeRes();

    await getOAuthClientIds(makeReq({ method: "GET" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      success: true,
      clientIds: { googledrive: "drive-id", github: "gh-id" },
    });
    expect(JSON.stringify(res.jsonBody)).not.toContain("shh");
  });

  test("returns an empty map when nothing is configured", async () => {
    mockRequireAuth.mockResolvedValueOnce("u1");
    const res = makeRes();

    await getOAuthClientIds(makeReq({ method: "GET" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ success: true, clientIds: {} });
  });
});
