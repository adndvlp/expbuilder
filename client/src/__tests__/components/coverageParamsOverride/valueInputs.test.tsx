import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RuleValueInput } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleValueInput";

const getPropValue = (prop: unknown) =>
  prop && typeof prop === "object" && "value" in prop
    ? (prop as any).value
    : prop;

describe("params override dynamic rule values", () => {
  it("supports survey and button choices", () => {
    const updateRule = vi.fn();
    const { rerender } = render(
      <RuleValueInput
        rule={{ prop: "question1", value: "" } as any}
        isDynamicPlugin
        comp={{
          type: "SurveyComponent",
          survey_json: {
            source: "typed",
            value: {
              elements: [
                {
                  name: "question1",
                  type: "radiogroup",
                  choices: [
                    "Yes",
                    { value: "no", text: "No" },
                    { value: "maybe" },
                  ],
                },
              ],
            },
          },
        }}
        getPropValue={getPropValue}
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "no" } });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "no");

    rerender(
      <RuleValueInput
        rule={{ prop: "response", value: "" } as any}
        isDynamicPlugin
        comp={{
          type: "ButtonResponseComponent",
          choices: {
            source: "typed",
            value: [
              "Left",
              { value: "right", text: "Right" },
              { value: "fallback" },
            ],
          },
        }}
        getPropValue={getPropValue}
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "right" },
    });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "right");
    expect(screen.getByRole("option", { name: "fallback" })).toHaveValue(
      "fallback",
    );
  });

  it("falls back to text input for missing or invalid choices", () => {
    const updateRule = vi.fn();
    const { rerender } = render(
      <RuleValueInput
        rule={{ prop: "missing", value: "typed" } as any}
        isDynamicPlugin
        comp={{
          type: "SurveyComponent",
          survey_json: {
            source: "typed",
            value: { elements: [{ name: "other", type: "radiogroup" }] },
          },
        }}
        getPropValue={getPropValue}
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );
    expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
    rerender(
      <RuleValueInput
        rule={{ prop: "response", value: "typed" } as any}
        isDynamicPlugin
        comp={{
          type: "ButtonResponseComponent",
          choices: { source: "typed", value: "not-an-array" },
        }}
        getPropValue={getPropValue}
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "manual" },
    });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "manual");
  });
});
