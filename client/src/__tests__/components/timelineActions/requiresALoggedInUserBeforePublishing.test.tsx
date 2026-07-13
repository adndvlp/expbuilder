import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishExperiment from "../../../pages/ExperimentBuilder/components/Timeline/PublishExperiment";
import { auth } from "../../../lib/firebase";

const API_URL = "http://localhost:3000";

function okJson(
  payload: unknown,
  ok = true,
  status = ok ? 200 : 500,
): Response {
  return {
    ok,
    status,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

function installClipboard(writeText = vi.fn(async () => undefined)) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

describe("PublishExperiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    (auth as any).currentUser = { uid: "user-123" };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    (auth as any).currentUser = null;
  });

  function createPublishHarness(
    overrides: Partial<Parameters<typeof PublishExperiment>[0]> = {},
  ) {
    const props = {
      experimentID: "exp-123",
      setLastPagesUrl: vi.fn(),
      setPublishStatus: vi.fn(),
      getUserTokens: vi.fn(async () => ({
        drive: true,
        dropbox: false,
        osf: false,
        github: true,
      })),
      setAvailableStorages: vi.fn(),
      setShowStorageModal: vi.fn(),
      setIsPublishing: vi.fn(),
      generateExperiment: vi.fn(async () => "public-code"),
      ...overrides,
    };

    return { props, api: PublishExperiment(props) };
  }

  it("requires a logged-in user before publishing", async () => {
    (auth as any).currentUser = null;
    const { props, api } = createPublishHarness();

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: User not logged in",
    );
    expect(props.getUserTokens).not.toHaveBeenCalled();
  });

  it("opens storage selection when more than one connected storage exists", async () => {
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => ({
        drive: true,
        dropbox: true,
        osf: true,
        github: true,
      })),
    });

    await api.handlePublishToGitHub();

    expect(props.setAvailableStorages).toHaveBeenCalledWith([
      "googledrive",
      "dropbox",
      "osf",
    ]);
    expect(props.setShowStorageModal).toHaveBeenCalledWith(true);
    expect(props.generateExperiment).not.toHaveBeenCalled();
  });

  it("reports missing storage tokens before publishing", async () => {
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => ({
        drive: false,
        dropbox: false,
        osf: false,
        github: true,
      })),
    });

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Please connect Google Drive, Dropbox, or OSF in Settings",
    );
    expect(props.setAvailableStorages).not.toHaveBeenCalled();
    expect(props.generateExperiment).not.toHaveBeenCalled();
  });

  it("reports errors while preparing publish options", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => {
        throw new Error("token lookup failed");
      }),
    });

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: token lookup failed",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error preparing to publish:",
      expect.any(Error),
    );
  });

  it("reports unknown preparation errors from non-Error rejections", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createPublishHarness({
      getUserTokens: vi.fn(async () => {
        throw "token lookup failed";
      }),
    });

    await api.handlePublishToGitHub();

    expect(props.setPublishStatus).toHaveBeenCalledWith("Error: Unknown error");
  });

  it("publishes directly with the only available storage and copies the pages URL", async () => {
    const writeText = installClipboard();
    fetchMock().mockResolvedValue(
      okJson({ success: true, pagesUrl: "https://pages.test/exp-123" }),
    );
    const { props, api } = createPublishHarness();

    await api.handlePublishToGitHub();

    expect(props.generateExperiment).toHaveBeenCalledWith("googledrive");
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/publish-experiment/exp-123`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: "user-123",
          storage: "googledrive",
          generatedPublicCode: "public-code",
        }),
        credentials: "include",
        mode: "cors",
      },
    );
    expect(props.setLastPagesUrl).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(writeText).toHaveBeenCalledWith("https://pages.test/exp-123");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(props.setPublishStatus).toHaveBeenCalledWith(expect.any(Function));
    const clipboardUpdater = props.setPublishStatus.mock.calls.find(
      ([value]) => typeof value === "function",
    )?.[0] as ((prev: string) => string) | undefined;
    expect(clipboardUpdater?.("Published! GitHub Pages URL")).toBe(
      "Published! GitHub Pages URL copied to clipboard",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(props.setPublishStatus).toHaveBeenCalledWith("");
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("does not call publish API when public code generation returns empty", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { props, api } = createPublishHarness({
      generateExperiment: vi.fn(async () => ""),
    });

    await api.publishWithStorage("user-123", "googledrive");

    expect(props.generateExperiment).toHaveBeenCalledWith("googledrive");
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Failed to generate public experiment code",
    );
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("reports HTTP failures from the publish endpoint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValue(okJson({ success: false }, false, 503));
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "dropbox");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Server responded with status: 503",
    );
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("shows GitHub file size publish errors from the API response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValue(
      okJson(
        {
          success: false,
          code: "GITHUB_FILE_TOO_LARGE",
          message:
            "GitHub no acepta archivos mayores a 100 MiB: vid/demo.mp4 (142.3 MiB).",
          oversizedFiles: [
            {
              url: "vid/demo.mp4",
              filename: "demo.mp4",
              sizeBytes: 149_212_365,
            },
          ],
        },
        false,
        413,
      ),
    );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "dropbox");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: GitHub no acepta archivos mayores a 100 MiB: vid/demo.mp4 (142.3 MiB).",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(props.setPublishStatus).not.toHaveBeenCalledWith("");
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });
});
