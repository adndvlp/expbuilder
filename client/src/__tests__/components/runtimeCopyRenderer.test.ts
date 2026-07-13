import { afterEach, describe, expect, it, vi } from "vitest";
import { Model } from "survey-core";
import {
  renderPreviewButtonComponent,
  renderPreviewFileUploadComponent,
  renderPreviewHtmlComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSketchpadComponent,
  renderPreviewSliderComponent,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  renderRuntimeCopy,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
import { getHtmlSceneNode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel";
import type {
  CanvasStyles,
  TrialComponent,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

const canvasStyles: CanvasStyles = {
  backgroundColor: "#ffffff",
  width: 1000,
  height: 800,
  fullScreen: true,
  progressBar: false,
};

function installCanvasContext() {
  const context = {
    canvas: document.createElement("canvas"),
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textAlign: "center",
    textBaseline: "middle",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({} as ImageData)),
    putImageData: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: Math.max(1, text.length * 10) })),
  } as unknown as CanvasRenderingContext2D;

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context,
  );
  return context;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function component(
  type: TrialComponent["type"],
  config: Record<string, any>,
): TrialComponent {
  return {
    id: `${type}-1`,
    type,
    x: 500,
    y: 400,
    width: 0,
    height: 0,
    rotation: 0,
    zIndex: 0,
    config,
  };
}

function installImageStub(complete: boolean) {
  class PreviewImage {
    draggable = true;
    naturalWidth = 64;
    naturalHeight = 32;
    width = 64;
    height = 32;
    onload: (() => void) | null = null;
    complete = complete;
    private currentSrc = "";

    set src(value: string) {
      this.currentSrc = value;
      if (this.complete) this.onload?.();
    }

    get src() {
      return this.currentSrc;
    }
  }

  vi.stubGlobal("Image", PreviewImage as unknown as typeof Image);
}

