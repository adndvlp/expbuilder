import {
  DynamicPluginPropertyColumn,
  describe,
  expect,
  getPropValue,
  it,
  render,
  screen,
  vi,
} from "./testHarness";
import type { LoopCondition } from "./testHarness";

describe("dynamic condition column helpers", () => {
  it("renders dynamic plugin property variants for conditional loop rules", () => {
    const conditions: LoopCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            fieldType: "response_components",
            componentIdx: "Component_1",
            prop: "",
            column: "",
            op: "==",
            value: "",
          },
        ],
      },
    ];

    const { rerender } = render(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{
          type: "SurveyComponent",
          survey_json: { source: "typed", value: {} },
        }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Response" })).toHaveValue(
      "response",
    );
    expect(screen.getByRole("option", { name: "RT" })).toHaveValue("rt");

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{ type: "ButtonResponseComponent" }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Response" })).toHaveValue(
      "response",
    );
    expect(screen.getByRole("option", { name: "RT" })).toHaveValue("rt");

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{ type: "SliderResponseComponent" }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Slider Start" })).toHaveValue(
      "slider_start",
    );

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{ type: "SketchpadComponent" }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Strokes" })).toHaveValue(
      "strokes",
    );
    expect(screen.getByRole("option", { name: "PNG" })).toHaveValue("png");

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{ type: "AudioResponseComponent" }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Audio URL" })).toHaveValue(
      "audio_url",
    );
    expect(screen.getByRole("option", { name: "Stimulus Onset" })).toHaveValue(
      "estimated_stimulus_onset",
    );

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{
          type: "ImageComponent",
          stimulus: { source: "typed", value: "cat.png" },
          coordinates: { source: "typed", value: { x: 1, y: 2 } },
        }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Stimulus" })).toHaveValue(
      "stimulus",
    );
    expect(screen.getByRole("option", { name: "Coordinates" })).toHaveValue(
      "coordinates",
    );

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{ type: "AudioComponent" }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(
      screen.queryByRole("option", { name: "Stimulus" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Coordinates" }),
    ).not.toBeInTheDocument();

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{
          type: "CustomComponent",
          stimulus: "stim",
          response: "resp",
          rt: 10,
          coordinates: { x: 1, y: 2 },
        }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("option", { name: "Stimulus" })).toHaveValue(
      "stimulus",
    );
    expect(screen.getByRole("option", { name: "Response" })).toHaveValue(
      "response",
    );
    expect(screen.getByRole("option", { name: "RT" })).toHaveValue("rt");
    expect(screen.getByRole("option", { name: "Coordinates" })).toHaveValue(
      "coordinates",
    );

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={{ type: "CustomComponent" }}
        componentIdx="Component_1"
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(
      screen.queryByRole("option", { name: "Stimulus" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Response" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "RT" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Coordinates" }),
    ).not.toBeInTheDocument();

    rerender(
      <DynamicPluginPropertyColumn
        rule={conditions[0].rules[0]}
        comp={null}
        componentIdx=""
        conditionId={1}
        ruleIdx={0}
        conditions={conditions}
        setConditionsWrapper={vi.fn()}
        getPropValue={getPropValue}
      />,
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(
      screen.queryByRole("option", { name: "Response" }),
    ).not.toBeInTheDocument();
  });
});
