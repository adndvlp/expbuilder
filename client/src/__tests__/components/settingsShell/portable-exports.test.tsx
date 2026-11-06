import { fetchMock, registerSettingsShellHooks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Settings from "../../../pages/Settings";

describe("Portable export", () => {
  registerSettingsShellHooks();
  it("requests the portable format when exporting all experiments", async () => {
    render(<Settings />);
    await screen.findByText(/2 experiments available/);
    fireEvent.change(screen.getByLabelText("Package type"), {
      target: { value: "portable" },
    });
    fireEvent.click(screen.getByText("Export all"));
    await waitFor(() =>
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-all-experiments?kind=portable",
      ),
    );
    expect(
      await screen.findByText("All experiments exported!"),
    ).toBeInTheDocument();
  });
  it("uses the same portable choice when exporting a selected experiment", async () => {
    render(<Settings />);
    await screen.findByText(/2 experiments available/);
    fireEvent.change(screen.getByLabelText("Package type"), {
      target: { value: "portable" },
    });
    fireEvent.click(screen.getByText("Export selected..."));
    fireEvent.click(screen.getByLabelText("Memory Task"));
    fireEvent.click(screen.getByText("Export (1)"));
    await waitFor(() =>
      expect(fetchMock()).toHaveBeenCalledWith(
        "http://localhost:3000/api/export-experiment/exp-1?kind=portable",
      ),
    );
    expect(await screen.findByText("Experiment exported!")).toBeInTheDocument();
  });
});
