import { describe, expect, it } from "vitest";

import DynamicPlugin from "../index";

const image = (duration: number | null = 50) => ({
  type: "ImageComponent",
  name: "image",
  stimulus: "image.png",
  stimulus_onset: 0,
  stimulus_duration: duration,
});

const text = (value = "target", duration: number | null = 50) => ({
  type: "TextComponent",
  name: "text",
  text: value,
  stimulus_onset: 0,
  stimulus_duration: duration,
});

const intent = (
  components: any[],
  trialDuration: number | null = 50,
  responseComponents: any[] = [],
) =>
  (DynamicPlugin as any).getTimingIntent({
    components,
    response_components: responseComponents,
    trial_duration: trialDuration,
    response_ends_trial: trialDuration === null,
  });

describe("general visual continuity eligibility", () => {
  it.each([
    ["Image → Image state", [image()]],
    ["Text → Text state", [text()]],
    ["multiple WebGL drawables", [image(), text()]],
  ])("opts %s into the persistent engine", (_name, components) => {
    expect(intent(components as any[])).toBe("timing_continuous");
  });

  it("recognizes explicit component duration equal to the whole trial", () => {
    expect(intent([image(50)], 50)).toBe("timing_continuous");
  });

  it("supports an indefinite whole-window image ended by keyboard response", () => {
    expect(
      intent([image(null)], null, [
        { type: "KeyboardResponseComponent", choices: "ALL_KEYS" },
      ]),
    ).toBe("timing_continuous");
  });

  it("ignores lifecycle/type functions but requires an explicit static contract for on_start", () => {
    const trial = {
      type: DynamicPlugin,
      components: [image()],
      response_components: [],
      trial_duration: 50,
      on_start: () => undefined,
      on_finish: () => undefined,
    };

    expect((DynamicPlugin as any).getTimingIntent(trial)).toBe("normal");
    expect(
      (DynamicPlugin as any).getTimingIntent(trial, {
        presentationStatic: true,
      }),
    ).toBe("timing_continuous");
  });

  it.each([
    ["cloze DOM text", [text("answer %blank%")]],
    ["HTML visual", [{ type: "HtmlComponent", stimulus_duration: 50 }]],
    ["video first-frame semantics", [{ type: "VideoComponent", stimulus_duration: 50 }]],
    ["Sketchpad mutable canvas", [{ type: "SketchpadComponent", stimulus_duration: 50 }]],
  ])("keeps %s non-continuous while retaining global timing", (_name, components) => {
    expect(intent(components as any[])).toBe("normal");
  });

  it("P0.2 (iteración 5): permite ventanas segmentadas de estímulos persistent-backend en la fast path", () => {
    // A partial stimulus window over Image/Text is now scheduled as an
    // intra-trial FrameEngine visual transition.
    expect(intent([image(25)] as any[])).toBe("timing_continuous");
  });

  it("keeps a visual Button response layer outside the fast path", () => {
    expect(
      intent([image()], 50, [
        { type: "ButtonResponseComponent", choices: ["A", "B"] },
      ]),
    ).toBe("normal");
  });

  it("allows prepared audio only when it adds no controls DOM", () => {
    expect(
      intent([
        image(),
        { type: "AudioComponent", stimulus: "tone.wav", show_controls: false },
      ]),
    ).toBe("timing_continuous");
    expect(
      intent([
        image(),
        { type: "AudioComponent", stimulus: "tone.wav", show_controls: true },
      ]),
    ).toBe("normal");
  });
});
