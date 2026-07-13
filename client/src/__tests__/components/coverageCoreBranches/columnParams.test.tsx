import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ColumnParams from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride/ColumnParams";

function renderColumnParams(overrides: Record<string, unknown> = {}) {
  const condition = {
    id: 1,
    customParameters: {
      "components::survey::survey_json::q1": {
        source: "typed",
        value: "old",
      },
    },
  } as any;
  const props = {
    isTargetDynamic: true,
    fieldType: "components",
    componentIdx: "survey",
    propName: "survey_json",
    comp: {
      name: { source: "typed", value: "survey" },
      type: "SurveyComponent",
      survey_json: {
        source: "typed",
        value: {
          elements: [{ name: "q1", title: "Question 1" }, { name: "q2" }],
        },
      },
    },
    questionName: "q1",
    paramValue: { source: "typed", value: "old" },
    setConditions: vi.fn(),
    conditions: [condition, { id: 2, customParameters: { keep: true } }],
    parametersArray: [
      {
        key: "survey_json",
        label: "Survey JSON",
        type: "object",
        default: {},
        description: undefined,
      },
      {
        key: "text",
        label: "Text",
        type: "string",
        default: "",
        description: undefined,
      },
    ],
    availableParams: [
      { key: "difficulty", label: "Difficulty" },
      { key: "duration", label: "Duration" },
      { key: "unlabeled" },
    ],
    condition,
    paramKey: "components::survey::survey_json::q1",
    compArr: [
      { name: { source: "typed", value: "survey" } },
      { name: "button" },
    ],
    getPropValue: (prop: any) =>
      prop && typeof prop === "object" && "value" in prop ? prop.value : prop,
    metadataLoading: false,
    hasSurveyJsonParam: true,
    ...overrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <ColumnParams {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );
  return props;
}

describe("coverage core branches: ColumnParams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates dynamic field, component, property and survey question keys", () => {
    const props = renderColumnParams();
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, customParameters: {} }),
      ]),
      true,
    );

    fireEvent.change(selects[0], { target: { value: "response_components" } });
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "response_components::::": { source: "none", value: null },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "button" } });
    fireEvent.change(selects[2], { target: { value: "text" } });
    fireEvent.change(selects[3], { target: { value: "q2" } });

    expect(props.setConditions).toHaveBeenCalledWith(expect.any(Array), true);
    expect(props.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: expect.objectContaining({
            "components::survey::survey_json::q2": {
              source: "none",
              value: null,
            },
          }),
        }),
      ]),
      true,
    );
  });

  it("renders disabled dynamic states and normal plugin parameter edits", () => {
    renderColumnParams({
      fieldType: "",
      componentIdx: "",
      propName: "",
      comp: null,
      metadataLoading: true,
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[1]).toBeDisabled();

    renderColumnParams({
      comp: {
        name: { source: "typed", value: "empty-survey" },
        type: "SurveyComponent",
      },
      componentIdx: "empty-survey",
    });
    expect(
      screen.getByRole("option", { name: "Select question" }),
    ).toBeInTheDocument();

    const normalCondition = {
      id: 3,
      customParameters: { difficulty: { source: "typed", value: "medium" } },
    } as any;
    const normalProps = renderColumnParams({
      isTargetDynamic: false,
      condition: normalCondition,
      conditions: [
        normalCondition,
        { id: 4, customParameters: { untouched: true } },
      ],
      paramKey: "difficulty",
      paramValue: { source: "typed", value: "medium" },
    });

    const normalSelect = screen.getAllByRole("combobox").at(-1)!;
    expect(
      screen.getByRole("option", { name: "unlabeled" }),
    ).toBeInTheDocument();
    fireEvent.change(normalSelect, { target: { value: "duration" } });
    expect(normalProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customParameters: { duration: { source: "typed", value: "medium" } },
        }),
      ]),
      true,
    );

    fireEvent.change(normalSelect, { target: { value: "" } });
    expect(normalProps.setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ customParameters: {} }),
      ]),
      true,
    );
  });
});
