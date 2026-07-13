import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileUpload } from "../../../pages/ExperimentBuilder/components/Timeline/useFileUpload";
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

  it("alerts upload job warnings and failed conversions", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          processingJobs: [{ id: "job-warning", status: "processing" }],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          job: {
            id: "job-warning",
            status: "completed",
            warnings: [{ message: "Audio was normalized" }],
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ files: initialFiles }))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          processingJobs: [
            {
              id: "job-failed",
              status: "processing",
              originalName: "broken.mp4",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          job: {
            id: "job-failed",
            status: "failed",
            originalName: "broken.mp4",
            error: "Codec not supported",
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["video"], "movie.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith("Audio was normalized");

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith("broken.mp4: Codec not supported");
  });

  it("reports polling errors when interrupted conversion cannot be confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockRejectedValueOnce(new TypeError("upload interrupted"))
      .mockRejectedValueOnce(new Error("poll failed"));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["video"], "movie.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Error polling converted files:",
      expect.any(Error),
    );
    expect(alertSpy).toHaveBeenCalledWith("upload interrupted");
  });

  it("alerts when interrupted conversion polling finishes without converted files", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockRejectedValueOnce(new TypeError("upload interrupted"))
      .mockResolvedValue(okJson({ files: [] }));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    vi.useFakeTimers();
    const file = new File(["video"], "movie.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      const uploadPromise = result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
      await vi.runAllTimersAsync();
      await uploadPromise;
    });

    expect(alertSpy).toHaveBeenCalledWith("upload interrupted");
  });

  it("deletes one or many uploaded files and removes them from local state", async () => {
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: initialFiles }))
      .mockResolvedValue(okJson({ success: true }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    await act(async () => {
      await result.current.handleDeleteFile(initialFiles[0]);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/delete-file/img/first%20image.png/test-exp-123`,
      { method: "DELETE" },
    );
    expect(result.current.uploadedFiles).toEqual([initialFiles[1]]);

    await act(async () => {
      await result.current.handleDeleteMultipleFiles([initialFiles[1]]);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/delete-file/aud/sound.mp3/test-exp-123`,
      { method: "DELETE" },
    );
    expect(result.current.uploadedFiles).toEqual([]);
  });

  it("rethrows delete-multiple failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: initialFiles }))
      .mockRejectedValueOnce(new Error("delete failed"));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    await act(async () => {
      await expect(
        result.current.handleDeleteMultipleFiles([initialFiles[0]]),
      ).rejects.toThrow("delete failed");
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Error deleting multiple files:",
      expect.any(Error),
    );
  });
});
