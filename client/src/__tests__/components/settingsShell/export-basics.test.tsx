import { fetchMock, okJson, registerSettingsShellHooks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Settings from "../../../pages/Settings";

describe("Settings shell", () => {
  registerSettingsShellHooks();

  it("exports all experiments through Electron save dialog", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export all"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-all-experiments",
      );
      expect((window as any).electron.saveZipFile).toHaveBeenCalledWith(
        [1, 2, 3],
        expect.stringMatching(/^experiments-backup-\d{4}-\d{2}-\d{2}\.zip$/),
      );
    });
    expect(
      await screen.findByText("All experiments exported!"),
    ).toBeInTheDocument();
  });

  it("surfaces export-all server and save-dialog failures", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-1", name: "Memory Task" }],
        });
      }
      if (url === "http://localhost:3000/api/export-all-experiments") {
        return okJson({ error: "server refused export" }, false);
      }
      return okJson({ success: true });
    });

    render(<Settings />);

    await screen.findByText(/1 experiment available/);
    fireEvent.click(screen.getByText("Export all"));

    expect(
      await screen.findByText("server refused export"),
    ).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-1", name: "Memory Task" }],
        });
      }
      return okJson({ success: true });
    });
    (window as any).electron.saveZipFile.mockResolvedValueOnce({
      success: false,
      error: "disk full",
    });

    fireEvent.click(screen.getByText("Export all"));

    expect(await screen.findByText("disk full")).toBeInTheDocument();
  });

  it("falls back when export-all error responses cannot be parsed", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [{ experimentID: "exp-1", name: "Memory Task" }],
        });
      }
      if (url === "http://localhost:3000/api/export-all-experiments") {
        return {
          ok: false,
          json: vi.fn(async () => {
            throw new Error("invalid json");
          }),
          arrayBuffer: vi.fn(),
        } as unknown as Response;
      }
      return okJson({ success: true });
    });

    render(<Settings />);

    await screen.findByText(/1 experiment available/);
    fireEvent.click(screen.getByText("Export all"));

    expect(
      await screen.findByText("Error exporting experiments"),
    ).toBeInTheDocument();
  });

  it("exports selected experiments and resets the selection modal", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));

    expect(screen.getByText("Export experiments")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-experiment/exp-1",
      );
      expect((window as any).electron.saveZipFile).toHaveBeenCalledWith(
        [1, 2, 3],
        "Memory_Task-backup.zip",
      );
    });
    expect(await screen.findByText("Experiment exported!")).toBeInTheDocument();
    expect(screen.queryByText("Export experiments")).not.toBeInTheDocument();
  });

  it("selects all experiments, unselects one, cancels, and closes the export modal from the overlay", async () => {
    const { container } = render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));

    expect(screen.getByText("2 of 2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Select all (2)"));
    expect(screen.getByText("0 of 2 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Select all (2)"));

    fireEvent.click(screen.getByLabelText("Visual Search"));
    expect(screen.getByText("1 of 2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Export experiments")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(container.querySelector(".backup-modal-overlay")!);

    expect(screen.queryByText("Export experiments")).not.toBeInTheDocument();
  });
});
