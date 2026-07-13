import {
  MockImage,
  canvasContext,
  canvasStyles,
  config,
  describe,
  expect,
  it,
  renderPreviewButtonComponent,
  renderPreviewFileUploadComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSketchpadComponent,
  renderPreviewSliderComponent,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  renderRuntimeCopy,
  trialComponent,
  vi,
} from "./testHarness";

describe("runtime preview DOM renderers", () => {
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
    const clickSpy = vi
      .spyOn(hiddenFileInput, "click")
      .mockImplementation(() => {});
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
    expect(
      promptAbove.element.innerHTML.trim().startsWith("<p>Above</p>"),
    ).toBe(true);
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
