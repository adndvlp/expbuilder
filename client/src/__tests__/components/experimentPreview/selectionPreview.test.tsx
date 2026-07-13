import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  previewMocks,
  registerExperimentPreviewLifecycle,
  requestBodyFromLastPreviewPost,
} from "./testHarness";
import ExperimentPreview from "../../../pages/ExperimentBuilder/components/ExperimentPreview";

describe("ExperimentPreview selected item previews", () => {
  registerExperimentPreviewLifecycle();

  it("wraps a selected trial preview with participant bootstrap code", async () => {
    previewMocks.devMode = { isDevMode: false, isSaveMode: true, code: "" };
    previewMocks.trialsContext.selectedTrial = {
      id: 3,
      name: "Choice Trial",
      plugin: "plugin-html-button-response",
    };

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(previewMocks.generateSingleTrialCode).toHaveBeenCalledWith(
        previewMocks.trialsContext.selectedTrial,
        [],
        "test-exp-123",
        previewMocks.getTrial,
        previewMocks.getLoopTimeline,
        previewMocks.getLoop,
      );
    });

    const body = requestBodyFromLastPreviewPost();
    expect(body.generatedCode).toContain('"Choice Trial_result_"');
    expect(body.generatedCode).toContain(
      "window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/test-exp-123';",
    );
    expect(body.generatedCode).toContain("const singleTrial = {};");
    expect(body.generatedCode).toContain("jsPsych.run(timeline);");
  });

  it("generates selected loop previews with loop timeline helpers", async () => {
    previewMocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };
    previewMocks.trialsContext.selectedLoop = {
      id: "loop-1",
      name: "Practice Loop",
    };

    render(
      <ExperimentPreview
        autoStart
        uploadedFiles={[
          { name: "tone.mp3", url: "uploads/aud/tone.mp3", type: "aud" },
        ]}
      />,
    );

    await waitFor(() => {
      expect(previewMocks.generateSingleLoopCode).toHaveBeenCalledWith(
        previewMocks.trialsContext.selectedLoop,
        "test-exp-123",
        [{ name: "tone.mp3", url: "uploads/aud/tone.mp3", type: "aud" }],
        previewMocks.getTrial,
        previewMocks.getLoopTimeline,
        previewMocks.getLoop,
      );
    });

    const body = requestBodyFromLastPreviewPost();
    expect(body.generatedCode).toContain('"Practice Loop_result_"');
    expect(body.generatedCode).toContain("const singleLoop = {};");
  });

  it("uses an empty experiment id for a trial without a route id", async () => {
    previewMocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };
    previewMocks.experimentID = undefined;
    previewMocks.trialsContext.selectedTrial = {
      id: 7,
      name: "Route-less Trial",
      plugin: "plugin-html-keyboard-response",
    };

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(previewMocks.generateSingleTrialCode).toHaveBeenCalledWith(
        previewMocks.trialsContext.selectedTrial,
        [],
        "",
        previewMocks.getTrial,
        previewMocks.getLoopTimeline,
        previewMocks.getLoop,
      );
    });
  });

  it("uses an empty experiment id for a loop without a route id", async () => {
    previewMocks.devMode = { isDevMode: false, isSaveMode: false, code: "" };
    previewMocks.experimentID = undefined;
    previewMocks.trialsContext.selectedLoop = {
      id: "loop-no-route",
      name: "Route-less Loop",
    };

    render(<ExperimentPreview autoStart />);

    await waitFor(() => {
      expect(previewMocks.generateSingleLoopCode).toHaveBeenCalledWith(
        previewMocks.trialsContext.selectedLoop,
        "",
        [],
        previewMocks.getTrial,
        previewMocks.getLoopTimeline,
        previewMocks.getLoop,
      );
    });
  });
});
