import {
  MappedJson,
  describe,
  expect,
  getColumnValue,
  it,
} from "./testHarness";

describe("MappedJson", () => {
  it("maps normal plugin CSV values and uploaded media URLs", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [
        {
          name: "image-a.png",
          url: "https://cdn.test/image-a.png",
          type: "image",
        },
      ],
      pluginName: "html-keyboard-response",
      columnMapping: {
        stimulus: { source: "csv", value: "stimulus_file" },
        choices: { source: "typed", value: ["y", "n"] },
        trial_duration: { source: "none", value: null },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [
        { key: "stimulus", type: "image" },
        { key: "choices", type: "string_array" },
        { key: "trial_duration", type: "number" },
      ],
      csvJson: [{ stimulus: "image-a.png", stimulus_file: "image-a.png" }],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        stimulus: "https://cdn.test/image-a.png",
        choices: ["y", "n"],
      },
    ]);
  });

  it("prefixes normal plugin values when generated inside a loop", () => {
    const { mappedJson } = MappedJson({
      isInLoop: true,
      uploadedFiles: [],
      pluginName: "html-keyboard-response",
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Hello</p>" },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [{ key: "stimulus", type: "html_string" }],
      csvJson: [],
      parameters: [{ key: "stimulus", type: "html_string" }],
    });

    expect(mappedJson).toEqual([{ stimulus_trial_a: "<p>Hello</p>" }]);
  });

  it("expands comma-separated non-html typed values into multiple mapped rows", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [],
      pluginName: "image-keyboard-response",
      columnMapping: {
        stimulus: { source: "typed", value: "a.png, b.png" },
        mask: { source: "typed", value: "single.png," },
        prompt: { source: "typed", value: "<p>Keep as one html string</p>" },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [
        { key: "stimulus", type: "image" },
        { key: "mask", type: "image" },
        { key: "prompt", type: "html_string" },
        { key: "missing", type: "string" },
      ],
      csvJson: [],
      parameters: [
        { key: "stimulus", type: "image" },
        { key: "mask", type: "image" },
        { key: "prompt", type: "html_string" },
        { key: "missing", type: "string" },
      ],
    });

    expect(mappedJson).toEqual([
      {
        stimulus: "a.png",
        mask: "single.png",
        prompt: "<p>Keep as one html string</p>",
      },
      {
        stimulus: "b.png",
        mask: "single.png",
        prompt: "<p>Keep as one html string</p>",
      },
    ]);
  });
});
