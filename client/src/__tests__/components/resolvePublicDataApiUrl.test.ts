import { describe, expect, it, vi } from "vitest";
import { resolvePublicDataApiUrl } from "../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/resolvePublicDataApiUrl";

describe("resolvePublicDataApiUrl", () => {
  it("keeps the baked URL in dev (emulator)", async () => {
    const getBackendProjectId = vi.fn(async () => "other-proj");

    await expect(
      resolvePublicDataApiUrl({
        dev: true,
        bakedUrl: "http://localhost:5001/p/us-central1/apiData",
        getBackendProjectId,
      }),
    ).resolves.toBe("http://localhost:5001/p/us-central1/apiData");
    expect(getBackendProjectId).not.toHaveBeenCalled();
  });

  it("derives the URL from the active backend in production builds", async () => {
    await expect(
      resolvePublicDataApiUrl({
        dev: false,
        bakedUrl: "https://us-central1-test-e4cf9.cloudfunctions.net/apiData",
        getBackendProjectId: async () => "member-proj",
      }),
    ).resolves.toBe("https://us-central1-member-proj.cloudfunctions.net/apiData");
  });

  it("falls back to the baked URL without an active backend", async () => {
    await expect(
      resolvePublicDataApiUrl({
        dev: false,
        bakedUrl: "https://us-central1-test-e4cf9.cloudfunctions.net/apiData",
        getBackendProjectId: async () => null,
      }),
    ).resolves.toBe("https://us-central1-test-e4cf9.cloudfunctions.net/apiData");
  });

  it("falls back to the baked URL when the lookup throws", async () => {
    await expect(
      resolvePublicDataApiUrl({
        dev: false,
        bakedUrl: "https://us-central1-test-e4cf9.cloudfunctions.net/apiData",
        getBackendProjectId: async () => {
          throw new Error("nope");
        },
      }),
    ).resolves.toBe("https://us-central1-test-e4cf9.cloudfunctions.net/apiData");
  });
});
