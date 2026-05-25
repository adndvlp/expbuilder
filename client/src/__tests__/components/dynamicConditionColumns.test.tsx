import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import useAvailableColumns from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/useAvailableColumns";
import { DynamicPluginPropertyColumn } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn";
import ColumnSelector from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow/ColumnSelector";
import type {
  ParamsOverrideCondition,
  Trial,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { LoopCondition } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/types";

function getPropValue(prop: unknown) {
  if (prop && typeof prop === "object" && "value" in prop) {
    return (prop as { value: unknown }).value;
  }
  return prop;
}

const dynamicTrial = {
  id: 1,
  type: "trial",
  name: "Dynamic Trial",
  plugin: "plugin-dynamic",
  parameters: {},
  trialCode: "",
  columnMapping: {
    components: {
      source: "typed",
      value: [
        {
          type: "ImageComponent",
          name: { source: "typed", value: "Image_1" },
          stimulus: { source: "typed", value: "cat.png" },
          coordinates: { source: "typed", value: { x: 10, y: 20 } },
        },
        {
          type: "SurveyComponent",
          name: { source: "typed", value: "Survey_1" },
          survey_json: {
            source: "typed",
            value: {
              elements: [
                { name: "age", title: "Age" },
                { name: "group" },
              ],
            },
          },
        },
      ],
    },
    response_components: {
      source: "typed",
      value: [
        {
          type: "SurveyComponent",
          name: { source: "typed", value: "SurveyResponse_1" },
          survey_json: {
            source: "typed",
            value: { elements: [{ name: "choice", title: "Choice" }] },
          },
        },
        {
          type: "SliderResponseComponent",
          name: { source: "typed", value: "Slider_1" },
        },
        {
          type: "SketchpadComponent",
          name: { source: "typed", value: "Sketch_1" },
        },
        {
          type: "AudioResponseComponent",
          name: { source: "typed", value: "Audio_1" },
        },
      ],
    },
  },
} as Trial;

function renderInTable(ui: React.ReactElement) {
  return render(
    <table>
      <tbody>
        <tr>{ui}</tr>
      </tbody>
    </table>,
  );
}

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
            value: { elements: [{ name: "choice", title: "Choice" }] },
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

  it("renders normal ParamsOverride data fields and updates the selected column", () => {
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
          rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
          paramsToOverride: {},
        },
      ],
      true,
    );
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
