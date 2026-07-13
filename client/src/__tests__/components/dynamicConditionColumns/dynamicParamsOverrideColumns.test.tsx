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
  it("renders dynamic plugin ParamsOverride columns and resets the rule value", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [{ trialId: 1, column: "", op: "==", value: "old" }],
        paramsToOverride: {},
      },
    ];
    const setConditionsWrapper = vi.fn();

    renderInTable(
      <ColumnSelector
        rule={conditions[0].rules[0]}
        trialDataFields={{}}
        loadingData={{}}
        referencedTrial={dynamicTrial}
        conditions={conditions}
        conditionId={10}
        ruleIdx={0}
        getPropValue={getPropValue}
        setConditionsWrapper={setConditionsWrapper}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Image_1 › Stimulus" }),
    ).toHaveValue("Image_1_stimulus");
    expect(screen.getByRole("option", { name: "Survey_1 › Age" })).toHaveValue(
      "Survey_1_age",
    );
    expect(
      screen.getByRole("option", { name: "SurveyResponse_1 › Choice" }),
    ).toHaveValue("SurveyResponse_1_choice");
    expect(
      screen.getByRole("option", { name: "Slider_1 › Slider Start" }),
    ).toHaveValue("Slider_1_slider_start");
    expect(
      screen.getByRole("option", { name: "Audio_1 › Stimulus Onset" }),
    ).toHaveValue("Audio_1_estimated_stimulus_onset");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "SurveyResponse_1_choice" },
    });

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        {
          id: 10,
          rules: [
            {
              trialId: 1,
              column: "SurveyResponse_1_choice",
              op: "==",
              value: "",
            },
          ],
          paramsToOverride: {},
        },
      ],
      true,
    );
  });

  it("skips ParamsOverride dynamic components without a name", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [{ trialId: 1, column: "", op: "==", value: "old" }],
        paramsToOverride: {},
      },
    ];
    const trialWithUnnamedComponents = {
      ...dynamicTrial,
      columnMapping: {
        components: {
          source: "typed",
          value: [
            {
              type: "ImageComponent",
              stimulus: { source: "typed", value: "cat.png" },
            },
            {
              type: "ImageComponent",
              name: { source: "typed", value: "NamedStimulus" },
              stimulus: { source: "typed", value: "cat.png" },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: [
            { type: "AudioResponseComponent" },
            {
              type: "AudioResponseComponent",
              name: { source: "typed", value: "NamedResponse" },
            },
          ],
        },
      },
    } as Trial;

    renderInTable(
      <ColumnSelector
        rule={conditions[0].rules[0]}
        trialDataFields={{}}
        loadingData={{}}
        referencedTrial={trialWithUnnamedComponents}
        conditions={conditions}
        conditionId={10}
        ruleIdx={0}
        getPropValue={getPropValue}
        setConditionsWrapper={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("option", { name: "NamedStimulus › Type" }),
    ).toHaveValue("NamedStimulus_type");
    expect(
      screen.getByRole("option", { name: "NamedResponse › Type" }),
    ).toHaveValue("NamedResponse_type");
    expect(
      screen.queryByRole("option", { name: "undefined › Type" }),
    ).not.toBeInTheDocument();
  });

  it("shows loading and disabled states in ParamsOverride column selection", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 10,
        rules: [{ trialId: "", column: "", op: "==", value: "" }],
        paramsToOverride: {},
      },
    ];

    const { rerender } = renderInTable(
      <ColumnSelector
        rule={{ trialId: 1, column: "", op: "==", value: "" }}
        trialDataFields={{}}
        loadingData={{ 1: true }}
        referencedTrial={null}
        conditions={conditions}
        conditionId={10}
        ruleIdx={0}
        getPropValue={getPropValue}
        setConditionsWrapper={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <tr>
            <ColumnSelector
              rule={conditions[0].rules[0]}
              trialDataFields={{}}
              loadingData={{}}
              referencedTrial={null}
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

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Select trial first" }),
    ).toBeInTheDocument();
  });
});
