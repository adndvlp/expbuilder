import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetBackendClientIdsCache,
  getProviderClientId,
} from "../../lib/oauthConfig";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { currentUser: null as any },
}));

vi.mock("../../lib/firebase", () => ({ auth: mockAuth }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete (window as any).electron;
  mockAuth.currentUser = null;
  __resetBackendClientIdsCache();
});

function authedUser() {
  mockAuth.currentUser = { getIdToken: vi.fn(async () => "id-token") };
}

function mockClientIds(clientIds: Record<string, string>, ok = true) {
  const fetchMock = vi.fn(async () => ({
    ok,
    json: async () => ({ success: true, clientIds }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getProviderClientId backend fallback", () => {
  it("serves member clients from their own backend", async () => {
    // No local Settings, no env: a shared-server member.
    authedUser();
    const fetchMock = mockClientIds({ googledrive: "shared-drive-id" });

    await expect(getProviderClientId("googleDrive")).resolves.toBe(
      "shared-drive-id",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/getOAuthClientIds");
  });

  it("fetches once and caches across providers", async () => {
    authedUser();
    const fetchMock = mockClientIds({
      googledrive: "shared-drive-id",
      github: "shared-gh-id",
    });

    await expect(getProviderClientId("googleDrive")).resolves.toBe(
      "shared-drive-id",
    );
    await expect(getProviderClientId("github")).resolves.toBe("shared-gh-id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for providers the backend has not configured", async () => {
    authedUser();
    mockClientIds({ github: "shared-gh-id" });

    await expect(getProviderClientId("dropbox")).resolves.toBeNull();
  });

  it("returns null without a logged-in user", async () => {
    const fetchMock = mockClientIds({ googledrive: "shared-drive-id" });

    await expect(getProviderClientId("googleDrive")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the backend request fails", async () => {
    authedUser();
    mockClientIds({}, false);

    await expect(getProviderClientId("googleDrive")).resolves.toBeNull();
  });
});
