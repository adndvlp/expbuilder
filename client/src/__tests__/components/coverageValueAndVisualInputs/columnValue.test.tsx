import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderColumnValue } from "./testHarness";

describe("coverage ColumnValue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("updates normal boolean, number, string, csv and default override values", () => {
    const props = renderColumnValue();
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "score" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            enabled: { source: "csv", value: "score" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[0], { target: { value: "" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            enabled: { source: "none", value: null },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "false" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            enabled: { source: "typed", value: false },
          }),
        }),
      ]),
      true,
    );

    const numberProps = renderColumnValue({
      paramKey: "duration",
      paramValue: { source: "typed", value: 5 },
    });
    fireEvent.change(screen.getAllByRole("spinbutton").at(-1)!, {
      target: { value: "42" },
    });
    expect(numberProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            duration: { source: "typed", value: 42 },
          }),
        }),
      ]),
      true,
    );

    const stringProps = renderColumnValue({
      paramKey: "label",
      paramValue: { source: "typed", value: "Go" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Value").at(-1)!, {
      target: { value: "Stop" },
    });
    expect(stringProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            label: { source: "typed", value: "Stop" },
          }),
        }),
      ]),
      true,
    );

    const arrayProps = renderColumnValue({
      paramKey: "tags",
      paramValue: { source: "none", value: null },
    });
    fireEvent.change(screen.getAllByRole("combobox").at(-1)!, {
      target: { value: "type_value" },
    });
    expect(arrayProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            tags: { source: "typed", value: [] },
          }),
        }),
      ]),
      true,
    );
  });

  it("updates dynamic survey question, ParameterInput and fallback values", () => {
    const dynamicCondition = {
      id: 5,
      nextTrialId: "target",
      customParameters: {
        "components::survey::survey_json::q1": {
          source: "typed",
          value: "old",
        },
      },
    } as any;
    const surveyProps = renderColumnValue({
      isTargetDynamic: true,
      condition: dynamicCondition,
      conditions: [dynamicCondition],
      fieldType: "components",
      componentIdx: "survey",
      propName: "survey_json",
      questionName: "q1",
      comp: { type: "SurveyComponent" },
      paramKey: "components::survey::survey_json::q1",
      paramValue: { source: "typed", value: "old" },
    });

    fireEvent.change(screen.getByPlaceholderText("Enter value to set"), {
      target: { value: "new answer" },
    });
    expect(surveyProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "components::survey::survey_json::q1": {
              source: "typed",
              value: "new answer",
            },
          }),
        }),
      ]),
      true,
    );

    const metadataProps = renderColumnValue({
      isTargetDynamic: true,
      condition: dynamicCondition,
      conditions: [dynamicCondition],
      fieldType: "components",
      componentIdx: "text",
      propName: "text",
      comp: { type: "TextComponent" },
      paramKey: "components::text::text",
      paramValue: { source: "typed", value: "Hello" },
    });
    fireEvent.click(screen.getByTestId("parameter-input-text"));
    expect(metadataProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "components::text::text": {
              source: "typed",
              value: "Hello-updated",
            },
          }),
        }),
      ]),
      true,
    );

    const fallbackProps = renderColumnValue({
      isTargetDynamic: true,
      condition: dynamicCondition,
      conditions: [dynamicCondition],
      fieldType: "components",
      componentIdx: "text",
      propName: "unknown",
      comp: { type: "TextComponent" },
      paramKey: "components::text::unknown",
      paramValue: { source: "typed", value: "raw" },
    });
    fireEvent.change(screen.getAllByPlaceholderText("Value").at(-1)!, {
      target: { value: "fallback" },
    });
    expect(fallbackProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "components::text::unknown": {
              source: "typed",
              value: "fallback",
            },
          }),
        }),
      ]),
      true,
    );

    const csvProps = renderColumnValue({
      isTargetDynamic: true,
      condition: dynamicCondition,
      conditions: [dynamicCondition],
      fieldType: "components",
      componentIdx: "text",
      propName: "text",
      comp: { type: "TextComponent" },
      paramKey: "components::text::text",
      paramValue: { source: "none", value: null },
    });
    fireEvent.change(screen.getAllByRole("combobox").at(-1)!, {
      target: { value: "answer" },
    });
    expect(csvProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "components::text::text": { source: "csv", value: "answer" },
          }),
        }),
      ]),
      true,
    );
  });
});
