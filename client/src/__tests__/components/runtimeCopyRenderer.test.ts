import { describe, expect, it } from "vitest";
import { renderRuntimeCopy } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/experimentalScene/runtimePreviewDom";
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
});
