import { makeTrial, mocks, resetPanelMocks } from "./testHarness";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ConfigurationPanel from "../../../pages/ExperimentBuilder/components/ConfigurationPanel";

describe("ConfigurationPanel selection and routing", () => {
  beforeEach(resetPanelMocks);

  it("shows the empty state and switches to loop configuration", () => {
    const { rerender } = render(<ConfigurationPanel />);
    expect(
      screen.getByText("Select a trial from the timeline or add a new one"),
    ).toBeInTheDocument();
    mocks.selectedLoop = { id: "loop-1", name: "Practice Loop" };
    rerender(<ConfigurationPanel />);
    expect(screen.getByTestId("loop-config")).toHaveTextContent(
      "Practice Loop",
    );
  });

  it("switches from dynamic config to a selected jsPsych plugin", async () => {
    mocks.selectedTrial = makeTrial();
    render(<ConfigurationPanel />);
    expect(await screen.findByTestId("trials-config")).toHaveTextContent(
      "plugin-dynamic",
    );
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await screen.findByLabelText("plugin select");
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "plugin-html-keyboard-response" },
    });
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, {
      plugin: "plugin-html-keyboard-response",
    });
    expect(screen.getByTestId("trials-config")).toHaveTextContent(
      "plugin-html-keyboard-response",
    );
  });

  it("routes webgazer choices to Webgazer configuration", async () => {
    mocks.selectedTrial = makeTrial();
    render(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await screen.findByLabelText("plugin select");
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "webgazer" },
    });
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "webgazer" });
    expect(screen.getByTestId("webgazer-config")).toHaveTextContent(
      "plugin-webgazer-calibrate",
    );
  });

  it("does not render trial configuration for the selector placeholder", async () => {
    mocks.selectedTrial = makeTrial("Select a stimulus-response");
    render(<ConfigurationPanel />);
    await screen.findByLabelText("Toggle jsPsych plugins");
    expect(screen.queryByTestId("trials-config")).not.toBeInTheDocument();
    expect(screen.queryByTestId("webgazer-config")).not.toBeInTheDocument();
  });

  it("renders uploaded plugin config and opens its editor", async () => {
    mocks.plugins = [
      {
        name: "plugin-custom",
        scripTag: "/plugins/plugin-custom.js",
        pluginCode: "class CustomPlugin {}",
        index: 0,
      },
    ];
    mocks.selectedTrial = makeTrial("plugin-custom");
    render(<ConfigurationPanel />);
    expect(await screen.findByTestId("trials-config")).toHaveTextContent(
      "plugin-custom",
    );
    fireEvent.click(screen.getByLabelText("toggle switch"));
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent(
      "plugin-custom",
    );
  });

  it("creates a new plugin slot and assigns it to the trial", async () => {
    mocks.selectedTrial = makeTrial();
    render(<ConfigurationPanel />);
    fireEvent.click(screen.getByLabelText("Toggle jsPsych plugins"));
    await waitFor(() =>
      expect(screen.getByLabelText("plugin select")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("plugin select"), {
      target: { value: "new-plugin" },
    });
    expect(mocks.setPlugins).toHaveBeenCalledWith([
      { name: "1", scripTag: "/plugins/1.js", pluginCode: "", index: 0 },
    ]);
    expect(mocks.updateTrial).toHaveBeenCalledWith(1, { plugin: "1" });
    expect(screen.getByTestId("plugin-editor")).toHaveTextContent("1");
  });
});
