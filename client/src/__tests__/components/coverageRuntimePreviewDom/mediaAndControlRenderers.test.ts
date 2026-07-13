import {
  canvasStyles,
  config,
  describe,
  expect,
  it,
  renderPreviewButtonComponent,
  renderPreviewHtmlComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSliderComponent,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  resolvePreviewParam,
} from "./testHarness";

describe("runtime preview DOM renderers", () => {
  it("resolves parameters and renders html, image and video components", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    expect(resolvePreviewParam(undefined, "fallback")).toBe("fallback");
    expect(
      resolvePreviewParam(
        { source: "typed", value: "typed value" },
        "fallback",
      ),
    ).toBe("typed value");
    expect(
      resolvePreviewParam({ source: "csv", value: null }, "fallback"),
    ).toBe("fallback");
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
});
