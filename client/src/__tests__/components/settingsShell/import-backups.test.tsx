import { fetchMock, okJson, registerSettingsShellHooks } from "./testHarness";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Settings from "../../../pages/Settings";

describe("Settings shell", () => {
  registerSettingsShellHooks();

  it("imports backup ZIPs and schedules a reload on success", async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        return okJson({ success: true, imported: 2 });
      }
      return okJson({ success: true });
    });

    const { container } = render(<Settings />);

    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["zip"], "backup.zip", { type: "application/zip" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("2 experiment(s) imported successfully!"),
    ).toBeInTheDocument();
    expect(fetchMock()).toHaveBeenCalledWith(
      "http://localhost:3000/api/import-experiments",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(reload).toHaveBeenCalled();
  });

  it("opens the import picker and reports import validation or network failures", async () => {
    const { container } = render(<Settings />);

    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const clickSpy = vi.spyOn(input, "click").mockImplementation(() => {});

    await screen.findByText("Settings");
    fireEvent.click(screen.getByText("Choose .zip file"));
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [] } });
    expect(fetchMock()).not.toHaveBeenCalledWith(
      "http://localhost:3000/api/import-experiments",
      expect.anything(),
    );

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        return okJson({ success: false, error: "bad zip" });
      }
      return okJson({ success: true });
    });

    fireEvent.change(input, {
      target: {
        files: [new File(["zip"], "bad.zip", { type: "application/zip" })],
      },
    });

    expect(await screen.findByText("bad zip")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        return okJson({ success: false });
      }
      return okJson({ success: true });
    });

    fireEvent.change(input, {
      target: {
        files: [
          new File(["zip"], "missing-error.zip", { type: "application/zip" }),
        ],
      },
    });

    expect(await screen.findByText("Failed to import")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({ experiments: [] });
      }
      if (url === "http://localhost:3000/api/import-experiments") {
        throw new Error("network down");
      }
      return okJson({ success: true });
    });

    fireEvent.change(input, {
      target: {
        files: [new File(["zip"], "network.zip", { type: "application/zip" })],
      },
    });

    expect(await screen.findByText("Failed to import")).toBeInTheDocument();
  });
});
