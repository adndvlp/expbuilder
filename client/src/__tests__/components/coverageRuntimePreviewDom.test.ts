import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Model } from "survey-core";
import {
  ensurePreviewSketchpadStyles,
  renderPreviewButtonComponent,
  renderPreviewFileUploadComponent,
  renderPreviewHtmlComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSketchpadComponent,
  renderPreviewSliderComponent,
  renderPreviewSurveyContainer,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  renderRuntimeCopy,
  resolvePreviewParam,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
import { TrialComponent } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

function canvasContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: String(text).length * 8 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    lineJoin: "round",
    lineCap: "round",
    lineWidth: 1,
    font: "",
    fillStyle: "",
    strokeStyle: "",
    textAlign: "center",
    textBaseline: "middle",
  };
}

class MockImage {
  naturalWidth = 320;
  naturalHeight = 180;
  width = 320;
  height = 180;
  complete = true;
  draggable = false;
  onload: null | (() => void) = null;
  private source = "";

  set src(value: string) {
    this.source = value;
    this.onload?.();
  }

  get src() {
    return this.source;
  }
}

function config(overrides: Record<string, unknown> = {}) {
  return {
    name: "preview",
    coordinates: { source: "typed", value: { x: 25, y: -25 } },
    zIndex: { source: "typed", value: 3 },
    ...overrides,
  };
}

function trialComponent(
  type: TrialComponent["type"],
  overrides: Partial<TrialComponent> = {},
): TrialComponent {
  return {
    id: `${type}-id`,
    type,
    x: 50,
    y: 60,
    width: 200,
    height: 100,
    config: {},
    ...overrides,
  };
}

const canvasStyles = {
  backgroundColor: "#ffffff",
  width: 800,
  height: 600,
  fullScreen: false,
  progressBar: false,
};

