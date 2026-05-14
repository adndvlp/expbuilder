import { describe, it, expect } from "vitest";
import { generateExtensionCode } from "../../pages/ExperimentBuilder/utils/generateExtensionCode";

describe("generateExtensionCode", () => {
  it("returns empty string for empty extension type", () => {
    expect(generateExtensionCode("", "plugin-test", [])).toBe("");
  });

  it("generates mouse tracking extension code", () => {
    const result = generateExtensionCode("jsPsychExtensionMouseTracking", "plugin-test", []);
    expect(result).toContain("jsPsychExtensionMouseTracking");
    expect(result).toContain("#target");
    expect(result).toContain("targets:");
  });

  it("generates webgazer extension code with stimulus target", () => {
    const parameters = [
      { key: "stimulus", type: "string", default: "" },
    ];
    const result = generateExtensionCode("jsPsychExtensionWebgazer", "plugin-html-keyboard-response", parameters);
    expect(result).toContain("jsPsychExtensionWebgazer");
    expect(result).toContain("#jspsych-html-keyboard-response-stimulus");
  });

  it("generates webgazer extension code with stimuli target", () => {
    const parameters = [
      { key: "stimuli", type: "array", default: [] },
    ];
    const result = generateExtensionCode("jsPsychExtensionWebgazer", "plugin-image-keyboard-response", parameters);
    expect(result).toContain("#jspsych-image-keyboard-response-stimuli");
  });

  it("returns empty targets for DynamicPlugin with webgazer", () => {
    const parameters: any[] = [];
    const result = generateExtensionCode("jsPsychExtensionWebgazer", "DynamicPlugin", parameters);
    expect(result).toContain("jsPsychExtensionWebgazer");
    expect(result).toContain("targets: []");
  });

  it("generates record video extension without params", () => {
    const result = generateExtensionCode("jsPsychExtensionRecordVideo", "plugin-test", []);
    expect(result).toContain("jsPsychExtensionRecordVideo");
    // RecordVideo extension should NOT contain params key
    expect(result).not.toContain("params:");
  });

  it("formats params as unquoted JS object keys", () => {
    const result = generateExtensionCode("jsPsychExtensionMouseTracking", "plugin-test", []);
    // JSON.stringify would produce "targets": but we want targets: (no quotes)
    expect(result).toContain("targets:");
    expect(result).not.toContain('"targets":');
  });
});
