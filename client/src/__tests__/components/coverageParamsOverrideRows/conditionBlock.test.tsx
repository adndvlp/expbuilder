/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  currentParams,
  currentTrial,
  dynamicCondition,
  normalCondition,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConditionBlock } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/ConditionBlock";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
  () => ({
    ParameterInput: ({ paramKey, value, onChange }: any) => (
      <button
        data-testid={`parameter-input-${paramKey}`}
        onClick={() => onChange(`${value ?? ""}-changed`)}
      >
        input {paramKey}
      </button>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () => ({
      metadata: {
        parameters: {
          survey_json: {
            pretty_name: "Survey JSON",
            type: "object",
            default: {},
          },
          text: {
            pretty_name: "Text",
            type: "string",
            default: "",
          },
          duration: {
            pretty_name: "Duration",
            type: "number",
            default: 0,
          },
        },
      },
    }),
  }),
);

describe("ParamsOverride ConditionBlock", () => {
  it("handles missing override params, dynamic collections and primitive component names", () => {
    const baseProps = {
      condIdx: 0,
      availableTrialsForCondition: [],
      currentTrialParameters: currentParams(),
      canAddMoreParams: false,
      removeCondition: vi.fn(),
      updateRule: vi.fn(),
      removeRuleFromCondition: vi.fn(),
      addRuleToCondition: vi.fn(),
      addParameterToOverride: vi.fn(),
      findTrialByIdSync: vi.fn(),
      trialDataFields: {},
      loadingData: {},
      getCurrentTrialCsvColumns: () => [],
      setConditions: vi.fn(),
      setConditionsWrapper: vi.fn(),
      hasDynamicTrial: true,
    };
    const emptyCondition = normalCondition({ paramsToOverride: undefined });
    const { rerender } = render(
      <ConditionBlock
        {...baseProps}
        condition={emptyCondition}
        conditions={[emptyCondition]}
        currentTrial={currentTrial()}
      />,
    );

    const conditionWithDynamicParams = normalCondition({
      paramsToOverride: {
        "missing::unknown::survey_json": { source: "typed", value: null },
        "response_components::survey::survey_json": {
          source: "typed",
          value: null,
        },
      },
    });
    const trial = currentTrial();
    trial.columnMapping.response_components.value.push({
      name: "survey",
      type: "SurveyComponent",
    });
    rerender(
      <ConditionBlock
        {...baseProps}
        condition={conditionWithDynamicParams}
        conditions={[conditionWithDynamicParams]}
        currentTrial={trial}
      />,
    );

    expect(screen.getByText("Question")).toBeInTheDocument();
  });

  it("ignores non-survey override keys when computing survey-specific columns", () => {
    const condition = normalCondition({
      paramsToOverride: {
        difficulty: { source: "typed", value: "medium" },
        "components::survey": { source: "typed", value: "incomplete" },
        "components::button::text": { source: "typed", value: "Continue" },
      },
    });

    render(
      <ConditionBlock
        condition={condition}
        condIdx={0}
        availableTrialsForCondition={[]}
        currentTrialParameters={currentParams()}
        canAddMoreParams={false}
        removeCondition={vi.fn()}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        addRuleToCondition={vi.fn()}
        addParameterToOverride={vi.fn()}
        findTrialByIdSync={vi.fn()}
        trialDataFields={{}}
        loadingData={{}}
        getCurrentTrialCsvColumns={() => []}
        setConditions={vi.fn()}
        setConditionsWrapper={vi.fn()}
        conditions={[condition]}
        hasDynamicTrial
        currentTrial={currentTrial()}
      />,
    );

    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.queryByText("Question")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add rule \(AND\)/ }),
    ).not.toBeInTheDocument();
  });

  it("renders dynamic survey headers and delegates condition actions", () => {
    const condition = dynamicCondition();
    const conditions = [condition];
    const removeCondition = vi.fn();
    const addRuleToCondition = vi.fn();
    const addParameterToOverride = vi.fn();
    const setConditionsWrapper = vi.fn();

    render(
      <ConditionBlock
        condition={condition}
        condIdx={1}
        availableTrialsForCondition={[
          { id: "trial-a", name: "Trial A" },
          { id: "trial-b", name: "Trial B" },
        ]}
        currentTrialParameters={currentParams()}
        canAddMoreParams
        removeCondition={removeCondition}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        addRuleToCondition={addRuleToCondition}
        addParameterToOverride={addParameterToOverride}
        findTrialByIdSync={vi.fn(() => ({
          id: "trial-a",
          name: "Trial A",
          plugin: "plugin-html-keyboard-response",
        }))}
        trialDataFields={{
          "trial-a": [
            { key: "score", label: "Score" },
            { key: "rt", label: "RT" },
          ],
        }}
        loadingData={{}}
        getCurrentTrialCsvColumns={() => ["csv_difficulty"]}
        setConditions={vi.fn()}
        setConditionsWrapper={setConditionsWrapper}
        conditions={conditions}
        hasDynamicTrial
        currentTrial={currentTrial()}
      />,
    );

    expect(screen.getByText("OR IF")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();

    const block = screen.getByText("Condition 2").closest("div")!.parentElement!
      .parentElement!;
    fireEvent.mouseEnter(block);
    fireEvent.mouseLeave(block);

    const removeButton = screen.getByTitle("Remove condition");
    fireEvent.mouseEnter(removeButton);
    fireEvent.mouseLeave(removeButton);
    fireEvent.click(removeButton);
    expect(removeCondition).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(addRuleToCondition).toHaveBeenCalledWith(1);
    expect(addParameterToOverride).toHaveBeenCalledWith(1);
  });
});
