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

  it("refreshes uploaded files after the cache expires", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: initialFiles }))
      .mockResolvedValueOnce(
        okJson({
          files: [
            ...initialFiles,
            { name: "new.png", url: "uploads/img/new.png", type: "img" },
          ],
        }),
      );

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });

    nowSpy.mockReturnValue(1_000 + 5 * 60 * 1000 + 1);

    act(() => {
      result.current.refreshUploadedFiles();
    });

    await waitFor(() => {
      expect(result.current.uploadedFiles).toHaveLength(3);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("uploads files, invalidates cache and reloads the folder listing", async () => {
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(okJson({ success: true }))
      .mockResolvedValueOnce(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["image"], "first image.png", { type: "image/png" });
    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual(initialFiles);
    });
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/upload-files/test-exp-123`,
      {
        method: "POST",
        body: expect.any(FormData),
      },
    );
    const uploadBody = fetchMock().mock.calls[1][1]?.body as FormData;
    expect(uploadBody.get("compressOversizedMedia")).toBe("false");
  });

  it("ignores empty file upload events", async () => {
    fetchMock().mockResolvedValueOnce(okJson({ files: [] }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it("surfaces structured upload errors from the backend", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(
        okJson(
          {
            errors: [
              { filename: "bad.png", message: "Unsupported dimensions" },
              { message: "Missing filename metadata" },
            ],
          },
          false,
        ),
      );

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    await act(async () => {
      await result.current.handleFileUpload({
        target: {
          files: [new File(["bad"], "bad.png", { type: "image/png" })],
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "bad.png: Unsupported dimensions\nMissing filename metadata",
    );
  });

  it("surfaces simple upload error payloads and post-upload warnings", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(okJson({ error: "Upload rejected" }, false))
      .mockResolvedValueOnce(
        okJson({
          success: true,
          warnings: [{ message: "Large file renamed" }],
          errors: [{ filename: "late.png", message: "Late warning" }],
        }),
      )
      .mockResolvedValueOnce(okJson({ files: initialFiles }));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    await act(async () => {
      await result.current.handleFileUpload({
        target: {
          files: [new File(["bad"], "bad.png", { type: "image/png" })],
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith("Upload rejected");

    await act(async () => {
      await result.current.handleFileUpload({
        target: {
          files: [new File(["ok"], "ok.png", { type: "image/png" })],
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith("Large file renamed");
    expect(alertSpy).toHaveBeenCalledWith("late.png: Late warning");
  });

  it("surfaces message upload errors and generic non-Error rejections", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(okJson({ message: "Message rejected" }, false))
      .mockRejectedValueOnce("string failure");

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    const file = new File(["bad"], "bad.png", { type: "image/png" });
    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    await act(async () => {
      await result.current.handleFileUpload({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith("Message rejected");
    expect(alertSpy).toHaveBeenCalledWith("Error uploading files");
    expect(consoleError).toHaveBeenCalledWith("string failure");
  });

  it("falls back to the default upload error for empty error payloads", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock()
      .mockResolvedValueOnce(okJson({ files: [] }))
      .mockResolvedValueOnce(okJson({}, false));

    const { result } = renderHook(() => useFileUpload({ folder: "img" }));

    await waitFor(() => {
      expect(result.current.uploadedFiles).toEqual([]);
    });

    await act(async () => {
      await result.current.handleFileUpload({
        target: {
          files: [new File(["bad"], "bad.png", { type: "image/png" })],
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(alertSpy).toHaveBeenCalledWith("Error uploading files");
  });
});
