import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ColumnValue from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride/ColumnValue";
import VisualStyleInput, {
  getVisualDefaultValue,
  getVisualStylePriority,
  isVisualColorParameter,
  isVisualStyleParameter,
  numericConfig,
  shouldSpanVisualControl,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/VisualStyleInput";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
  () => ({
    ParameterInput: ({ paramKey, value, onChange }: any) => (
      <button
        type="button"
        data-testid={`parameter-input-${paramKey}`}
        onClick={() => onChange(`${value ?? ""}-updated`)}
      >
        parameter input {paramKey}
      </button>
    ),
  }),
);

function normalCondition() {
  return {
    id: 1,
    nextTrialId: "target",
    customParameters: {
      enabled: { source: "typed", value: true },
      duration: { source: "typed", value: 5 },
      label: { source: "typed", value: "Go" },
    },
  } as any;
}

function renderColumnValue(overrides: Record<string, unknown> = {}) {
  const condition = normalCondition();
  const props = {
    isTargetDynamic: false,
    fieldType: "",
    componentIdx: "",
    propName: "",
    comp: null,
    questionName: "",
    paramValue: { source: "typed", value: true },
    setConditions: vi.fn(),
    conditions: [condition, { id: 2, customParameters: { keep: true } }],
    parametersArray: [
      { key: "text", label: "Text", type: "string", default: "", description: "" },
      {
        key: "survey_json",
        label: "Survey JSON",
        type: "object",
        default: {},
        description: "",
      },
    ],
    availableParams: [
      { key: "enabled", label: "Enabled", type: "boolean" },
      { key: "duration", label: "Duration", type: "number" },
      { key: "label", label: "Label", type: "string" },
      { key: "tags", label: "Tags", type: "string_array" },
    ],
    condition,
    targetTrialCsvColumns: { target: ["score", "answer"] },
    paramKey: "enabled",
    triggerSave: vi.fn(),
    ...overrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <ColumnValue {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );

  return props;
}

function renderVisualInput(overrides: Record<string, unknown> = {}) {
  const props = {
    localInputValues: {},
    setColumnMapping: vi.fn(),
    paramKey: "font_size",
    type: "number",
    entry: { source: "typed", value: 16 },
    label: "Font size",
    onSave: vi.fn(),
    setLocalInputValues: vi.fn(),
    ...overrides,
  };

  render(<VisualStyleInput {...(props as any)} />);
  return props;
}

function invokeSetter(mock: ReturnType<typeof vi.fn>, previous: any) {
  const updater = mock.mock.calls.at(-1)?.[0];
  expect(typeof updater).toBe("function");
  return updater(previous);
}

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

describe("coverage VisualStyleInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("classifies visual style parameters and returns defaults/priorities", () => {
    expect(isVisualColorParameter("stroke_color")).toBe(true);
    expect(isVisualColorParameter("custom_color")).toBe(true);
    expect(isVisualStyleParameter("font_family")).toBe(true);
    expect(isVisualStyleParameter("custom_font_size", "number")).toBe(true);
    expect(isVisualStyleParameter("custom_border", "number")).toBe(true);
    expect(isVisualStyleParameter("custom_radius", "number")).toBe(true);
    expect(isVisualStyleParameter("plain", "string")).toBe(false);
    expect(shouldSpanVisualControl("border_radius")).toBe(true);
    expect(getVisualStylePriority("text")).toBe(0);
    expect(getVisualStylePriority("unknown")).toBe(1000);
    expect(getVisualDefaultValue("font_weight")).toBe("normal");
    expect(getVisualDefaultValue("font_style")).toBe("normal");
    expect(getVisualDefaultValue("text_align")).toBe("center");
    expect(getVisualDefaultValue("font_family")).toBe("sans-serif");
    expect(getVisualDefaultValue("line_height")).toBe(1.5);
    expect(getVisualDefaultValue("border_width")).toBe(0);
    expect(getVisualDefaultValue("border_radius")).toBe(0);
    expect(getVisualDefaultValue("stroke_width")).toBe(3);
    expect(getVisualDefaultValue("marker_radius")).toBe(8);
    expect(getVisualDefaultValue("font_size")).toBe(16);
    expect(getVisualDefaultValue("background_color")).toBe("transparent");
    expect(getVisualDefaultValue("border_color")).toBe("transparent");
    expect(getVisualDefaultValue("button_color")).toBe("#e7e7e7");
    expect(getVisualDefaultValue("button_text_color")).toBe("#000000");
    expect(getVisualDefaultValue("font_color")).toBe("#000000");
    expect(getVisualDefaultValue("unknown_number", "number")).toBe(0);
    expect(getVisualDefaultValue("plain")).toBe("");
    expect(numericConfig("custom_numeric")).toEqual({
      min: 0,
      max: 1000,
      step: 1,
    });
  });

  it("commits font family, numeric changes and clamps numeric values", () => {
    const familyProps = renderVisualInput({
      paramKey: "font_family",
      type: "string",
      entry: { source: "typed", value: "Arial" },
      label: "Font family",
    });
    fireEvent.change(screen.getByLabelText("Font family"), {
      target: { value: "Georgia" },
    });
    expect(invokeSetter(familyProps.setColumnMapping, {})).toEqual({
      font_family: { source: "typed", value: "Georgia" },
    });
    expect(
      invokeSetter(familyProps.setLocalInputValues, {
        font_family: "Arial",
        keep: "value",
      }),
    ).toEqual({ keep: "value" });
    vi.runOnlyPendingTimers();
    expect(familyProps.onSave).toHaveBeenCalledWith("font_family", {
      source: "typed",
      value: "Georgia",
    });

    const fallbackFamilyProps = renderVisualInput({
      paramKey: "button_font_family",
      type: "string",
      entry: { source: "typed", value: null },
      label: "Button font family",
      onSave: undefined,
    });
    expect(screen.getByLabelText("Button font family")).toHaveValue("sans-serif");
    fireEvent.change(screen.getByLabelText("Button font family"), {
      target: { value: "serif" },
    });
    expect(invokeSetter(fallbackFamilyProps.setColumnMapping, {})).toEqual({
      button_font_family: { source: "typed", value: "serif" },
    });

    renderVisualInput({
      localInputValues: { input_font_family: 42 },
      paramKey: "input_font_family",
      type: "string",
      entry: { source: "typed", value: 42 },
      label: "Input font family",
    });
    expect(screen.getByLabelText("Input font family")).toHaveValue("sans-serif");

    const numericProps = renderVisualInput({
      paramKey: "font_size",
      entry: { source: "typed", value: 16 },
      label: "Font size",
    });
    fireEvent.click(screen.getByLabelText("Increase Font size"));
    expect(invokeSetter(numericProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 17 },
    });
    fireEvent.click(screen.getByLabelText("Decrease Font size"));
    expect(invokeSetter(numericProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 15 },
    });

    const input = screen.getByLabelText("Font size");
    fireEvent.change(input, { target: { value: "9999" } });
    expect(numericProps.setLocalInputValues).toHaveBeenCalled();
    expect(invokeSetter(numericProps.setLocalInputValues, { keep: "value" })).toEqual({
      keep: "value",
      font_size: "16",
    });
    fireEvent.blur(input, { target: { value: "9999" } });
    expect(invokeSetter(numericProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 240 },
    });

    const lineProps = renderVisualInput({
      paramKey: "line_height",
      entry: { source: "typed", value: "not-a-number" },
      label: "Line height",
    });
    fireEvent.blur(screen.getByLabelText("Line height"), {
      target: { value: "bad" },
    });
    expect(invokeSetter(lineProps.setColumnMapping, {})).toEqual({
      line_height: { source: "typed", value: 1.5 },
    });

    const emptyFontProps = renderVisualInput({
      paramKey: "font_size",
      entry: { source: "typed", value: 18 },
      label: "Empty font size",
    });
    fireEvent.blur(screen.getByLabelText("Empty font size"), {
      target: { value: "" },
    });
    expect(invokeSetter(emptyFontProps.setColumnMapping, {})).toEqual({
      font_size: { source: "typed", value: 18 },
    });

    const invalidBorderProps = renderVisualInput({
      paramKey: "border_width",
      entry: { source: "typed", value: "invalid" },
      label: "Invalid border width",
    });
    fireEvent.click(screen.getByLabelText("Increase Invalid border width"));
    expect(invokeSetter(invalidBorderProps.setColumnMapping, {})).toEqual({
      border_width: { source: "typed", value: 1 },
    });

    (
      [
        ["border_width", "Border width", 1],
        ["border_radius", "Border radius", 1],
        ["stroke_width", "Stroke width", 4],
        ["marker_radius", "Marker radius", 9],
      ] as const
    ).forEach(([paramKey, label, expected]) => {
      const props = renderVisualInput({
        paramKey,
        entry: { source: "typed", value: getVisualDefaultValue(paramKey) },
        label,
      });
      fireEvent.click(screen.getByLabelText(`Increase ${label}`));
      expect(invokeSetter(props.setColumnMapping, {})).toEqual({
        [paramKey]: { source: "typed", value: expected },
      });
    });
  });

  it("commits toggle and alignment buttons and renders null for unsupported keys", () => {
    const boldProps = renderVisualInput({
      paramKey: "font_weight",
      type: "string",
      entry: { source: "typed", value: "normal" },
      label: "Font weight",
    });
    fireEvent.click(screen.getByLabelText("Bold"));
    expect(invokeSetter(boldProps.setColumnMapping, {})).toEqual({
      font_weight: { source: "typed", value: "bold" },
    });

    const activeBoldProps = renderVisualInput({
      paramKey: "font_weight",
      type: "string",
      entry: { source: "typed", value: "bold" },
      label: "Active font weight",
    });
    fireEvent.click(screen.getAllByLabelText("Bold").at(-1)!);
    expect(invokeSetter(activeBoldProps.setColumnMapping, {})).toEqual({
      font_weight: { source: "typed", value: "normal" },
    });

    const italicProps = renderVisualInput({
      paramKey: "font_style",
      type: "string",
      entry: { source: "typed", value: "italic" },
      label: "Font style",
    });
    fireEvent.click(screen.getByLabelText("Italic"));
    expect(invokeSetter(italicProps.setColumnMapping, {})).toEqual({
      font_style: { source: "typed", value: "normal" },
    });

    const inactiveItalicProps = renderVisualInput({
      paramKey: "font_style",
      type: "string",
      entry: { source: "typed", value: "normal" },
      label: "Inactive font style",
    });
    fireEvent.click(screen.getAllByLabelText("Italic").at(-1)!);
    expect(invokeSetter(inactiveItalicProps.setColumnMapping, {})).toEqual({
      font_style: { source: "typed", value: "italic" },
    });

    const alignProps = renderVisualInput({
      paramKey: "text_align",
      type: "string",
      entry: { source: "typed", value: "bogus" },
      label: "Text align",
    });
    fireEvent.click(screen.getByLabelText("Align right"));
    expect(invokeSetter(alignProps.setColumnMapping, {})).toEqual({
      text_align: { source: "typed", value: "right" },
    });

    renderVisualInput({
      paramKey: "text_align",
      type: "string",
      entry: { source: "typed", value: "left" },
      label: "Left text align",
    });
    expect(screen.getAllByLabelText("Align left").at(-1)).toHaveStyle({
      background: "#164e63",
    });

    const { container } = render(
      <VisualStyleInput
        localInputValues={{}}
        setColumnMapping={vi.fn()}
        paramKey="plain"
        type="string"
        entry={{ source: "typed", value: "ignored" }}
        label="Plain"
        onSave={undefined}
        setLocalInputValues={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
