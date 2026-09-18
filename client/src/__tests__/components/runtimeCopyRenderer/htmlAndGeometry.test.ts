import { describe, expect, it } from "vitest";
import {
  renderPreviewHtmlComponent,
  renderRuntimeCopy,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
import { getHtmlSceneNode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/sceneModel";
import { canvasStyles, component } from "./testHarness";

describe("runtime copy: HTML, sliders and geometry", () => {
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

    const htmlHost = host.querySelector(
      ".dynamic-html-component-stimulus",
    ) as HTMLElement | null;
    expect(htmlHost).not.toBeNull();
    expect(
      htmlHost?.shadowRoot?.querySelector("[data-testid='real-html']"),
    ).not.toBeNull();
    // Pasted HTML is isolated: its styles cannot leak into the page (leaked
    // CSS could block gestures such as pinch zoom on mobile).
    expect(host.querySelector("style")).toBeNull();
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

  it("isolates pasted HTML styles inside a shadow root", () => {
    const host = document.createElement("div");
    const rendered = renderPreviewHtmlComponent(
      host,
      {
        name: "isolated",
        stimulus:
          "<style>body { touch-action: none; }</style><div>Inside</div>",
        coordinates: {},
      },
      { coordinateMode: "canvas", canvasStyles },
    );

    expect(rendered.shadowRoot).not.toBeNull();
    expect(rendered.shadowRoot?.querySelector("style")).not.toBeNull();
    // The <style> tag itself never lands in the light DOM.
    expect(host.querySelector("style")).toBeNull();
  });

  it("keeps a manual HtmlComponent box over measured DOM metrics", () => {
    const trialComponent = {
      ...component("HtmlComponent", {
        stimulus: { source: "typed", value: "<div>HTML</div>" },
      }),
      width: 400,
      height: 200,
    };
    const node = getHtmlSceneNode(trialComponent, canvasStyles, {
      [trialComponent.id]: { width: 321, height: 123 },
    });

    // Manual resizing must persist: the measured content size no longer
    // overrides an explicit box.
    expect(node?.width).toBe(400);
    expect(node?.height).toBe(200);
  });

  it("honors the manual HTML box in the preview and caps unset widths to the canvas", () => {
    const host = document.createElement("div");
    const sized = renderPreviewHtmlComponent(
      host,
      {
        name: "sized",
        stimulus: "<div>Long content</div>",
        coordinates: {},
        width: 50, // vw: 50% of the 1000px canvas
        height: 20,
      },
      { coordinateMode: "canvas", canvasStyles },
    );

    expect(sized.style.width).toBe("500px");
    expect(sized.style.minHeight).toBe("200px");
    expect(sized.style.overflowWrap).toBe("break-word");

    const auto = renderPreviewHtmlComponent(
      host,
      { name: "auto", stimulus: "<div>Auto</div>", coordinates: {} },
      { coordinateMode: "canvas", canvasStyles },
    );

    // Without an explicit box, hug the content but never exceed the canvas.
    expect(auto.style.width).toBe("max-content");
    expect(auto.style.maxWidth).toBe("1000px");
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
});
