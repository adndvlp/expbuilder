import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  previewMocks,
  registerExperimentPreviewLifecycle,
  requestBodyFromLastPreviewPost,
} from "./testHarness";
import ExperimentPreview from "../../../pages/ExperimentBuilder/components/ExperimentPreview";

describe("ExperimentPreview full previews", () => {
  registerExperimentPreviewLifecycle();

  it("generates and posts full local preview code in dev mode", async () => {
    render(
      <ExperimentPreview
        autoStart
        uploadedFiles={[
          { name: "image.png", url: "uploads/img/image.png", type: "img" },
        ]}
        canvasStyles={{
          backgroundColor: "#111111",
          width: 800,
          height: 600,
          fullScreen: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(previewMocks.generateLocalExperiment).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/trials-preview/test-exp-123",
        expect.any(Object),
      );
    });

    expect(requestBodyFromLastPreviewPost()).toEqual({
      generatedCode: "local-preview-code",
      canvasStyles: {
        backgroundColor: "#111111",
        width: 800,
        height: 600,
        fullScreen: false,
      },
    });
    expect(previewMocks.incrementVersion).toHaveBeenCalled();

    const iframe = screen.getByTitle("Experiment Preview");
    expect(iframe).toHaveAttribute(
      "src",
      "http://localhost:3000/test-exp-123/preview",
    );
    expect(iframe).toHaveStyle({
      width: "800px",
      height: "600px",
      background: "#111111",
    });
  });

  it("waits for a rendered iframe wrapper before measuring canvas scale", async () => {
    render(
      <ExperimentPreview
        canvasStyles={{ width: 640, height: 480, backgroundColor: "#ffffff" }}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTitle("Experiment Preview")).not.toBeInTheDocument();
  });

  it("falls back to the full local preview without a selection", async () => {
    previewMocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };

    render(<ExperimentPreview autoStart />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(previewMocks.generateSingleTrialCode).not.toHaveBeenCalled();
    expect(previewMocks.generateSingleLoopCode).not.toHaveBeenCalled();
    expect(previewMocks.generateLocalExperiment).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/trials-preview/test-exp-123",
      expect.any(Object),
    );
  });

  it("skips posting when a selected trial generator returns empty code", async () => {
    previewMocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };
    previewMocks.trialsContext.selectedTrial = {
      id: 5,
      name: "Empty Trial",
      plugin: "plugin-html-keyboard-response",
    };
    previewMocks.generateSingleTrialCode.mockResolvedValueOnce("");

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(previewMocks.generateSingleTrialCode).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      "http://localhost:3000/api/trials-preview/test-exp-123",
      expect.any(Object),
    );
  });

  it("toggles the preview iframe with Run Demo and Stop Demo", () => {
    render(<ExperimentPreview />);
    expect(screen.queryByTitle("Experiment Preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Run Demo"));
    expect(screen.getByTitle("Experiment Preview")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Stop Demo"));
    expect(screen.queryByTitle("Experiment Preview")).not.toBeInTheDocument();
  });
});
