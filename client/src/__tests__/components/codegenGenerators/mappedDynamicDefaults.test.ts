import {
  MappedJson,
  describe,
  expect,
  getColumnValue,
  it,
} from "./testHarness";

describe("MappedJson", () => {
  it("uses empty dynamic component collections when CSV and mappings are absent", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [],
      pluginName: "plugin-dynamic",
      columnMapping: {},
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [],
      csvJson: undefined as any,
      parameters: [],
    });

    expect(mappedJson).toEqual([{ components: [], response_components: [] }]);
  });

  it("maps dynamic plugin components, response components, CSV-backed props and media", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [
        { name: "hero.png", url: "https://cdn.test/hero.png", type: "image" },
      ],
      pluginName: "plugin-dynamic",
      columnMapping: {
        components: {
          source: "typed",
          value: [
            {
              type: "ImageComponent",
              stimulus: { source: "csv", value: "image_file" },
              width: { source: "typed", value: 25 },
              button_html: { source: "typed", value: null },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: [
            {
              type: "ButtonResponseComponent",
              button_text: { source: "csv", value: "button_label" },
              choices: { source: "csv", value: "button_label" },
            },
          ],
        },
        trial_duration: { source: "typed", value: 1000 },
        require_response: { source: "none", value: null },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [],
      csvJson: [{ image_file: "hero.png", button_label: "Continue" }],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        components: [
          {
            type: "ImageComponent",
            stimulus: "https://cdn.test/hero.png",
            width: 25,
          },
        ],
        response_components: [
          {
            type: "ButtonResponseComponent",
            button_text: "Continue",
            choices: ["Continue"],
          },
        ],
        trial_duration: 1000,
      },
    ]);
  });
});
