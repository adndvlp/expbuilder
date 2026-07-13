import { act, render, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fileUploadTestUtils,
  useFileUpload,
  waitForExpectedCompressedFiles,
  waitForUploadJobs,
} from "../../../pages/ExperimentBuilder/components/Timeline/useFileUpload";
import type { UploadedFile } from "../../../pages/ExperimentBuilder/components/Timeline/useFileUpload";

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

const initialFiles: UploadedFile[] = [
  { name: "first image.png", url: "uploads/img/first image.png", type: "img" },
  { name: "sound.mp3", url: "uploads/aud/sound.mp3", type: "aud" },
];

describe("Timeline file uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("covers helper fallbacks for compressed media and job progress", () => {
    expect(
      fileUploadTestUtils.getCompressedExtension(
        new File(["video"], "clip.mov", { type: "text/plain" }),
      ),
    ).toBe(".webm");
    expect(
      fileUploadTestUtils.getCompressedExtension(
        new File(["notes"], "notes.txt", { type: "text/plain" }),
      ),
    ).toBe("");
    expect(
      fileUploadTestUtils.getExpectedCompressedFiles([
        new File(["notes"], "notes.txt", { type: "text/plain" }),
      ]),
    ).toEqual([]);
    expect(
      fileUploadTestUtils.describeJobProgress([
        { id: "job-done", status: "completed", storedName: "done.webm" },
      ]),
    ).toBe("Converting done.webm... 100%");
    expect(
      fileUploadTestUtils.describeJobProgress([
        { id: "job-low", status: "processing", progress: -10 },
        { id: "job-high", status: "processing", progress: 120 },
      ]),
    ).toBe("Converting 2 media files... 50%");
  });

  it("polls expected compressed files until a match or a miss", async () => {
    const loadUploadedFiles = vi
      .fn<() => Promise<UploadedFile[]>>()
      .mockResolvedValueOnce([
        { name: "clip.tmp", url: "vid/clip.tmp", type: "vid" },
      ])
      .mockResolvedValueOnce([
        { name: "clip-2.webm", url: "vid/clip-2.webm", type: "vid" },
      ]);

    await expect(
      waitForExpectedCompressedFiles(
        [{ baseName: "clip", extension: ".webm" }],
        loadUploadedFiles,
        { attempts: 2, delayMs: 0 },
      ),
    ).resolves.toBe(true);
    expect(loadUploadedFiles).toHaveBeenNthCalledWith(1, true);
    expect(loadUploadedFiles).toHaveBeenCalledTimes(2);

    await expect(
      waitForExpectedCompressedFiles([], loadUploadedFiles),
    ).resolves.toBe(false);

    const missLoader = vi.fn(async () => [] as UploadedFile[]);
    await expect(
      waitForExpectedCompressedFiles(
        [{ baseName: "missing", extension: ".ogg" }],
        missLoader,
        { attempts: 2, delayMs: 0 },
      ),
    ).resolves.toBe(false);
    expect(missLoader).toHaveBeenCalledTimes(2);
  });

  it("waits for upload jobs and ignores warnings without messages", async () => {
    fetchMock().mockResolvedValueOnce(
      okJson({
        job: {
          id: "job-done",
          status: "completed",
          warnings: [{}],
        },
      }),
    );
    const loadUploadedFiles = vi.fn(async () => [] as UploadedFile[]);
    const setUploadStatus = vi.fn();

    await expect(
      waitForUploadJobs(
        [{ id: "job-done", status: "processing" }],
        loadUploadedFiles,
        setUploadStatus,
        { attempts: 1, delayMs: 0 },
      ),
    ).resolves.toEqual([]);

    expect(loadUploadedFiles).toHaveBeenCalledWith(true);
    expect(setUploadStatus).toHaveBeenCalledWith("Converting media...");
  });

  it("reports upload jobs that disappear while polling", async () => {
    fetchMock().mockResolvedValueOnce(okJson({}, false, 404));
    const loadUploadedFiles = vi.fn(async () => [] as UploadedFile[]);

    await expect(
      waitForUploadJobs(
        [{ id: "job-missing", status: "processing" }],
        loadUploadedFiles,
        vi.fn(),
        { attempts: 1, delayMs: 0 },
      ),
    ).rejects.toThrow("Upload job job-missing not found");
    expect(loadUploadedFiles).not.toHaveBeenCalled();
  });

  it("reports failed upload jobs without backend error details", async () => {
    fetchMock().mockResolvedValueOnce(
      okJson({
        job: {
          id: "job-failed",
          status: "failed",
          originalName: "broken.mp4",
        },
      }),
    );

    await expect(
      waitForUploadJobs(
        [{ id: "job-failed", status: "processing" }],
        vi.fn(async () => [] as UploadedFile[]),
        vi.fn(),
        { attempts: 1, delayMs: 0 },
      ),
    ).rejects.toMatchObject({
      name: "UploadJobFailedError",
      message: "broken.mp4: Conversion failed",
    });
  });

  it("reports upload jobs that remain pending after the polling limit", async () => {
    fetchMock().mockResolvedValueOnce(
      okJson({
        job: {
          id: "different-job",
          status: "processing",
          progress: 10,
        },
      }),
    );
    const loadUploadedFiles = vi.fn(async () => [] as UploadedFile[]);
    const setUploadStatus = vi.fn();

    await expect(
      waitForUploadJobs(
        [{ id: "job-stuck", status: "processing", progress: 5 }],
        loadUploadedFiles,
        setUploadStatus,
        { attempts: 1, delayMs: 0 },
      ),
    ).rejects.toThrow(
      "Conversion is still processing. The file list will update when it finishes.",
    );
    expect(loadUploadedFiles).toHaveBeenCalledWith(true);
    expect(setUploadStatus).toHaveBeenCalledWith("Converting media... 5%");
  });

  it("loads uploaded files and reuses the in-memory folder cache", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    fetchMock().mockResolvedValue(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    act(() => {
      result.current.refreshUploadedFiles();
    });

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/list-files/img/test-exp-123`,
    );
  });

  it("marks the folder input ref as a directory picker", async () => {
    fetchMock().mockResolvedValueOnce(okJson({ files: [] }));

    function FolderInputHarness() {
      const upload = useFileUpload({ folder: "img" });
      return <input data-testid="folder-input" ref={upload.folderInputRef} />;
    }

    const { getByTestId } = render(<FolderInputHarness />);

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const input = getByTestId("folder-input");
      expect(input.getAttribute("webkitdirectory")).toBe("");
      expect(input.getAttribute("directory")).toBe("");
    });
  });

  it("uses an empty list when the folder response omits files", async () => {
    fetchMock().mockResolvedValueOnce(okJson({}));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    });
    expect(result.current.uploadedFiles).toEqual([]);
  });
});
