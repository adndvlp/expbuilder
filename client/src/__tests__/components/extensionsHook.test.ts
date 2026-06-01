import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useExtensions } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Extensions/useExtensions";

const noParams: any[] = [];
const stimulusParams = [
  { key: "stimulus", type: "html_string", default: "" },
];
const stimuliParams = [
  { key: "stimuli", type: "image_array", default: [] },
];
const dynamicParams = [
  {
    key: "components",
    type: "complex",
    value: [{ type: "ImageComponent", name: "Image_1" }],
  },
];
const richDynamicParams = [
  {
    key: "components",
    type: "complex",
    value: [
      { type: "ImageComponent", name: "Image_1" },
      { type: "TextComponent", name: "Text_1" },
      { type: "VideoComponent", name: "Video_1" },
      { type: "AudioComponent", name: "Audio_1" },
      { type: "HtmlComponent" },
    ],
  },
];
const unnamedDynamicVisualParams = [
  {
    key: "components",
    type: "complex",
    value: [{ type: "ImageComponent" }],
  },
];
const audioOnlyDynamicParams = [
  {
    key: "components",
    type: "complex",
    value: [{ type: "AudioComponent", name: "Audio_1" }],
  },
];

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

describe("useExtensions", () => {
  it("generates mouse tracking extension targeting #target", () => {
    const { result } = renderHook(() =>
      useExtensions("plugin-html-keyboard-response", noParams),
    );

    act(() => {
      result.current.setIncludeExtensions(true);
      result.current.setExtensionType("jsPsychExtensionMouseTracking");
    });

    expect(result.current.includesExtensions).toBe(true);
    expect(normalize(result.current.extensions)).toContain(
      "type: jsPsychExtensionMouseTracking",
    );
    expect(normalize(result.current.extensions)).toContain('"#target"');
    expect(normalize(result.current.extensions)).toContain("targets:");
  });

  it("generates webgazer targets for standard stimulus and stimuli params", () => {
    const stimulus = renderHook(() =>
      useExtensions("plugin-html-keyboard-response", stimulusParams),
    );
    const stimuli = renderHook(() =>
      useExtensions("plugin-image-keyboard-response", stimuliParams),
    );

    act(() => {
      stimulus.result.current.setExtensionType("jsPsychExtensionWebgazer");
      stimuli.result.current.setExtensionType("jsPsychExtensionWebgazer");
    });

    expect(normalize(stimulus.result.current.extensions)).toContain(
      "#jspsych-html-keyboard-response-stimulus",
    );
    expect(normalize(stimuli.result.current.extensions)).toContain(
      "#jspsych-image-keyboard-response-stimuli",
    );
  });

  it("emits record video extension without params", () => {
    const { result } = renderHook(() =>
      useExtensions("plugin-html-keyboard-response", noParams),
    );

    act(() => {
      result.current.setExtensionType("jsPsychExtensionRecordVideo");
    });

    expect(normalize(result.current.extensions)).toContain(
      "type: jsPsychExtensionRecordVideo",
    );
    expect(normalize(result.current.extensions)).not.toContain("params:");
  });

  it("clears extension targets when extension type is cleared", () => {
    const { result } = renderHook(() =>
      useExtensions("plugin-html-keyboard-response", stimulusParams),
    );

    act(() => {
      result.current.setExtensionType("jsPsychExtensionWebgazer");
    });

    expect(result.current.extensions).toContain(
      "#jspsych-html-keyboard-response-stimulus",
    );

    act(() => {
      result.current.setExtensionType("");
    });

    expect(result.current.extensions).toBe("");
  });

  it("keeps plugin-dynamic webgazer extensions with empty targets", () => {
    const { result } = renderHook(() =>
      useExtensions("plugin-dynamic", dynamicParams),
    );

    act(() => {
      result.current.setExtensionType("jsPsychExtensionWebgazer");
    });

    expect(normalize(result.current.extensions)).toContain(
      "type: jsPsychExtensionWebgazer",
    );
    expect(normalize(result.current.extensions)).toContain("targets: []");
  });

  it("targets visual DynamicPlugin components for webgazer", () => {
    const { result, rerender } = renderHook(
      ({ params }) => useExtensions("DynamicPlugin", params),
      { initialProps: { params: richDynamicParams } },
    );

    act(() => {
      result.current.setExtensionType("jsPsychExtensionWebgazer");
    });

    const code = normalize(result.current.extensions);

    expect(code).toContain("#jspsych-dynamic-Image_1-stimulus");
    expect(code).toContain("#jspsych-text-component-Text_1");
    expect(code).toContain("#jspsych-dynamic-Video_1-stimulus");
    expect(code).not.toContain("Audio_1");

    rerender({ params: unnamedDynamicVisualParams });

    expect(normalize(result.current.extensions)).toContain(
      "#jspsych-dynamic-image-stimulus",
    );
  });

  it("emits empty webgazer targets for DynamicPlugin without visual components", () => {
    const { result } = renderHook(() =>
      useExtensions("DynamicPlugin", audioOnlyDynamicParams),
    );

    act(() => {
      result.current.setExtensionType("jsPsychExtensionWebgazer");
    });

    expect(normalize(result.current.extensions)).toContain("targets: []");
  });
});
