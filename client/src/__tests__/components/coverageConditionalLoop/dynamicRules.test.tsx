import {
  conditionFixture,
  dynamicTrial,
  normalRule,
  renderRuleRow,
} from "./testHarness";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("conditional loop dynamic rule rows", () => {
  it("handles a selected field without a component array", () => {
    const condition = conditionFixture({
      rules: [
        {
          trialId: "trial-dyn",
          fieldType: "components",
          componentIdx: "missing",
          prop: "response",
          op: "==",
          value: "",
        },
      ],
    });
    renderRuleRow({
      rule: condition.rules[0],
      condition,
      conditions: [condition],
      findTrialByIdSync: vi.fn(() => ({
        id: "trial-dyn",
        plugin: "plugin-dynamic",
        columnMapping: { components: {} },
      })),
      trialDataFields: {},
    });
    expect(
      screen.getByRole("option", { name: "Select component" }),
    ).toBeInTheDocument();
  });

  it("renders dynamic columns and forwards edits", () => {
    const condition = conditionFixture({
      rules: [
        {
          trialId: "trial-dyn",
          fieldType: "components",
          componentIdx: "button",
          prop: "response",
          op: "==",
          value: "",
        },
        normalRule(),
      ],
    });
    const props = renderRuleRow({
      rule: condition.rules[0],
      condition,
      conditions: [condition],
      findTrialByIdSync: vi.fn((id: string) =>
        id === "trial-dyn" ? dynamicTrial() : null,
      ),
      trialDataFields: {},
    });
    expect(screen.getByText("Stimulus")).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "response_components" } });
    fireEvent.change(selects[2], { target: { value: "button" } });
    fireEvent.change(selects[3], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
    fireEvent.change(selects[5], { target: { value: "Right" } });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "Right");
  });

  it("matches dynamic components with primitive names", () => {
    const condition = conditionFixture({
      rules: [
        {
          trialId: "trial-dyn",
          fieldType: "components",
          componentIdx: "button",
          prop: "response",
          op: "==",
          value: "",
        },
        normalRule(),
      ],
    });
    const props = renderRuleRow({
      rule: condition.rules[0],
      condition,
      conditions: [condition],
      findTrialByIdSync: vi.fn((id: string) =>
        id === "trial-dyn"
          ? {
              id: "trial-dyn",
              name: "Dynamic Trial",
              plugin: "plugin-dynamic",
              columnMapping: {
                components: {
                  value: [
                    {
                      name: "button",
                      type: "ButtonResponseComponent",
                      choices: { source: "typed", value: ["Left", "Right"] },
                      response: { source: "typed", value: "" },
                    },
                  ],
                },
              },
            }
          : null,
      ),
      trialDataFields: {},
    });
    fireEvent.change(screen.getAllByRole("combobox")[5], {
      target: { value: "Left" },
    });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "Left");
  });
});
