import {
  describe,
  dynamicTrial,
  expect,
  getPropValue,
  it,
  renderHook,
  useAvailableColumns,
} from "./testHarness";
import type { Trial } from "./testHarness";

describe("dynamic condition column helpers", () => {
  it("returns no branch columns without a selected trial", () => {
    const { result } = renderHook(() =>
      useAvailableColumns({
        selectedTrial: null,
        getPropValue,
        data: [{ key: "rt", label: "RT", type: "number" }],
      }),
    );

    expect(result.current()).toEqual([]);
  });

  it("uses plugin data fields for normal branch trials", () => {
    const { result } = renderHook(() =>
      useAvailableColumns({
        selectedTrial: {
          ...dynamicTrial,
          plugin: "plugin-html-keyboard-response",
        },
        getPropValue,
        data: [
          { key: "rt", label: "RT", type: "number" },
          { key: "response", label: "Response", type: "string" },
        ],
      }),
    );

    expect(result.current()).toEqual([
      { value: "rt", label: "rt", group: "Trial Data" },
      { value: "response", label: "response", group: "Trial Data" },
    ]);
  });

  it("expands DynamicPlugin stimulus and response components into condition columns", () => {
    const { result } = renderHook(() =>
      useAvailableColumns({
        selectedTrial: dynamicTrial,
        getPropValue,
        data: [],
      }),
    );

    expect(result.current()).toEqual(
      expect.arrayContaining([
        {
          value: "Image_1_type",
          label: "Image_1 › Type",
          group: "Stimulus Components",
        },
        {
          value: "Image_1_stimulus",
          label: "Image_1 › Stimulus",
          group: "Stimulus Components",
        },
        {
          value: "Image_1_coordinates",
          label: "Image_1 › Coordinates",
          group: "Stimulus Components",
        },
        {
          value: "Survey_1_age",
          label: "Survey_1 › age",
          group: "Stimulus Components",
        },
        {
          value: "Survey_1_response",
          label: "Survey_1 › Response",
          group: "Stimulus Components",
        },
        {
          value: "SurveyResponse_1_choice",
          label: "SurveyResponse_1 › choice",
          group: "Response Components",
        },
        {
          value: "Slider_1_slider_start",
          label: "Slider_1 › Slider Start",
          group: "Response Components",
        },
        {
          value: "Sketch_1_strokes",
          label: "Sketch_1 › Strokes",
          group: "Response Components",
        },
        {
          value: "Sketch_1_png",
          label: "Sketch_1 › PNG",
          group: "Response Components",
        },
        {
          value: "Audio_1_audio_url",
          label: "Audio_1 › Audio URL",
          group: "Response Components",
        },
        {
          value: "Audio_1_estimated_stimulus_onset",
          label: "Audio_1 › Stimulus Onset",
          group: "Response Components",
        },
        { value: "rt", label: "Trial RT", group: "Trial Data" },
      ]),
    );
  });

  it("skips dynamic stimulus and response components without a name prefix", () => {
    const { result } = renderHook(() =>
      useAvailableColumns({
        selectedTrial: {
          ...dynamicTrial,
          columnMapping: {
            components: {
              source: "typed",
              value: [{ type: "ImageComponent", stimulus: "missing-name.png" }],
            },
            response_components: {
              source: "typed",
              value: [{ type: "KeyboardResponseComponent" }],
            },
          },
        },
        getPropValue,
        data: [],
      }),
    );

    expect(result.current()).toEqual([
      { value: "rt", label: "Trial RT", group: "Trial Data" },
    ]);
  });

  it("uses empty dynamic mappings and survey question label fallbacks", () => {
    const { result, rerender } = renderHook(
      ({ selectedTrial }) =>
        useAvailableColumns({
          selectedTrial: selectedTrial as Trial,
          getPropValue,
          data: [],
        }),
      {
        initialProps: {
          selectedTrial: {
            ...dynamicTrial,
            columnMapping: undefined,
          } as any,
        },
      },
    );

    expect(result.current()).toEqual([
      { value: "rt", label: "Trial RT", group: "Trial Data" },
    ]);

    rerender({
      selectedTrial: {
        ...dynamicTrial,
        columnMapping: {
          components: {
            value: [
              {
                type: "SurveyComponent",
                name: "StimSurvey",
                survey_json: {
                  elements: [
                    { name: "", title: "Stimulus title" },
                    { name: "", title: "" },
                  ],
                },
              },
            ],
          },
          response_components: {
            value: [
              {
                type: "SurveyComponent",
                name: "ResponseSurvey",
                survey_json: {
                  elements: [
                    { name: "", title: "Response title" },
                    { name: "", title: "" },
                  ],
                },
              },
            ],
          },
        },
      } as any,
    });

    const labels = result.current().map((column) => column.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "StimSurvey › Stimulus title",
        "StimSurvey › Question",
        "ResponseSurvey › Response title",
        "ResponseSurvey › Question",
      ]),
    );
  });
});
