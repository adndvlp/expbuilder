import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFunctionsBaseUrl,
  getBackendProjectId,
  getProviderClientId,
} from "../../lib/oauthConfig";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete (window as any).electron;
});

describe("oauthConfig", () => {
  it("reads every provider client id from Electron settings", async () => {
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => ({
        githubClientId: "gh-1",
        dropboxClientId: "db-1",
        googleDriveClientId: "drive-1",
        osfClientId: "osf-1",
      })),
    };

    await expect(getProviderClientId("github")).resolves.toBe("gh-1");
    await expect(getProviderClientId("dropbox")).resolves.toBe("db-1");
    await expect(getProviderClientId("googleDrive")).resolves.toBe("drive-1");
    await expect(getProviderClientId("osf")).resolves.toBe("osf-1");
  });

  it("returns null when Electron settings lack the requested provider", async () => {
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => ({ githubClientId: "gh-1" })),
    };

    await expect(getProviderClientId("dropbox")).resolves.toBeNull();
  });

  it("returns null when Electron settings are missing entirely", async () => {
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => null),
    };

    await expect(getProviderClientId("github")).resolves.toBeNull();
  });

  it("returns null when Electron settings read fails", async () => {
    (window as any).electron = {
      readOauthConfig: vi.fn(async () => {
        throw new Error("read failed");
      }),
    };

    await expect(getProviderClientId("github")).resolves.toBeNull();
  });

  it("falls back to env vars in web builds", async () => {
    vi.stubEnv("VITE_GITHUB_CLIENT_ID", "env-gh");
    await expect(getProviderClientId("github")).resolves.toBe("env-gh");
    vi.stubEnv("VITE_DROPBOX_CLIENT_ID", "");
    await expect(getProviderClientId("dropbox")).resolves.toBeNull();
  });

  it("falls back to env vars when Electron exposes no oauth reader", async () => {
    (window as any).electron = { startOAuthFlow: vi.fn() };
    vi.stubEnv("VITE_OSF_CLIENT_ID", "env-osf");

    await expect(getProviderClientId("osf")).resolves.toBe("env-osf");
  });

  it("resolves the backend project id from Electron Firebase config", async () => {
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => ({ projectId: "myproj" })),
    };

    await expect(getBackendProjectId()).resolves.toBe("myproj");
  });

  it("falls back to env project id when Electron config is absent or empty", async () => {
    (window as any).electron = {
      readFirebaseConfig: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({}),
    };

    await expect(getBackendProjectId()).resolves.toBe("test-project");
    await expect(getBackendProjectId()).resolves.toBe("test-project");
  });

  it("returns null when Electron config read fails and env is empty", async () => {
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");
    (window as any).electron = {
      readFirebaseConfig: vi.fn(async () => {
        throw new Error("read failed");
      }),
    };

    await expect(getBackendProjectId()).resolves.toBeNull();
  });

  it("resolves the project id from env in web builds", async () => {
    await expect(getBackendProjectId()).resolves.toBe("test-project");
  });

  it("builds Cloud Functions base URLs", () => {
    expect(buildFunctionsBaseUrl("myproj")).toBe(
      "https://us-central1-myproj.cloudfunctions.net",
    );
  });
});
