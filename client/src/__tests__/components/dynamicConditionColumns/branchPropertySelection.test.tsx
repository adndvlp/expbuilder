import {
  DynamicPluginPropertyColumn,
  describe,
  expect,
  fireEvent,
  getPropValue,
  it,
  render,
  screen,
  vi,
} from "./testHarness";
import type { LoopCondition } from "./testHarness";

describe("dynamic condition column helpers", () => {
  it("renders dynamic plugin property options and resets rule value on change", () => {
    const conditions: LoopCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            fieldType: "response_components",
            componentIdx: "SurveyResponse_1",
            prop: "",
            column: "",
            op: "==",
            value: "old",
          },
        ],
      },
    ];
    const setConditionsWrapper = vi.fn();

    render(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{
          type: "SurveyComponent",
          survey_json: {
            source: "typed",
            value: {
              elements: [
                { name: "choice", title: "Choice" },
                { name: "fallback" },
              ],
            },
          },
        }}
        componentIdx="SurveyResponse_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={setConditionsWrapper}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Choice" })).toHaveValue(
      "choice",
    );
    expect(screen.getByRole("option", { name: "fallback" })).toHaveValue(
      "fallback",
    );
    expect(screen.queryByRole("option", { name: "Response" })).toBeNull();
    expect(screen.getByRole("option", { name: "RT" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "choice" },
    });

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      [
        {
          id: 1,
          rules: [
            {
              trialId: 1,
              fieldType: "response_components",
              componentIdx: "SurveyResponse_1",
              prop: "choice",
              column: "",
              op: "==",
              value: "",
            },
          ],
        },
      ],
      true,
    );
  });
});
