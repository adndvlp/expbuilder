import { fetchMock, okJson, registerSettingsShellHooks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Settings from "../../../pages/Settings";

describe("Settings shell", () => {
  registerSettingsShellHooks();

  const saveExportedZip = () => (window as any).electron.saveExportedZip;

  it("exports multiple selected experiments and reports selected export failures", async () => {
    render(<Settings />);

    await screen.findByText(/2 experiments available/);
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    await waitFor(() => {
      expect(saveExportedZip()).toHaveBeenCalledWith(
        "/api/export-all-experiments?ids=exp-1%2Cexp-2",
        expect.stringMatching(/^experiments-backup-\d{4}-\d{2}-\d{2}\.zip$/),
      );
    });
    expect(
      await screen.findByText("2 experiments exported!"),
    ).toBeInTheDocument();

    saveExportedZip().mockResolvedValueOnce({
      success: false,
      error: "bad single export",
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    expect(await screen.findByText("bad single export")).toBeInTheDocument();

    saveExportedZip().mockResolvedValueOnce({
      success: false,
      error: "save cancelled by disk",
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));

    expect(
      await screen.findByText("save cancelled by disk"),
    ).toBeInTheDocument();

    saveExportedZip().mockResolvedValueOnce({
      success: false,
      error: "bad multi export",
    });

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));

    expect(await screen.findByText("bad multi export")).toBeInTheDocument();

    saveExportedZip().mockResolvedValueOnce({
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
    const save = saveExportedZip();
    save
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false })
      .mockResolvedValueOnce({ success: false, error: "Cancelled" })
      .mockResolvedValueOnce({ success: false });

    render(<Settings />);
    await screen.findByText(/2 experiments available/);

    fireEvent.click(screen.getByText("Export all"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export all"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save).toHaveBeenLastCalledWith(
      "/api/export-experiment/exp-plain",
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
    await waitFor(() => expect(save).toHaveBeenCalledTimes(5));
    expect(screen.queryByText("Export failed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Select all (2)"));
    fireEvent.click(screen.getByText("Export (2)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    save.mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("Export all"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("×"));

    save.mockRejectedValueOnce({});
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("exp-plain"));
    fireEvent.click(screen.getByText("Export (1)"));
    expect(await screen.findByText("Export failed")).toBeInTheDocument();
  });
});
