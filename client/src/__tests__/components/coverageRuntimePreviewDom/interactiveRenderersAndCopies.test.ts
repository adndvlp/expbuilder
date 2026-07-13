import {
  canvasStyles,
  config,
  describe,
  ensurePreviewSketchpadStyles,
  expect,
  it,
  renderPreviewFileUploadComponent,
  renderPreviewSketchpadComponent,
  renderPreviewSurveyContainer,
  renderRuntimeCopy,
  trialComponent,
  vi,
} from "./testHarness";

describe("runtime preview DOM renderers", () => {
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
    sketchpad.element
      .querySelector<HTMLButtonElement>(".sketchpad-color-select")
      ?.click();
    sketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-clear")
      ?.click();
    sketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-undo")
      ?.click();
    sketchpad.element
      .querySelector<HTMLButtonElement>("#sketchpad-redo")
      ?.click();

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
    expect(
      button.element.querySelector('[aria-label="/assets/icon.png"]'),
    ).toBeTruthy();
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
});
