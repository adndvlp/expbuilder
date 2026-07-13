import {
  currentTrial,
  dynamicCondition,
  normalCondition,
  renderRow,
} from "./testHarness";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ParamsOverride ParameterOverrideRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates normal parameter keys, sources and typed values", () => {
    const props = renderRow("difficulty");
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "enabled" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            enabled: { source: "typed", value: "medium" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "csv_difficulty" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "csv", value: "csv_difficulty" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.click(screen.getByTestId("parameter-input-difficulty"));
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "typed", value: "medium-changed" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[0], { target: { value: "" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: {},
        }),
      ]),
      true,
    );
  });

  it("updates dynamic survey question overrides and dynamic component params", () => {
    const condition = dynamicCondition();
    const props = renderRow("components::survey::survey_json::q1", {
      condition,
      conditions: [condition],
      hasDynamicTrial: true,
      currentTrial: currentTrial(),
      hasSurveyJsonParam: true,
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "response_components" } });
    fireEvent.change(selects[1], { target: { value: "survey" } });
    fireEvent.change(selects[2], { target: { value: "duration" } });
    fireEvent.change(selects[3], { target: { value: "q2" } });
    fireEvent.change(selects[4], { target: { value: "csv_enabled" } });
    fireEvent.change(screen.getByPlaceholderText("Enter value to set"), {
      target: { value: "new answer" },
    });

    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            "components::survey::survey_json::q1": {
              source: "typed",
              value: "new answer",
            },
          }),
        }),
      ]),
      true,
    );

    const nonSurveyCondition = normalCondition({
      paramsToOverride: {
        "components::button::text": { source: "typed", value: "Continue" },
      },
    });
    const nonSurveyProps = renderRow("components::button::text", {
      condition: nonSurveyCondition,
      conditions: [nonSurveyCondition],
      hasDynamicTrial: true,
      currentTrial: currentTrial(),
    });

    fireEvent.click(screen.getByTestId("parameter-input-text"));
    expect(nonSurveyProps.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
  });
});
