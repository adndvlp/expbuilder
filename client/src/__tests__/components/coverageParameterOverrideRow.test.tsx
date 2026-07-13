import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParameterOverrideRow } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow";

const metadata = vi.hoisted(() => ({
  byType: {
    SurveyComponent: {
      parameters: {
        survey_json: { pretty_name: "Survey JSON", type: "object", default: {} },
        raw_label: { type: "string", default: "" },
      },
    },
    TextComponent: {
      parameters: {
        text: { type: "string", default: "" },
        tags: { pretty_name: "Tags", type: "string_array", default: [] },
      },
    },
  } as Record<string, unknown>,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: (type: string | null) => ({
      metadata: type ? metadata.byType[type] || null : null,
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
  () => ({
    ParameterInput: ({ paramKey, value, onChange }: any) => (
      <button
        type="button"
        data-testid={`parameter-input-${paramKey}`}
        onClick={() => onChange(`${value ?? ""}-typed`)}
      >
        input {paramKey}
      </button>
    ),
  }),
);

function conditionWith(paramKey: string, value: unknown = "medium") {
  return {
    id: 1,
    paramsToOverride: {
      [paramKey]: { source: "typed", value },
    },
  } as any;
}

function dynamicTrial() {
  return {
    id: "dynamic",
    columnMapping: {
      components: {
        value: [
          {
            name: { source: "typed", value: "survey" },
            type: "SurveyComponent",
            survey_json: {
              source: "typed",
              value: {
                elements: [
                  { name: "q1", title: "Question 1" },
                  { name: "q2" },
                ],
              },
            },
          },
          { name: "text", type: "TextComponent" },
          { type: "TextComponent" },
        ],
      },
      response_components: {
        value: [{ name: "keyboard", type: "TextComponent" }],
      },
    },
  } as any;
}

function renderRow(overrides: Record<string, unknown> = {}) {
  const paramKey = (overrides.paramKey as string) || "difficulty";
  const condition =
    (overrides.condition as any) ||
    conditionWith(paramKey, overrides.value ?? "medium");
  const conditions =
    (overrides.conditions as any) || [
      condition,
      { id: 2, paramsToOverride: { keep: { source: "typed", value: "keep" } } },
    ];
  const props = {
    paramKey,
    condition,
    conditionId: 1,
    currentTrialParameters: [
      { key: "difficulty", label: "Difficulty", type: "string" },
      { key: "enabled", name: "Enabled by name", type: "boolean" },
      { key: "duration", type: "number" },
      { key: "tags", label: "Tags", type: "string_array" },
    ],
    getCurrentTrialCsvColumns: vi.fn(() => ["score", "answer"]),
    setConditionsWrapper: vi.fn(),
    conditions,
    hasDynamicTrial: false,
    currentTrial: null,
    hasSurveyJsonParam: false,
    ...overrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <ParameterOverrideRow {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );

  return props;
}

describe("ParameterOverrideRow coverage", () => {
  it("renames, removes and updates normal parameter overrides", () => {
    const props = renderRow();

    expect(screen.getByRole("option", { name: "Enabled by name" })).toHaveValue(
      "enabled",
    );
    expect(screen.getByRole("option", { name: "duration" })).toHaveValue(
      "duration",
    );

    const [paramSelect, sourceSelect] = screen.getAllByRole("combobox");
    fireEvent.click(screen.getByTestId("parameter-input-difficulty"));
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "typed", value: "medium-typed" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(paramSelect, { target: { value: "enabled" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            enabled: { source: "typed", value: "medium" },
          }),
        }),
        expect.objectContaining({ id: 2 }),
      ]),
      true,
    );

    fireEvent.change(paramSelect, { target: { value: "" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ paramsToOverride: {} }),
        expect.objectContaining({ id: 2 }),
      ]),
      true,
    );

    fireEvent.change(paramSelect, { target: { value: "difficulty" } });
    fireEvent.change(sourceSelect, { target: { value: "answer" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "csv", value: "answer" },
          }),
        }),
      ]),
      true,
    );

    const csvCondition = {
      id: 1,
      paramsToOverride: {
        difficulty: { source: "csv", value: "" },
      },
    };
    const csvProps = renderRow({ condition: csvCondition });
    fireEvent.change(screen.getAllByRole("combobox").at(-1)!, {
      target: { value: "" },
    });
    expect(csvProps.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "none", value: null },
          }),
        }),
      ]),
      true,
    );
  });

  it("initializes typed values for scalar and array parameters", () => {
    for (const [paramKey, expected] of [
      ["enabled", false],
      ["duration", 0],
      ["tags", []],
      ["difficulty", ""],
    ] as const) {
      const condition = {
        id: 1,
        paramsToOverride: {
          [paramKey]: { source: "none", value: null },
        },
      };
      const props = renderRow({ paramKey, condition, conditions: [{ id: 1 } as any] });
      const sourceSelect = screen.getAllByRole("combobox").at(-1)!;

      fireEvent.change(sourceSelect, { target: { value: "type_value" } });
      expect(props.setConditionsWrapper).toHaveBeenCalledWith(
        [
          {
            id: 1,
            paramsToOverride: {
              [paramKey]: { source: "typed", value: expected },
            },
          },
        ],
        true,
      );
    }
  });

  it("uses the parameter key when a normal parameter has no label", () => {
    renderRow({
      paramKey: "duration",
      condition: conditionWith("duration", 25),
    });

    expect(screen.getByTestId("parameter-input-duration")).toBeInTheDocument();
  });

  it("handles dynamic survey questions and selector resets", () => {
    const paramKey = "components::survey::survey_json::q1";
    const condition = conditionWith(paramKey, 7);
    const props = renderRow({
      paramKey,
      condition,
      conditions: [
        condition,
        { id: 2, paramsToOverride: { untouched: { source: "typed", value: true } } },
      ],
      hasDynamicTrial: true,
      currentTrial: dynamicTrial(),
      hasSurveyJsonParam: true,
    });

    expect(screen.getByRole("option", { name: "q2" })).toHaveValue("q2");
    expect(screen.getByDisplayValue("7")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ paramsToOverride: {} }),
        expect.objectContaining({ id: 2 }),
      ]),
      true,
    );

    fireEvent.change(selects[0], { target: { value: "response_components" } });
    fireEvent.change(selects[1], { target: { value: "text" } });
    fireEvent.change(selects[2], { target: { value: "raw_label" } });
    fireEvent.change(selects[2], { target: { value: "" } });
    fireEvent.change(selects[3], { target: { value: "q2" } });
    fireEvent.change(screen.getByPlaceholderText("Enter value to set"), {
      target: { value: "updated" },
    });

    expect(props.setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);

    const textKey = "components::text::text";
    const textProps = renderRow({
      paramKey: textKey,
      condition: conditionWith(textKey, "hello"),
      hasDynamicTrial: true,
      currentTrial: dynamicTrial(),
    });
    fireEvent.click(screen.getByTestId("parameter-input-text"));
    expect(textProps.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            [textKey]: { source: "typed", value: "hello-typed" },
          }),
        }),
      ]),
      true,
    );

    renderRow({
      paramKey,
      condition: conditionWith(paramKey, { unexpected: true }),
      hasDynamicTrial: true,
      currentTrial: dynamicTrial(),
      hasSurveyJsonParam: true,
    });
    expect(screen.getAllByPlaceholderText("Enter value to set").at(-1)).toHaveValue(
      "",
    );
  });

  it("renders dynamic fallbacks for malformed keys and missing metadata", () => {
    renderRow({
      paramKey: "components::missing::text",
      condition: conditionWith("components::missing::text"),
      hasDynamicTrial: true,
      currentTrial: { columnMapping: { components: {} } },
      hasSurveyJsonParam: true,
    });
    expect(screen.getByText("-")).toBeInTheDocument();

    const surveyWithoutElements = {
      columnMapping: {
        components: {
          value: [
            {
              name: "survey",
              type: "SurveyComponent",
              survey_json: { source: "typed", value: {} },
            },
          ],
        },
      },
    };
    renderRow({
      paramKey: "components::survey::survey_json",
      condition: conditionWith("components::survey::survey_json", {}),
      hasDynamicTrial: true,
      currentTrial: surveyWithoutElements,
      hasSurveyJsonParam: true,
    });
    expect(screen.getAllByRole("option", { name: "Select question" }).at(-1)).toHaveValue(
      "",
    );

    renderRow({
      paramKey: "components::a::b::c::d",
      condition: conditionWith("components::a::b::c::d"),
      hasDynamicTrial: true,
      currentTrial: dynamicTrial(),
      hasSurveyJsonParam: true,
    });
    expect(screen.getAllByRole("combobox").at(-1)).toBeDisabled();
  });
});
