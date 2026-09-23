import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RuntimeCopyNode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimeCopy/RuntimeCopyNode";
import type { HtmlSceneNode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

vi.mock("../../../pages/ExperimentBuilder/hooks/useExperimentID", () => ({
  useExperimentID: () => "exp-1",
}));

// The crash under test comes from survey-core itself, so this file needs the
// real implementation instead of the survey-core mock from the global setup.
vi.unmock("survey-core");

const canvasStyles: CanvasStyles = {
  width: 640,
  height: 480,
  backgroundColor: "#ffffff",
  fullScreen: true,
  progressBar: false,
};

function surveyNode(): HtmlSceneNode {
  const component = {
    id: "survey-1",
    type: "SurveyComponent",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 1,
    config: {
      survey_json: {
        source: "typed",
        value: {
          elements: [
            {
              type: "radiogroup",
              name: "",
              choices: [{ value: "", text: "" }],
            },
          ],
        },
      },
    },
  } as unknown as TrialComponent;

  return {
    id: "survey-1",
    type: "SurveyComponent",
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 1,
    component,
    canvasStyles,
  };
}

describe("RuntimeCopyNode error isolation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a local fallback instead of throwing when the component cannot render", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <RuntimeCopyNode
        node={surveyNode()}
        uploadedFiles={[]}
        isSelected={false}
        isDomActive={false}
        isTextEditing={false}
        onMeasure={vi.fn()}
      />,
    );

    const fallback = container.querySelector(
      "[data-runtime-copy-error='true']",
    );
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain(
      "SurveyComponent could not be rendered",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "[TrialDesigner] Runtime copy failed to render:",
      "SurveyComponent",
      expect.any(Error),
    );
  });
});
