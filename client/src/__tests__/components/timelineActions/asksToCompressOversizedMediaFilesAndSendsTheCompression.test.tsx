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

  it("asks to compress oversized media files and sends the compression flag", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          files: [
            {
              originalName: "blue.png",
              storedName: "blue.webp",
              url: "img/blue.webp",
              type: "img",
              compressed: true,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["image"], "blue.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("blue.png"),
    );
    const uploadBody = fetchMock().mock.calls[1][1]?.body as FormData;
    expect(uploadBody.get("compressOversizedMedia")).toBe("true");
  });

  it("detects oversized media by extension and summarizes long confirm lists", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(okJson({ success: true }))
      .mockResolvedValueOnce(okJson({ files: [] }));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const files = Array.from({ length: 6 }, (_, index) => {
      const file = new File(["video"], `movie-${index}.mov`, {
        type: "text/plain",
      });
      Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });
      return file;
    });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("...and 1 more"),
    );
    const uploadBody = fetchMock().mock.calls[1][1]?.body as FormData;
    expect(uploadBody.get("compressOversizedMedia")).toBe("false");
  });

  it("refreshes converted media when the upload request is interrupted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const convertedFiles = [
      { name: "movie.webm", url: "vid/movie.webm", type: "vid" },
    ];
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okJson({ files: convertedFiles }));

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

    expect(result.current.uploadedFiles).toEqual(convertedFiles);
    expect(alertSpy).not.toHaveBeenCalledWith("Failed to fetch");
  });

  it("polls upload jobs and refreshes files after background conversion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const convertedFiles = [
      { name: "movie.webm", url: "vid/movie.webm", type: "vid" },
    ];
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson(
          {
            success: true,
            processing: true,
            processingJobs: [{ id: "job-1", status: "processing" }],
          },
          true,
          202,
        ),
      )
      .mockResolvedValueOnce(
        okJson({
          success: true,
          job: { id: "job-1", status: "completed", warnings: [] },
        }),
      )
      .mockResolvedValueOnce(okJson({ files: convertedFiles }));

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

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/upload-jobs/job-1`,
    );
    expect(result.current.uploadedFiles).toEqual(convertedFiles);
  });

  it("continues polling upload jobs after an in-progress result", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const convertedFiles = [
      { name: "clip.ogg", url: "aud/clip.ogg", type: "aud" },
    ];
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          processingJobs: [
            {
              id: "job-audio",
              status: "processing",
              progress: 20,
              storedName: "clip.ogg",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          job: {
            id: "job-audio",
            status: "processing",
            progress: 45,
            storedName: "clip.ogg",
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          job: {
            id: "job-audio",
            status: "completed",
            storedName: "clip.ogg",
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ files: convertedFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "all" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["audio"], "clip.wav", { type: "audio/wav" });
    Object.defineProperty(file, "size", { value: 101 * 1024 * 1024 });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/upload-jobs/job-audio`,
    );
    expect(result.current.uploadedFiles).toEqual(convertedFiles);
  });
});
