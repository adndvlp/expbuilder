import { describe, expect, it, vi } from "vitest";
import { Model } from "survey-core";
import {
  renderPreviewFileUploadComponent,
  renderPreviewSketchpadComponent,
  renderRuntimeCopy,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
import { canvasStyles, component, installCanvasContext } from "./testHarness";

describe("runtime copy: sketchpad, upload and survey branches", () => {
  it("covers sketchpad control absence, color fallback and prompt placement", () => {
    installCanvasContext();
    const host = document.createElement("div");

    const noControls = renderPreviewSketchpadComponent(host, {
      canvas_shape: "rectangle",
      canvas_width: 100,
      canvas_height: 80,
      stroke_color_palette: "not-array",
      prompt: "<p>Below</p>",
      prompt_location: "belowcanvas",
    });

    expect(noControls.element.textContent).toContain("Below");
    const canvas = noControls.canvas as HTMLCanvasElement;
    Object.defineProperty(canvas, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 100, height: 80 }),
    });
    const pointerDown = new MouseEvent("pointerdown", {
      clientX: 10,
      clientY: 12,
    }) as PointerEvent;
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    canvas.dispatchEvent(pointerDown);
    canvas.dispatchEvent(new MouseEvent("pointerup") as PointerEvent);
    noControls.destroy();

    const promptIgnored = renderPreviewSketchpadComponent(host, {
      canvas_shape: "rectangle",
      canvas_width: 100,
      canvas_height: 80,
      prompt: "<p>Ignored</p>",
      prompt_location: "besidecanvas",
    });
    expect(promptIgnored.element.textContent).not.toContain("Ignored");
    promptIgnored.destroy();

    const withPalette = renderPreviewSketchpadComponent(host, {
      canvas_shape: "rectangle",
      canvas_width: 100,
      canvas_height: 80,
      stroke_color_palette: ["#ff0000"],
      show_clear_button: true,
      show_undo_button: true,
      show_redo_button: true,
    });
    const colorButton = withPalette.element.querySelector(
      ".sketchpad-color-select",
    ) as HTMLButtonElement;
    colorButton.removeAttribute("data-color");
    colorButton.click();
    expect(withPalette.element.querySelector("#sketchpad-redo")).not.toBeNull();
    withPalette.destroy();
  });

  it("covers file upload and survey runtime copy branches", () => {
    const host = document.createElement("div");

    const upload = renderPreviewFileUploadComponent(host, {
      accept: "csv,application/json,.txt",
      multiple: true,
      button_label: "Pick file",
    });
    const input = upload.querySelector("input") as HTMLInputElement;
    expect(input.accept).toBe(".csv,application/json,.txt");
    expect(input.multiple).toBe(true);

    const fileCopy = renderRuntimeCopy(
      host,
      component("FileUploadResponseComponent", {
        button_label: { source: "typed", value: "Upload" },
      }),
      canvasStyles,
    );
    expect(fileCopy.element.querySelector("button")?.textContent).toBe(
      "Upload",
    );
    fileCopy.destroy();

    const emptySurvey = renderRuntimeCopy(
      host,
      {
        ...component("SurveyComponent", undefined as any),
        width: 0,
        height: 0,
      },
      canvasStyles,
    );
    expect(emptySurvey.element.id).toBe("jspsych-survey-surveyjs-container");
    emptySurvey.destroy();

    const surveyFunction = vi.fn();
    const validationFunction = vi.fn();
    const themedSurvey = renderRuntimeCopy(
      host,
      component("SurveyComponent", {
        survey_json: {
          source: "typed",
          value: {
            elements: [{ type: "text", name: "q1" }],
            themeVariables: { "--sjs-primary-backcolor": "#111111" },
          },
        },
        survey_function: { source: "typed", value: surveyFunction },
        validation_function: { source: "typed", value: validationFunction },
        min_width: { source: "typed", value: "50vw" },
      }),
      canvasStyles,
    );
    expect(surveyFunction).toHaveBeenCalled();
    themedSurvey.destroy();

    const originalApplyTheme = (Model.prototype as any).applyTheme;
    const originalOnValidateQuestion = (Model.prototype as any)
      .onValidateQuestion;
    const applyTheme = vi.fn();
    const addValidation = vi.fn();
    (Model.prototype as any).applyTheme = applyTheme;
    (Model.prototype as any).onValidateQuestion = { add: addValidation };
    try {
      const surveyWithApplyTheme = renderRuntimeCopy(
        host,
        component("SurveyComponent", {
          survey_json: {
            source: "typed",
            value: {
              elements: [],
              themeVariables: { "--sjs-primary-backcolor": "#222222" },
            },
          },
          validation_function: { source: "typed", value: validationFunction },
        }),
        canvasStyles,
      );
      expect(applyTheme).toHaveBeenCalledWith(
        expect.objectContaining({ themeName: "plain" }),
      );
      expect(addValidation).toHaveBeenCalledWith(validationFunction);
      surveyWithApplyTheme.destroy();
    } finally {
      if (originalApplyTheme) {
        (Model.prototype as any).applyTheme = originalApplyTheme;
      } else {
        delete (Model.prototype as any).applyTheme;
      }
      if (originalOnValidateQuestion) {
        (Model.prototype as any).onValidateQuestion =
          originalOnValidateQuestion;
      } else {
        delete (Model.prototype as any).onValidateQuestion;
      }
    }
  });

  it("covers runtime config defaults for missing input and button config", () => {
    installCanvasContext();
    const host = document.createElement("div");

    const inputFromConfig = renderRuntimeCopy(
      host,
      component("InputResponseComponent", {
        input_font_size: { source: "typed", value: 24 },
      }),
      canvasStyles,
    );
    expect(inputFromConfig.element.querySelector("input")).not.toBeNull();
    inputFromConfig.destroy();

    const inputDefault = renderRuntimeCopy(
      host,
      {
        ...component("InputResponseComponent", undefined as any),
        inputFontSize: undefined,
        inputWidth: undefined,
      } as TrialComponent,
      canvasStyles,
    );
    expect(inputDefault.element.querySelector("input")).not.toBeNull();
    inputDefault.destroy();

    const buttonDefault = renderRuntimeCopy(
      host,
      {
        ...component("ButtonResponseComponent", undefined as any),
        width: 0,
        height: 0,
      },
      canvasStyles,
    );
    expect(buttonDefault.element.querySelector("button")?.dataset.choice).toBe(
      "Button",
    );
    buttonDefault.destroy();
  });
});