describe("frontend runtime copy", () => {
  it("renders real HTML and the native runtime slider", () => {
    const host = document.createElement("div");
    const html = renderRuntimeCopy(
      host,
      component("HtmlComponent", {
        stimulus: {
          source: "typed",
          value: "<button data-testid='real-html'>Real HTML</button>",
        },
      }),
      canvasStyles,
    );

    expect(host.querySelector("[data-testid='real-html']")).not.toBeNull();
    html.destroy();

    const slider = renderRuntimeCopy(
      host,
      component("SliderResponseComponent", {
        width: { source: "typed", value: 30 },
        height: { source: "typed", value: 12 },
        min: { source: "typed", value: 0 },
        max: { source: "typed", value: 100 },
        slider_start: { source: "typed", value: 50 },
        labels: { source: "typed", value: ["0", "100"] },
      }),
      canvasStyles,
    );

    const input = host.querySelector("input[type='range']") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.style.opacity).toBe("1");
    expect(slider.element.style.width).toBe("300px");
    expect(slider.element.style.height).toBe("120px");
    slider.destroy();
  });

  it("uses measured DOM size for the Konva hit box", () => {
    const trialComponent = component("HtmlComponent", {
      stimulus: { source: "typed", value: "<div>HTML</div>" },
    });
    const node = getHtmlSceneNode(trialComponent, canvasStyles, {
      [trialComponent.id]: { width: 321, height: 123 },
    });

    expect(node?.width).toBe(321);
    expect(node?.height).toBe(123);
  });

  it("does not invent optional sketchpad controls missing from runtime config", () => {
    const host = document.createElement("div");
    const sketchpad = renderRuntimeCopy(
      host,
      component("SketchpadComponent", {
        canvas_shape: { source: "typed", value: "rectangle" },
        canvas_width: { source: "typed", value: 400 },
        canvas_height: { source: "typed", value: 300 },
        show_clear_button: { source: "typed", value: true },
        show_undo_button: { source: "typed", value: true },
      }),
      canvasStyles,
    );

    expect(host.querySelector("#sketchpad-clear")).not.toBeNull();
    expect(host.querySelector("#sketchpad-undo")).not.toBeNull();
    expect(host.querySelector("#sketchpad-redo")).toBeNull();
    sketchpad.destroy();
  });

  it("renders direct preview defaults and coordinate-mode positioning", () => {
    const host = document.createElement("div");

    const html = renderPreviewHtmlComponent(
      host,
      {
        stimulus: "<strong>Positioned</strong>",
        coordinates: {},
        zIndex: null,
      },
      { coordinateMode: "canvas" },
    );

    expect(html.id).toBe("jspsych-dynamic-html-stimulus");
    expect(html.style.position).toBe("absolute");
    expect(html.style.left).toBe("512px");
    expect(html.style.top).toBe("384px");
    expect(html.style.zIndex).toBe("0");

    const positioned = renderPreviewHtmlComponent(
      host,
      {
        name: "named",
        stimulus: "<span>Named</span>",
        coordinates: { x: 50, y: -50 },
        zIndex: 4,
      },
      { coordinateMode: "canvas", canvasStyles: { width: 200, height: 100 } },
    );

    expect(positioned.id).toBe("jspsych-dynamic-named-stimulus");
    expect(positioned.style.left).toBe("150px");
    expect(positioned.style.top).toBe("75px");
    expect(positioned.style.zIndex).toBe("4");
  });

  it("renders canvas-backed text, cloze text, buttons, video and slider fallbacks", () => {
    installCanvasContext();
    const host = document.createElement("div");

    const cloze = renderPreviewTextComponent(host, {
      text: "Answer %blank%",
      font_size: 18,
      border_width: 2,
      border_color: "#111111",
      __preview_width: 240,
    });
    expect(cloze.id).toBe("jspsych-text-component");
    expect(cloze.querySelector("input")).not.toBeNull();
    expect(cloze.style.width).toBe("240px");

    const text = renderPreviewTextComponent(host, {
      name: "",
      text: "Long text that wraps over multiple words",
      text_align: "right",
      padding: "1px 2px 3px",
      background_color: "#ffffff",
      border_width: 1,
      border_color: "#000000",
      __canvas_width: 300,
    });
    expect(text.id).toBe("jspsych-text-component");
    expect(text.querySelector("canvas")).not.toBeNull();

    const button = renderPreviewButtonComponent(host, {
      choices: ["One", "Two", "Three"],
      grid_rows: 2,
      grid_columns: 3,
      button_border_width: 1,
      button_border_color: "#000000",
    });
    expect(button.querySelectorAll("button")).toHaveLength(3);

    const video = renderPreviewVideoComponent(host, {
      stimulus: "clip.",
      type: "",
      rate: 0,
      width: 30,
      height: 20,
    });
    expect(video.querySelector("source")?.getAttribute("type")).toBe("");
    expect((video.querySelector("video") as HTMLVideoElement).playbackRate).toBe(1);

    const slider = renderPreviewSliderComponent(host, {
      labels: "Low,High",
      width: 20,
      height: 10,
    });
    expect(slider.textContent).toContain("Low");

    const sliderWithoutLabels = renderPreviewSliderComponent(host, {
      labels: 123,
      width: 20,
      height: 10,
    });
    expect(sliderWithoutLabels.textContent).not.toContain("Low");
  });

  it("normalizes runtime copy config for input and button components", () => {
    installCanvasContext();
    const host = document.createElement("div");
    const input = renderRuntimeCopy(
      host,
      {
        ...component("InputResponseComponent", {
          input_font_size: { source: "none", value: 22 },
        }),
        inputFontSize: 20,
        inputWidth: 180,
      } as TrialComponent,
      canvasStyles,
    );

    expect(input.element.querySelector("input")).not.toBeNull();
    input.destroy();

    const button = renderRuntimeCopy(
      host,
      {
        ...component("ButtonResponseComponent", {
          choices: { source: "typed", value: ["https://cdn.test/image.png"] },
        }),
        width: 300,
        height: 120,
      },
      canvasStyles,
      (value) => `/assets/${value}`,
    );

    expect(button.element.querySelector("button")).not.toBeNull();
    button.destroy();

    const directInput = renderPreviewInputComponent(host, {
      text: "%answer%",
      placeholder: "Type",
      input_font_size: 14,
    });
    expect(directInput.querySelectorAll("input")).toHaveLength(1);
  });

  it("covers image preview sizing and non-complete image loading", () => {
    installCanvasContext();
    installImageStub(true);
    vi.stubGlobal("devicePixelRatio", 0);
    const host = document.createElement("div");

    const drawn = renderPreviewImageComponent(host, {
      stimulus: "image.png",
      __preview_height: 40,
      maintain_aspect_ratio: true,
    });

    expect(drawn.id).toBe("jspsych-dynamic-image-stimulus");
    expect(drawn.querySelector("canvas")?.style.width).toBe("80px");

    installImageStub(false);
    const pending = renderPreviewImageComponent(host, {
      name: "pending",
      stimulus: "pending.png",
    });

    expect(pending.id).toBe("jspsych-dynamic-pending-stimulus");
  });

  it("covers text and button rendering fallbacks", () => {
    const host = document.createElement("div");

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const fallbackText = renderPreviewTextComponent(host, {
      text: "Plain fallback",
    });
    expect(fallbackText.textContent).toBe("Plain fallback");

    const nullContextButton = renderPreviewButtonComponent(host, {
      choices: "One,Two",
      grid_rows: 0,
      button_padding: "bad 2px 3px 4px",
    });
    expect(nullContextButton.querySelectorAll("button")).toHaveLength(2);

    vi.restoreAllMocks();
    installCanvasContext();
    vi.stubGlobal("devicePixelRatio", 0);
    const canvasText = renderPreviewTextComponent(host, {
      name: "pad",
      text: "Alpha beta gamma delta",
      font_size: null,
      _font_size_runtime_vw: 10,
      padding: "1px 2px 3px 4px",
      background_color: "transparent",
      border_width: 0,
      __preview_width: 90,
      __canvas_width: 500,
    });
    expect(canvasText.id).toBe("jspsych-text-component-pad");

    const trailingWrap = renderPreviewTextComponent(host, {
      text: "a ",
      __preview_width: 1,
    });
    expect(trailingWrap.querySelector("canvas")).not.toBeNull();

    const clozeWithoutBorder = renderPreviewTextComponent(host, {
      text: "Answer %blank%",
      border_width: 0,
    });
    expect(clozeWithoutBorder.style.borderStyle).toBe("none");

    const noBorderButton = renderPreviewButtonComponent(host, {
      choices: ["Wide choice"],
      button_border_width: 0,
      button_border_color: "transparent",
      button_padding: "1px 2px 3px 4px",
    });
    expect(noBorderButton.querySelector("button")?.dataset.choice).toBe("Wide choice");
  });

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
    expect(fileCopy.element.querySelector("button")?.textContent).toBe("Upload");
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
    const originalOnValidateQuestion = (Model.prototype as any).onValidateQuestion;
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
        (Model.prototype as any).onValidateQuestion = originalOnValidateQuestion;
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
