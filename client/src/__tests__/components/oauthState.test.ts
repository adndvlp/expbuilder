import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../lib/firebase";
import { fetchOAuthState } from "../../lib/oauthState";

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

describe("fetchOAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).currentUser = {
      getIdToken: vi.fn(async () => "id-token-123"),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ success: true, state: "signed-state" })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    (auth as any).currentUser = null;
  });

  it("requests a backend-signed OAuth state with the Firebase ID token", async () => {
    await expect(fetchOAuthState("github")).resolves.toBe("signed-state");

    expect(auth.currentUser?.getIdToken).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:5001/test-e4cf9/us-central1/createOAuthStateEndpoint",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer id-token-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider: "github" }),
      },
    );
  });

  it("requires an authenticated user before minting state", async () => {
    (auth as any).currentUser = null;

    await expect(fetchOAuthState("dropbox")).rejects.toThrow(
      "Not authenticated",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces backend errors from the state endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ message: "Invalid provider" }, false, 400),
    );

    await expect(fetchOAuthState("osf")).rejects.toThrow("Invalid provider");
  });

  it("falls back to the HTTP status when backend error JSON cannot be read", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: vi.fn(async () => {
        throw new Error("invalid json");
      }),
    } as unknown as Response);

    await expect(fetchOAuthState("github")).rejects.toThrow(
      "Failed to fetch OAuth state (HTTP 503)",
    );
  });

  it("rejects malformed successful responses without a state string", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(fetchOAuthState("googledrive")).rejects.toThrow(
      "OAuth state endpoint returned no state",
    );
  });

  it("uses the deployed Functions endpoint outside development", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", "");
    const { auth: productionAuth } = await import("../../lib/firebase");
    (productionAuth as any).currentUser = {
      getIdToken: vi.fn(async () => "production-token"),
    };
    const { fetchOAuthState: fetchProductionOAuthState } = await import(
      "../../lib/oauthState"
    );

    await expect(fetchProductionOAuthState("github")).resolves.toBe(
      "signed-state",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://us-central1-test-e4cf9.cloudfunctions.net/createOAuthStateEndpoint",
      expect.any(Object),
    );
  });
});
