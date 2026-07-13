import { describe, expect, it, vi } from "vitest";
import {
  renderPreviewButtonComponent,
  renderPreviewImageComponent,
  renderPreviewInputComponent,
  renderPreviewSliderComponent,
  renderPreviewTextComponent,
  renderPreviewVideoComponent,
  renderRuntimeCopy,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
import {
  canvasStyles,
  component,
  installCanvasContext,
  installImageStub,
} from "./testHarness";

describe("runtime copy: canvas-backed component fallbacks", () => {
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
    expect(
      (video.querySelector("video") as HTMLVideoElement).playbackRate,
    ).toBe(1);

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
    expect(noBorderButton.querySelector("button")?.dataset.choice).toBe(
      "Wide choice",
    );
  });
});
