import {
  ColumnSelector,
  describe,
  dynamicTrial,
  expect,
  fireEvent,
  getPropValue,
  it,
  renderInTable,
  screen,
  vi,
} from "./testHarness";
import type { ParamsOverrideCondition, Trial } from "./testHarness";

describe("dynamic condition column helpers", () => {
  it("renders normal ParamsOverride data fields and updates the selected column", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [
          { trialId: 1, column: "", op: "==", value: "old" },
          { trialId: 1, column: "rt", op: ">", value: "10" },
        ],
        paramsToOverride: {},
      },
      {
        id: 11,
        rules: [{ trialId: 1, column: "rt", op: "<", value: "20" }],
        paramsToOverride: {},
      },
    ];
    const setConditionsWrapper = vi.fn();

    renderInTable(
      <ColumnSelector
        rule={conditions[0].rules[0]}
        trialDataFields={{
          1: [
            { key: "rt", label: "RT", type: "number" },
            { key: "response", label: "Response", type: "string" },
          ],
        }}
        loadingData={{}}
        referencedTrial={{
          id: 1,
          name: "Keyboard trial",
          plugin: "plugin-html-keyboard-response",
        }}
        conditions={conditions}
        conditionId={10}
        ruleIdx={0}
        getPropValue={getPropValue}
        setConditionsWrapper={setConditionsWrapper}
      />,
    );

    expect(screen.getByRole("option", { name: "RT" })).toHaveValue("rt");
    expect(screen.getByRole("option", { name: "Response" })).toHaveValue(
      "response",
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "response" },
    });

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        {
          id: 10,
          rules: [
            { trialId: 1, column: "response", op: "==", value: "" },
            { trialId: 1, column: "rt", op: ">", value: "10" },
          ],
          paramsToOverride: {},
        },
        {
          id: 11,
          rules: [{ trialId: 1, column: "rt", op: "<", value: "20" }],
          paramsToOverride: {},
        },
      ],
      true,
    );
  });

  it("renders only trial data for a dynamic trial without column mappings", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [{ trialId: 1, column: "", op: "==", value: "" }],
        paramsToOverride: {},
      },
    ];

    renderInTable(
      <ColumnSelector
        rule={conditions[0].rules[0]}
        trialDataFields={{}}
        loadingData={{}}
        referencedTrial={{ ...dynamicTrial, columnMapping: undefined }}
        conditions={conditions}
        conditionId={10}
        ruleIdx={0}
        getPropValue={getPropValue}
        setConditionsWrapper={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Trial RT" })).toHaveValue("rt");
    expect(screen.queryByText(/Stimulus Components/)).not.toBeInTheDocument();
  });

  it("falls back to Question and field keys when labels are empty", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [{ trialId: 1, column: "", op: "==", value: "" }],
        paramsToOverride: {},
      },
    ];
    const unlabeledSurveyTrial = {
      ...dynamicTrial,
      columnMapping: {
        components: {
          value: [
            {
              type: "SurveyComponent",
              name: "StimulusSurvey",
              survey_json: { value: { elements: [{ name: "" }] } },
            },
          ],
        },
        response_components: {
          value: [
            {
              type: "SurveyComponent",
              name: "ResponseSurvey",
              survey_json: { value: { elements: [{ name: "" }] } },
            },
          ],
        },
      },
    } as unknown as Trial;

    const rendered = renderInTable(
      <ColumnSelector
        rule={conditions[0].rules[0]}
        trialDataFields={{}}
        loadingData={{}}
        referencedTrial={unlabeledSurveyTrial}
        conditions={conditions}
        conditionId={10}
        ruleIdx={0}
        getPropValue={getPropValue}
        setConditionsWrapper={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: "StimulusSurvey › Question" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "ResponseSurvey › Question" }),
    ).toBeInTheDocument();

    rendered.rerender(
      <table>
        <tbody>
          <tr>
            <ColumnSelector
              rule={conditions[0].rules[0]}
              trialDataFields={{
                1: [{ key: "fallback_key", label: "", type: "string" }],
              }}
              loadingData={{}}
              referencedTrial={{
                id: 1,
                name: "Normal trial",
                plugin: "plugin-html-keyboard-response",
              }}
              conditions={conditions}
              conditionId={10}
              ruleIdx={0}
              getPropValue={getPropValue}
              setConditionsWrapper={vi.fn()}
            />
          </tr>
        </tbody>
      </table>,
    );

    expect(
      screen.getByRole("option", { name: "fallback_key" }),
    ).toBeInTheDocument();
  });
});
