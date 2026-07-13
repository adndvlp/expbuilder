import { makeTrial, mocks, okJson, resetPanelMocks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfigurationPanel from "../../../pages/ExperimentBuilder/components/ConfigurationPanel";

describe("ConfigurationPanel custom plugin options", () => {
  beforeEach(resetPanelMocks);

  it("opens editors for uploaded and custom plugin options", async () => {
    mocks.plugins = [
      {
        name: "plugin-custom",
        scripTag: "/plugins/plugin-custom.js",
        pluginCode: "class CustomPlugin {}",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial();
    globalThis.fetch = vi.fn(async (url: string) =>
      url === "http://localhost:3000/api/plugins-list"
        ? okJson({ plugins: ["custom"] })
        : okJson({}),
    ) as unknown as typeof fetch;
    const { rerender } = render(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await screen.findByLabelText("plugin select");
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "plugin-custom" },
    });
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, {
      plugin: "plugin-custom",
    });
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent(
      "plugin-custom",
    );

    mocks.plugins = [];
    mocks.selectedTrial = makeTrial();
    rerender(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() =>
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "custom" },
    });
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "custom" });
    expect(screen.queryByTestId("trials-config")).not.toBeInTheDocument();
  });

  it("increments new plugin names past existing numeric plugins", async () => {
    mocks.plugins = [
      { name: "1", scripTag: "/plugins/1.js", pluginCode: "", index: 0 },
      { name: "2", scripTag: "/plugins/2.js", pluginCode: "", index: 1 },
    ];
    mocks.selectedTrial = makeTrial();
    render(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await screen.findByLabelText("plugin select");
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "new-plugin" },
    });
    expect(mocks.setPlugins).toHaveBeenCalledWith([
      { name: "1", scripTag: "/plugins/1.js", pluginCode: "", index: 0 },
      { name: "2", scripTag: "/plugins/2.js", pluginCode: "", index: 1 },
      { name: "3", scripTag: "/plugins/3.js", pluginCode: "", index: 2 },
    ]);
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "3" });
  });

  it("exposes webgazer for uploaded webgazer plugins", async () => {
    mocks.plugins = [
      {
        name: "plugin-webgazer-custom",
        scripTag: "/plugins/plugin-webgazer-custom.js",
        pluginCode: "",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial();
    globalThis.fetch = vi.fn(async (url: string) =>
      url === "http://localhost:3000/api/plugins-list"
        ? okJson({ plugins: [] })
        : okJson({}),
    ) as unknown as typeof fetch;
    render(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    expect(
      await screen.findByRole("option", { name: "webgazer" }),
    ).toBeInTheDocument();
  });

  it("falls back when the response omits plugins", async () => {
    mocks.selectedTrial = makeTrial();
    globalThis.fetch = vi.fn(async () => okJson({})) as unknown as typeof fetch;
    render(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    expect(
      await screen.findByRole("option", { name: "Create plugin" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "html keyboard response" }),
    ).not.toBeInTheDocument();
  });

  it("renders an editor for a trial already using new-plugin", async () => {
    mocks.selectedTrial = makeTrial("new-plugin");
    render(<ConfigurationPanel />);
    expect(await screen.findByTestId("plugin-editor")).toHaveTextContent(
      "new-plugin",
    );
  });

  it("disables editing on metadata 404 and shows errors", async () => {
    mocks.plugins = [
      {
        name: "plugin-custom",
        scripTag: "/plugins/plugin-custom.js",
        pluginCode: "",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial("plugin-custom");
    globalThis.fetch = vi.fn(async (url: string) =>
      url === "http://localhost:3000/api/plugins-list"
        ? okJson({ plugins: ["plugin-custom"] })
        : ({
            status: 404,
            json: vi.fn(async () => ({})),
          } as unknown as Response),
    ) as unknown as typeof fetch;
    const { rerender } = render(<ConfigurationPanel />);
    await waitFor(() =>
      expect(screen.getByLabelText("toggle switch")).toBeDisabled(),
    );
    mocks.metadataError = "Metadata failed";
    rerender(<ConfigurationPanel />);
    expect(screen.getByText(/Metadata failed/)).toBeInTheDocument();
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent(
      "plugin-custom",
    );
  });
});
