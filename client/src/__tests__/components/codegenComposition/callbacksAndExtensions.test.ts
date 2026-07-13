import {
  beforeEach,
  describe,
  expect,
  getColumnValue,
  it,
  normalize,
  useTrialCode,
  vi,
} from "./testHarness";

describe("useTrialCode composition", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("serializes function-valued parameters and component button callbacks without quotes", () => {
    const buttonHtml = function buttonHtml(choice: string) {
      return `<button>${choice}</button>`;
    };
    const { genTrialCode } = useTrialCode({
      id: 9,
      branches: [],
      branchConditions: [],
      pluginName: "html-button-response",
      parameters: [
        { key: "on_finish", type: "function" },
        { key: "button_html", type: "FUNCTION" },
        { key: "components", type: "complex" },
      ],
      data: [],
      getColumnValue,
      columnMapping: {
        on_finish: {
          source: "typed",
          value: "function(data) { data.serialized = true; }",
        },
        button_html: {
          source: "typed",
          value: "(choice) => `<button>${choice}</button>`",
        },
        components: {
          source: "typed",
          value: [
            { type: "button", button_html: buttonHtml },
            {
              type: "button",
              button_html: "choice => `<button>${choice}</button>`",
            },
            { type: "button", button_html: "<button>%choice%</button>" },
            { type: "button", button_html: "" },
            { type: "label", text: "Plain text" },
          ],
        },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Function Trial",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain(
      "on_finish: function(data) { data.serialized = true; }",
    );
    expect(code).toContain(
      "button_html: (choice) => `<button>${choice}</button>`",
    );
    expect(code).toMatch(/button_html: function buttonHtml\d?\(choice\)/);
    expect(code).toContain(
      "button_html: choice => `<button>${choice}</button>`",
    );
    expect(code).toContain('button_html: "<button>%choice%</button>"');
    expect(code).toContain('button_html: ""');
    expect(code).toContain('text: "Plain text"');
  });

  it("adds extensions to both the timeline and top-level procedure", () => {
    const { genTrialCode } = useTrialCode({
      id: 10,
      branches: [],
      branchConditions: [],
      pluginName: "html-keyboard-response",
      parameters: [{ key: "stimulus", type: "html_string" }],
      data: [],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Tracked</p>" },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Extension Trial",
      includesExtensions: true,
      extensions: "[{ type: jsPsychExtensionWebgazer }]",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain(
      "extensions: [{ type: jsPsychExtensionWebgazer }] };",
    );
    expect(code).toContain("timeline.push(Extension_Trial_procedure)");
  });
});
