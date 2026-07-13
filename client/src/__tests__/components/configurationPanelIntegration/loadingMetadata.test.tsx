import { makeTrial, mocks, okJson, resetPanelMocks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfigurationPanel from "../../../pages/ExperimentBuilder/components/ConfigurationPanel";

describe("ConfigurationPanel loading and metadata", () => {
  beforeEach(resetPanelMocks);

  it("skips fetch work while saving", () => {
    mocks.isSaving = true;
    mocks.selectedTrial = makeTrial("plugin-html-keyboard-response");
    render(<ConfigurationPanel />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("trials-config")).toHaveTextContent(
      "plugin-dynamic",
    );
  });

  it("reports plugin list loading failures", async () => {
    mocks.selectedTrial = makeTrial();
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    render(<ConfigurationPanel />);
    await waitFor(() =>
      expect(mocks.setMetadataError).toHaveBeenCalledWith(
        expect.stringContaining("Could not load plugin list: Error: offline"),
      ),
    );
  });

  it("handles metadata 404 and rejected checks", async () => {
    mocks.selectedTrial = makeTrial("plugin-missing");
    globalThis.fetch = vi.fn(async (url: string) =>
      url === "http://localhost:3000/api/plugins-list"
        ? okJson({ plugins: ["plugin-missing"] })
        : ({
            status: 404,
            json: vi.fn(async () => ({})),
          } as unknown as Response),
    ) as unknown as typeof fetch;
    const { rerender } = render(<ConfigurationPanel />);
    await waitFor(() =>
      expect(mocks.setMetadataError).toHaveBeenCalledWith(
        "No valid info object in plugin-missing",
      ),
    );

    vi.clearAllMocks();
    mocks.selectedTrial = makeTrial("plugin-rejected");
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "http://localhost:3000/api/plugins-list") {
        return okJson({ plugins: ["plugin-rejected"] });
      }
      throw new Error("metadata offline");
    }) as unknown as typeof fetch;
    rerender(<ConfigurationPanel />);
    await waitFor(() =>
      expect(mocks.setMetadataError).toHaveBeenCalledWith(
        "No valid info object in plugin-rejected",
      ),
    );
  });

  it("turns jsPsych mode off and ignores null select changes", async () => {
    mocks.selectedTrial = makeTrial("plugin-html-keyboard-response");
    render(<ConfigurationPanel />);
    await screen.findByLabelText("plugin select");
    expect(screen.getByTestId("select-style-probe")).toHaveTextContent(
      "controlFocused",
    );
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "" },
    });
    expect(mocks.updateTrial).not.toHaveBeenCalledWith(1, { plugin: "" });
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, {
      plugin: "plugin-dynamic",
    });
  });
});
