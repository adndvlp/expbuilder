import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ColumnValue from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride/ColumnValue";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
  () => ({
    ParameterInput: ({ paramKey, onChange }: any) => (
      <button
        type="button"
        data-testid={`column-parameter-input-${paramKey}`}
        onClick={() => onChange("updated")}
      >
        parameter input
      </button>
    ),
  }),
);

function renderColumn(overrides: Record<string, any> = {}) {
  const condition = overrides.condition || {
    id: 1,
    nextTrialId: "target",
    customParameters: {
      value: { source: "typed", value: "old" },
    },
  };
  const props = {
    isTargetDynamic: true,
    fieldType: "components",
    componentIdx: "0",
    propName: "text",
    comp: { type: "TextComponent" },
    questionName: "",
    paramValue: { source: "typed", value: "hello" },
    conditions: [condition, { id: 2, customParameters: { keep: true } }],
    setConditions: vi.fn(),
    parametersArray: [{ key: "text", label: "Text", type: "string" }],
    availableParams: [{ key: "value", type: "string" }],
    condition,
    targetTrialCsvColumns: { target: ["score", "answer"] },
    paramKey: "value",
    ...overrides,
  };

  const view = render(
    <table>
      <tbody>
        <tr>
          <ColumnValue {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );

  return { ...props, ...view };
}

describe("ColumnValue", () => {
  it("switches dynamic overrides between CSV and default sources", () => {
    const condition = { id: 1, nextTrialId: "target" };
    const props = renderColumn({
      condition,
      conditions: [condition, { id: 2, customParameters: { keep: true } }],
      paramValue: { source: "csv", value: "score" },
    });
    const sourceSelect = screen.getByRole("combobox");

    expect(sourceSelect).toHaveValue("score");
    fireEvent.change(sourceSelect, { target: { value: "" } });
    expect(props.setConditions).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          customParameters: {
            value: { source: "none", value: null },
          },
        }),
        expect.objectContaining({ id: 2 }),
      ],
      true,
    );

    fireEvent.change(sourceSelect, { target: { value: "answer" } });
    expect(props.setConditions).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: {
            value: { source: "csv", value: "answer" },
          },
        }),
      ]),
      true,
    );

    fireEvent.change(sourceSelect, { target: { value: "type_value" } });
    expect(props.setConditions).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: {
            value: { source: "typed", value: "" },
          },
        }),
      ]),
      true,
    );
  });

  it("renders an empty dynamic source without a target trial", () => {
    const condition = { id: 1 };
    renderColumn({
      condition,
      conditions: [condition],
      paramValue: { source: "none", value: null },
    });

    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("normalizes dynamic survey question values", () => {
    const base = {
      comp: { type: "SurveyComponent" },
      propName: "survey_json",
      questionName: "q1",
      parametersArray: [],
    };
    const objectView = renderColumn({
      ...base,
      paramValue: { source: "typed", value: { nested: true } },
    });

    expect(screen.getByPlaceholderText("Enter value to set")).toHaveValue("");
    objectView.unmount();

    const numberView = renderColumn({
      ...base,
      paramValue: { source: "typed", value: 7 },
    });
    expect(screen.getByPlaceholderText("Enter value to set")).toHaveValue("7");
    fireEvent.change(screen.getByPlaceholderText("Enter value to set"), {
      target: { value: "updated survey" },
    });
    expect(numberView.setConditions).toHaveBeenCalled();
    numberView.unmount();
  });

  it("uses metadata labels and dynamic fallback inputs", () => {
    const metadataProps = renderColumn({
      propName: "raw_label",
      parametersArray: [{ key: "raw_label", type: "string" }],
    });
    fireEvent.click(screen.getByTestId("column-parameter-input-raw_label"));
    expect(metadataProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            value: { source: "typed", value: "updated" },
          }),
        }),
      ]),
      true,
    );
    metadataProps.unmount();

    const objectView = renderColumn({
      propName: "unknown",
      parametersArray: [],
      paramValue: { source: "typed", value: {} },
    });
    expect(screen.getByPlaceholderText("Value")).toHaveValue("");
    objectView.unmount();

    renderColumn({
      propName: "unknown",
      parametersArray: [],
      paramValue: { source: "typed", value: 9 },
    });
    expect(screen.getByPlaceholderText("Value")).toHaveValue("9");
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "fallback update" },
    });
  });

  it.each([
    ["boolean", false],
    ["number", 0],
    ["string_array", []],
    ["string", ""],
  ] as const)("initializes a static %s typed value", (type, expected) => {
    const props = renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type }],
      paramValue: { source: "none", value: null },
    });

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "type_value" },
    });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            value: { source: "typed", value: expected },
          }),
        }),
      ]),
      true,
    );
  });

  it("renders static CSV, boolean and number fallback values", () => {
    const csvView = renderColumn({
      isTargetDynamic: false,
      paramValue: { source: "csv", value: "score" },
    });
    const csvSource = screen.getByRole("combobox");
    expect(csvSource).toHaveValue("score");
    fireEvent.change(csvSource, { target: { value: "" } });
    fireEvent.change(csvSource, { target: { value: "answer" } });
    csvView.unmount();

    const booleanView = renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type: "boolean" }],
      paramValue: { source: "typed", value: true },
    });
    expect(screen.getAllByRole("combobox").at(-1)).toHaveValue("true");
    fireEvent.change(screen.getAllByRole("combobox").at(-1)!, {
      target: { value: "false" },
    });
    booleanView.unmount();

    const falseBooleanView = renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type: "boolean" }],
      paramValue: { source: "typed", value: false },
    });
    expect(screen.getAllByRole("combobox").at(-1)).toHaveValue("false");
    falseBooleanView.unmount();

    const invalidNumberView = renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type: "number" }],
      paramValue: { source: "typed", value: "invalid" },
    });
    expect(screen.getByRole("spinbutton")).toHaveValue(0);
    invalidNumberView.unmount();

    const numberView = renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type: "number" }],
      paramValue: { source: "typed", value: 12 },
    });
    expect(screen.getByRole("spinbutton")).toHaveValue(12);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "13" },
    });
    expect(numberView.setConditions).toHaveBeenCalled();
  });

  it("normalizes static text values", () => {
    const objectView = renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type: "string" }],
      paramValue: { source: "typed", value: {} },
    });
    expect(screen.getByPlaceholderText("Value")).toHaveValue("");
    objectView.unmount();

    renderColumn({
      isTargetDynamic: false,
      availableParams: [{ key: "value", type: "string" }],
      paramValue: { source: "typed", value: 4 },
    });
    expect(screen.getByPlaceholderText("Value")).toHaveValue("4");
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "text update" },
    });
  });

  it("renders nothing for a missing static parameter", () => {
    const { container } = renderColumn({
      isTargetDynamic: false,
      availableParams: [],
      paramValue: { source: "none", value: null },
    });

    expect(container.querySelector("td")).toBeEmptyDOMElement();
  });
});
