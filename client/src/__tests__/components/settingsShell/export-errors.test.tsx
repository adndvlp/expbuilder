import { fetchMock, okJson, registerSettingsShellHooks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Settings from "../../../pages/Settings";

describe("Settings shell", () => {
  registerSettingsShellHooks();

  it("exports multiple selected experiments and reports selected export failures", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-all-experiments?ids=exp-1%2Cexp-2",
      );
    });
    expect(
      await screen.findByText("2 experiments exported!"),
    ).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      if (url === "http://localhost:3000/api/export-experiment/exp-1") {
        return okJson({ error: "bad single export" }, false);
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    expect(await screen.findByText("Export failed")).toBeInTheDocument();

    (window as any).electron.saveZipFile.mockResolvedValueOnce({
      success: false,
      error: "save cancelled by disk",
    });
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    expect(
      await screen.findByText("save cancelled by disk"),
    ).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      if (
        url ===
        "http://localhost:3000/api/export-all-experiments?ids=exp-1%2Cexp-2"
      ) {
        return okJson({ error: "bad multi export" }, false);
      }
      return okJson({ success: true });
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    expect(await screen.findByText("Export failed")).toBeInTheDocument();

    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-1", name: "Memory Task" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    });
    (window as any).electron.saveZipFile.mockResolvedValueOnce({
      success: false,
      error: "multi disk full",
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    expect(await screen.findByText("multi disk full")).toBeInTheDocument();
  });

  it("handles cancelled and sparse Electron export results", async () => {
    fetchMock().mockImplementation(async (url: string) => {
      if (url === "http://localhost:3000/api/load-experiments") {
        return okJson({
          experiments: [
            { experimentID: "exp-plain" },
            { experimentID: "exp-2", name: "Visual Search" },
          ],
        });
      }
      return okJson({ success: true });
    });
    const saveZipFile = (window as any).electron.saveZipFile;
    saveZipFile
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false });

    render(<Settings />);
    await screen.findByText(/2 experiments available/);

    fireEvent.click(screen.getByText("Export all"));
    await waitFor(() => expect(saveZipFile).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export all"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    await waitFor(() => expect(saveZipFile).toHaveBeenCalledTimes(3));
    expect(saveZipFile).toHaveBeenLastCalledWith(
      [1, 2, 3],
      "exp-plain-backup.zip",
    );
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));
    await waitFor(() => expect(saveZipFile).toHaveBeenCalledTimes(5));
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fetchMock().mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("Export all"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fetchMock().mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
  });
});
