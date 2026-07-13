import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishExperiment from "../../../pages/ExperimentBuilder/components/Timeline/PublishExperiment";
import { auth } from "../../../lib/firebase";

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

  it("builds GitHub file size publish errors from oversized file metadata", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(
        okJson(
          {
            success: false,
            code: "GITHUB_FILE_TOO_LARGE",
            error: "Repository rejected a large file",
          },
          false,
          413,
        ),
      )
      .mockResolvedValueOnce(
        okJson(
          {
            success: false,
            code: "GITHUB_FILE_TOO_LARGE",
            oversizedFiles: [
              {
                url: "vid/huge.mp4",
                sizeBytes: 157_286_400,
              },
              {
                filename: "audio.wav",
              },
            ],
          },
          false,
          413,
        ),
      )
      .mockResolvedValueOnce(
        okJson(
          {
            success: false,
            code: "GITHUB_FILE_TOO_LARGE",
          },
          false,
          413,
        ),
      );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "dropbox");
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Repository rejected a large file",
    );

    await api.publishWithStorage("user-123", "dropbox");
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: GitHub no acepta archivos mayores a 100 MiB: vid/huge.mp4 150.0 MiB, audio.wav. Comprime o reemplaza estos archivos antes de publicar.",
    );

    await api.publishWithStorage("user-123", "dropbox");
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: GitHub no acepta archivos mayores a 100 MiB: one or more media files. Comprime o reemplaza estos archivos antes de publicar.",
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(props.setPublishStatus).not.toHaveBeenCalledWith("");
  });

  it("warns when GitHub token is invalid", async () => {
    fetchMock().mockResolvedValue(
      okJson({
        success: false,
        message: "GitHub token not found or invalid",
      }),
    );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "osf");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Warning: GitHub publish failed. Please reconnect your GitHub account in Settings.",
    );
    expect(props.setLastPagesUrl).not.toHaveBeenCalled();
    expect(props.setIsPublishing).toHaveBeenLastCalledWith(false);
  });

  it("keeps the pages URL when clipboard copy fails after publishing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installClipboard(
      vi.fn(async () => {
        throw new Error("clipboard denied");
      }),
    );
    fetchMock().mockResolvedValue(
      okJson({ success: true, pagesUrl: "https://pages.test/exp-123" }),
    );
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "googledrive");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Published! GitHub Pages URL",
    );
    expect(props.setLastPagesUrl).toHaveBeenCalledWith(
      "https://pages.test/exp-123",
    );
    expect(console.error).toHaveBeenCalledWith(
      "Failed to copy GitHub Pages URL: ",
      expect.any(Error),
    );
  });

  it("reports successful HTTP responses that did not publish", async () => {
    fetchMock()
      .mockResolvedValueOnce(
        okJson({ success: false, message: "Publish failed" }),
      )
      .mockResolvedValueOnce(okJson({ success: false, error: "Backend error" }))
      .mockResolvedValueOnce(okJson({ success: false }));
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "googledrive");
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Publish failed",
    );

    await api.publishWithStorage("user-123", "googledrive");
    expect(props.setPublishStatus).toHaveBeenCalledWith("Error: Backend error");

    await api.publishWithStorage("user-123", "googledrive");
    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Failed to publish",
    );
  });

  it("handles successful publishing without a pages URL", async () => {
    const writeText = installClipboard();
    fetchMock().mockResolvedValue(okJson({ success: true }));
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "googledrive");

    expect(props.setLastPagesUrl).toHaveBeenCalledWith("");
    expect(writeText).toHaveBeenCalledWith("");
  });

  it("handles unreadable publish responses and non-Error publish failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: vi.fn(async () => {
        throw new Error("invalid json");
      }),
    } as unknown as Response);
    const { props, api } = createPublishHarness();

    await api.publishWithStorage("user-123", "googledrive");

    expect(props.setPublishStatus).toHaveBeenCalledWith(
      "Error: Server responded with status: 502",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(props.setPublishStatus).toHaveBeenCalledWith("");

    const { props: rejectedProps, api: rejectedApi } = createPublishHarness({
      generateExperiment: vi.fn(async () => {
        throw "publish failed";
      }),
    });

    await rejectedApi.publishWithStorage("user-123", "googledrive");

    expect(rejectedProps.setPublishStatus).toHaveBeenCalledWith(
      "Error: Unknown error",
    );
  });
});