beforeEach(() => {
  (Model.prototype as any).applyTheme = vi.fn();
  Object.defineProperty(Model.prototype, "onValidateQuestion", {
    configurable: true,
    get: () => ({ add: vi.fn() }),
  });
  vi.stubGlobal("Image", MockImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    canvasContext() as any,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.head.querySelector("#sketchpad-styles")?.remove();
});

describe("runtime preview DOM renderers", () => {
  it("resolves parameters and renders html, image and video components", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    expect(resolvePreviewParam(undefined, "fallback")).toBe("fallback");
    expect(
      resolvePreviewParam({ source: "typed", value: "typed value" }, "fallback"),
    ).toBe("typed value");
    expect(resolvePreviewParam({ source: "csv", value: null }, "fallback")).toBe(
      "fallback",
    );
    expect(resolvePreviewParam("raw", "fallback")).toBe("raw");

    const html = renderPreviewHtmlComponent(
      container,
      config({ stimulus: { source: "typed", value: "<b>Hello</b>" } }),
      { coordinateMode: "canvas", canvasStyles },
    );
    expect(html.innerHTML).toContain("<b>Hello</b>");
    expect(html.style.position).toBe("absolute");
    expect(html.style.left).toBe("500px");

    const image = renderPreviewImageComponent(
      container,
      config({
        stimulus: "image.png",
        __preview_width: 160,
        maintain_aspect_ratio: true,
      }),
    );
    expect(image.querySelector("canvas")).toBeTruthy();
    expect((image as HTMLElement).style.width).toBe("160px");

    const video = renderPreviewVideoComponent(
      container,
      config({
        stimulus: ["clip.mp4?cache=1", "clip.webm"],
        controls: true,
        rate: 1.5,
        __preview_height: 120,
      }),
    );
    const videoElement = video.querySelector("video")!;
    expect(videoElement.controls).toBe(true);
    expect(videoElement.playbackRate).toBe(1.5);
    expect(videoElement.querySelectorAll("source")).toHaveLength(2);
  });

  it("renders text, button, input and slider previews", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cloze = renderPreviewTextComponent(
      container,
      config({
        text: "The %answer% is here",
        font_size: 18,
        padding: "4px 8px",
        border_width: 1,
        border_color: "#111",
      }),
    );
    expect(cloze.querySelectorAll("input")).toHaveLength(1);

    const textCanvas = renderPreviewTextComponent(
      container,
      config({
        text: "Long text that should wrap into multiple words",
        __preview_width: 90,
        font_size: 16,
        line_height: 1.2,
        background_color: "#fff",
        border_width: 2,
        border_color: "#333",
        text_align: "left",
      }),
    );
    expect(textCanvas.querySelector("canvas")).toBeTruthy();

    const buttons = renderPreviewButtonComponent(
      container,
      config({
        choices: ["Yes", "No,Maybe", "photo.png"],
        grid_rows: 2,
        button_padding: "5px 10px",
        image_button_width: 80,
        image_button_height: 60,
        button_border_width: 2,
      }),
    );
    expect(buttons.querySelectorAll("button")).toHaveLength(4);
    expect(buttons.querySelector('[aria-label="photo.png"]')).toBeTruthy();

    const input = renderPreviewInputComponent(
      container,
      config({
        text: "Name: %name%",
        placeholder: "type",
        input_type: "email",
        input_font_size: 20,
      }),
    );
    const inputElement = input.querySelector("input")!;
    expect(inputElement.type).toBe("email");
    expect(inputElement.placeholder).toBe("type");

    const slider = renderPreviewSliderComponent(
      container,
      config({
        min: 0,
        max: 10,
        slider_start: 4,
        labels: ["Low", "High"],
        require_movement: true,
        __preview_width: 320,
        __preview_height: 120,
      }),
    );
    expect(slider.querySelector("input")?.getAttribute("type")).toBe("range");
    expect(slider.textContent).toContain("movement required");
    expect(slider.textContent).toContain("Low");
  });

  it("renders survey, file upload and sketchpad previews", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const survey = renderPreviewSurveyContainer(
      container,
      config({ min_width: "420px" }),
      { coordinateMode: "canvas", canvasStyles },
    );
    expect(survey.element.id).toBe("jspsych-survey-surveyjs-container");
    expect(survey.surveyHost.style.minWidth).toBe("420px");

    const upload = renderPreviewFileUploadComponent(
      container,
      config({
        accept: "pdf, image/png",
        multiple: true,
        button_label: "Upload evidence",
      }),
    );
    const fileInput = upload.querySelector("input")!;
    expect(fileInput.accept).toBe(".pdf,image/png");
    expect(fileInput.multiple).toBe(true);
    expect(upload.textContent).toContain("Upload evidence");

    ensurePreviewSketchpadStyles({
      canvas_shape: "circle",
      canvas_diameter: 220,
      canvas_border_width: 3,
      canvas_border_color: "#123456",
    });
    expect(document.head.querySelector("#sketchpad-styles")).toBeTruthy();

    const sketchpad = renderPreviewSketchpadComponent(
      container,
      config({
        canvas_shape: "rectangle",
        canvas_width: 120,
        canvas_height: 80,
        canvas_border_width: 2,
        stroke_width: 4,
        stroke_color_palette: ["#000000", "#ff0000"],
        show_clear_button: true,
        show_undo_button: true,
        show_redo_button: true,
        prompt: "<p>Draw here</p>",
        prompt_location: "belowcanvas",
        background_image: "bg.png",
      }),
    );

    const canvas = sketchpad.canvas!;
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 120,
        height: 80,
        right: 120,
        bottom: 80,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const pointerDown = new MouseEvent("pointerdown", {
      clientX: 10,
      clientY: 10,
    }) as any;
    pointerDown.pointerId = 1;
    canvas.dispatchEvent(pointerDown);
    canvas.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 20, clientY: 20 }),
    );
    canvas.dispatchEvent(new MouseEvent("pointerup"));
    sketchpad.element.querySelector<HTMLButtonElement>(".sketchpad-color-select")?.click();
    sketchpad.element.querySelector<HTMLButtonElement>("#sketchpad-clear")?.click();
    sketchpad.element.querySelector<HTMLButtonElement>("#sketchpad-undo")?.click();
    sketchpad.element.querySelector<HTMLButtonElement>("#sketchpad-redo")?.click();

    expect(sketchpad.element.textContent).toContain("Draw here");
    sketchpad.destroy();
    expect(container.querySelector("#jspsych-sketchpad-container")).toBeNull();
  });

  it("renders runtime copies and destroys them", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const resolveAsset = (value: string) => `/assets/${value}`;

    const image = renderRuntimeCopy(
      container,
      trialComponent("ImageComponent", {
        config: { stimulus: { source: "typed", value: "photo.png" } },
      }),
      canvasStyles,
      resolveAsset,
    );
    expect(container.innerHTML).toContain("dynamic-image-component");
    image.destroy();

    const video = renderRuntimeCopy(
      container,
      trialComponent("VideoComponent", {
        config: { stimulus: { source: "typed", value: ["clip.mp4"] } },
      }),
      canvasStyles,
      resolveAsset,
    );
    expect(video.element.querySelector("source")?.src).toContain(
      "/assets/clip.mp4",
    );
    video.destroy();

    const button = renderRuntimeCopy(
      container,
      trialComponent("ButtonResponseComponent", {
        config: { choices: { source: "typed", value: ["yes", "icon.png"] } },
      }),
      canvasStyles,
      resolveAsset,
    );
    expect(button.element.querySelector('[aria-label="/assets/icon.png"]')).toBeTruthy();
    button.destroy();

    const sketchpad = renderRuntimeCopy(
      container,
      trialComponent("SketchpadComponent", {
        config: {
          canvas_shape: { source: "typed", value: "circle" },
          canvas_diameter: { source: "typed", value: 120 },
          background_image: { source: "typed", value: "bg.png" },
        },
      }),
      canvasStyles,
      resolveAsset,
    );
    expect(sketchpad.element.querySelector(".sketchpad-circle")).toBeTruthy();
    sketchpad.destroy();

    const survey = renderRuntimeCopy(
      container,
      trialComponent("SurveyComponent", {
        config: {
          survey_json: {
            source: "typed",
            value: {
              elements: [{ type: "text", name: "q1" }],
              themeVariables: { "--sjs-primary-backcolor": "#111111" },
            },
          },
          survey_function: { source: "typed", value: vi.fn() },
          validation_function: { source: "typed", value: vi.fn() },
          min_width: { source: "typed", value: "80vw" },
        },
      }),
      canvasStyles,
    );
    expect(survey.element.id).toBe("jspsych-survey-surveyjs-container");
    survey.destroy();

    expect(() =>
      renderRuntimeCopy(
        container,
        { ...(trialComponent("AudioComponent") as any), type: "Unknown" },
        canvasStyles,
      ),
    ).toThrow("No frontend runtime copy");
  });

  it("covers preview renderer edge variants", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    class ZeroSizeImage {
      naturalWidth = 0;
      naturalHeight = 0;
      width = 0;
      height = 0;
      complete = true;
      draggable = false;
      onload: null | (() => void) = null;
      private source = "";

      set src(value: string) {
        this.source = value;
        this.onload?.();
      }

      get src() {
        return this.source;
      }
    }

    vi.stubGlobal("Image", ZeroSizeImage);
    const zeroImage = renderPreviewImageComponent(
      container,
      config({ stimulus: "empty.png" }),
    );
    expect(zeroImage.querySelector("canvas")).toBeTruthy();

    vi.stubGlobal("Image", MockImage);
    renderPreviewImageComponent(
      container,
      config({
        stimulus: "height-only.png",
        __preview_height: 90,
        maintain_aspect_ratio: true,
      }),
    );
    expect((container.lastElementChild as HTMLElement).style.width).toBe(
      "160px",
    );

    const getContextMock = vi.mocked(HTMLCanvasElement.prototype.getContext);
    getContextMock.mockReturnValueOnce(null as any);
    renderPreviewImageComponent(container, config({ stimulus: "no-ctx.png" }));

    getContextMock.mockReturnValueOnce(null as any);
    const fallbackText = renderPreviewTextComponent(
      container,
      config({ text: "fallback text" }),
    );
    expect(fallbackText.textContent).toBe("fallback text");

    const widthOnlyVideo = renderPreviewVideoComponent(
      container,
      config({ stimulus: "clip.mp4", __preview_width: 220 }),
    );
    expect(widthOnlyVideo.querySelector("video")?.style.height).toBe("auto");

    const blankButtons = renderPreviewButtonComponent(
      container,
      config({
        choices: "",
        button_padding: { source: "typed", value: 4 },
      }),
    );
    expect(blankButtons.querySelectorAll("button")).toHaveLength(1);

    getContextMock
      .mockReturnValueOnce(canvasContext() as any)
      .mockReturnValueOnce(null as any);
    renderPreviewButtonComponent(
      container,
      config({
        choices: ["Very very very long button label"],
        __preview_width: 36,
        __preview_height: 34,
      }),
    );

    renderPreviewButtonComponent(
      container,
      config({
        choices: ["Very very very long button label"],
        __preview_width: 42,
        __preview_height: 34,
      }),
    );

    const emptyLineText = renderPreviewTextComponent(
      container,
      config({
        text: "\nshort",
        __preview_width: 500,
        background_color: "",
        border_color: "none",
      }),
    );
    expect(emptyLineText.querySelector("canvas")).toBeTruthy();

    const sizedInput = renderPreviewInputComponent(
      container,
      config({
        text: "%%",
        __preview_width: 180,
        __preview_height: 40,
      }),
    );
    const sizedInputElement = sizedInput.querySelector("input")!;
    expect(sizedInputElement.style.width).toBe("180px");
    expect(sizedInputElement.style.height).toBe("40px");

    const stringLabelsSlider = renderPreviewSliderComponent(
      container,
      config({ labels: "Low, Medium, High" }),
    );
    expect(stringLabelsSlider.textContent).toContain("Medium");

    const upload = renderPreviewFileUploadComponent(
      container,
      config({ button_label: "Pick file" }),
    );
    const hiddenFileInput = upload.querySelector("input")!;
    const clickSpy = vi.spyOn(hiddenFileInput, "click").mockImplementation(() => {});
    upload.querySelector("button")?.click();
    expect(clickSpy).toHaveBeenCalled();

    expect(() =>
      renderPreviewSketchpadComponent(
        container,
        config({ canvas_shape: "triangle" }),
      ),
    ).toThrow("canvas_shape");

    const promptAbove = renderPreviewSketchpadComponent(
      container,
      config({
        prompt: "<p>Above</p>",
        prompt_location: "abovecanvas",
      }),
    );
    expect(promptAbove.element.innerHTML.trim().startsWith("<p>Above</p>")).toBe(
      true,
    );
    promptAbove.destroy();

    class LateLoadImage {
      naturalWidth = 120;
      naturalHeight = 80;
      width = 120;
      height = 80;
      complete = true;
      draggable = false;
      private source = "";
      private loadHandler: null | (() => void) = null;

      set src(value: string) {
        this.source = value;
        this.loadHandler?.();
      }

      get src() {
        return this.source;
      }

      set onload(handler: null | (() => void)) {
        this.loadHandler = handler;
        if (handler && this.source) handler();
      }

      get onload() {
        return this.loadHandler;
      }
    }

    vi.stubGlobal("Image", LateLoadImage);
    const sketchpad = renderPreviewSketchpadComponent(
      container,
      config({
        background_image: "late-bg.png",
        show_clear_button: true,
        show_undo_button: true,
        show_redo_button: true,
      }),
    );
    sketchpad.canvas!.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 500,
        height: 500,
        right: 500,
        bottom: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    sketchpad.canvas!.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 5, clientY: 5 }),
    );
    sketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-undo")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    sketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-redo")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(sketchpad.ctx?.drawImage).toHaveBeenCalled();
    sketchpad.destroy();

    getContextMock.mockReturnValueOnce(null as any);
    const noContextSketchpad = renderPreviewSketchpadComponent(
      container,
      config({
        show_clear_button: true,
        show_undo_button: true,
        show_redo_button: true,
      }),
    );
    noContextSketchpad.canvas?.dispatchEvent(
      new MouseEvent("pointerdown", { clientX: 1, clientY: 1 }) as any,
    );
    noContextSketchpad.canvas?.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 2, clientY: 2 }),
    );
    noContextSketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-clear")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    noContextSketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-undo")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    noContextSketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-redo")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    noContextSketchpad.destroy();

    renderRuntimeCopy(
      container,
      trialComponent("ImageComponent", {
        config: {
          stimulus: { source: "none", value: "ignored.png" },
        },
      }),
      canvasStyles,
    ).destroy();

    const runtimeInput = renderRuntimeCopy(
      container,
      trialComponent("InputResponseComponent", {
        inputFontSize: 18,
        inputWidth: 220,
        config: {
          text: { source: "typed", value: "%%" },
        },
      }),
      canvasStyles,
    );
    expect(runtimeInput.element.querySelector("input")).toBeTruthy();
    runtimeInput.destroy();

    renderRuntimeCopy(
      container,
      trialComponent("TextComponent", {
        config: {
          text: { source: "typed", value: "Default asset resolver" },
        },
      }),
      canvasStyles,
    ).destroy();
  });
});
