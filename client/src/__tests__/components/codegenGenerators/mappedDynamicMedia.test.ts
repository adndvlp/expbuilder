import {
  MappedJson,
  describe,
  expect,
  getColumnValue,
  it,
  vi,
} from "./testHarness";

describe("MappedJson", () => {
  it("maps looped dynamic video components, CSV arrays and scalar response components", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { mappedJson } = MappedJson({
      isInLoop: true,
      uploadedFiles: [
        { name: "clip.mp4", url: "https://cdn.test/clip.mp4", type: "video" },
      ],
      pluginName: "plugin-dynamic",
      columnMapping: {
        components: {
          source: "typed",
          value: [
            null,
            {
              type: "VideoComponent",
              plainLabel: "plain",
              stimulus: { source: "csv", value: "video_file" },
              choices: {
                source: "csv",
                value: ["choice_a", "literal", "missing_choice"],
              },
              label: { source: "csv", value: "missing_label" },
              csvUnknown: { source: "csv", value: 123 },
              button_html: { source: "typed", value: undefined },
            },
            {
              type: "ButtonResponseComponent",
              choices: { source: "csv", value: "missing_choices" },
              button_html: { source: "typed", value: "<button>Keep</button>" },
              unsupported: { source: "computed", value: "keep-wrapper" },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: "manual-response",
        },
        trial_duration: { source: "csv", value: "duration" },
        response_ends_trial: { source: "typed", value: false },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [],
      csvJson: [
        {
          video_file: "clip.mp4",
          choice_a: "Left",
          duration: 250,
        },
      ],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        components_trial_a: [
          null,
          {
            type: "VideoComponent",
            plainLabel: "plain",
            stimulus: ["https://cdn.test/clip.mp4"],
            choices: ["Left", "literal", "missing_choice"],
            label: { source: "csv", value: "missing_label" },
            csvUnknown: { source: "csv", value: 123 },
          },
          {
            type: "ButtonResponseComponent",
            choices: ["missing_choices"],
            button_html: "<button>Keep</button>",
            unsupported: { source: "computed", value: "keep-wrapper" },
          },
        ],
        response_components_trial_a: "manual-response",
        trial_duration_trial_a: 250,
        response_ends_trial_trial_a: false,
      },
    ]);
    expect(warn).toHaveBeenCalledWith(
      'CSV source for label but column "missing_label" not found in row',
    );
    expect(warn).toHaveBeenCalledWith(
      'CSV source for choices but column "missing_choices" not found in row',
    );
    warn.mockRestore();
  });

  it("wraps mapped video plugin stimulus URLs and skips non-string parameter keys", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [
        { name: "movie.mp4", url: "https://cdn.test/movie.mp4", type: "video" },
      ],
      pluginName: "video-keyboard-response",
      columnMapping: {
        stimulus: { source: "csv", value: "video_file" },
        undefined: { source: "typed", value: "fallback-value" },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [
        { key: "stimulus", type: "video" },
        { key: undefined as any, type: "string" },
      ],
      csvJson: [{ video_file: "movie.mp4" }],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        stimulus: ["https://cdn.test/movie.mp4"],
        undefined: "fallback-value",
      },
    ]);
  });

  it("maps dynamic response components from CSV columns", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [],
      pluginName: "plugin-dynamic",
      columnMapping: {
        components: { source: "typed", value: [] },
        response_components: { source: "csv", value: "response_defs" },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [],
      csvJson: [
        {
          response_defs: [
            {
              type: "InputResponseComponent",
              prompt: { source: "typed", value: "Answer" },
            },
          ],
        },
      ],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        components: [],
        response_components: [
          {
            type: "InputResponseComponent",
            prompt: "Answer",
          },
        ],
      },
    ]);
  });
});
