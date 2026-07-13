import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AddParamButtonCellHarness,
  metadataMockState,
  ParameterOverrideHarness,
} from "./testHarness";

describe("coverage branched condition parameter overrides", () => {
  afterEach(() => {
    metadataMockState.missing = false;
  });

  it("renders direct parameter override empty and fallback states", () => {
    const baseProps = {
      targetTrialParameters: {
        "target-a": [
          { key: "difficulty", label: "Difficulty", type: "string" },
          { key: "text", label: "Text", type: "string" },
        ],
      },
      findTrialById: vi.fn((id: string | number) => ({
        id,
        plugin: "plugin-dynamic",
        columnMapping: {
          components: {
            value: [
              {
                name: "button",
                type: "ButtonResponseComponent",
              },
            ],
          },
        },
      })),
      isJumpCondition: false,
      setConditions: vi.fn(),
      conditions: [],
      targetTrialCsvColumns: {},
      triggerSave: vi.fn(),
    };

    const dynamicEmpty = render(
      <table>
        <tbody>
          <tr>
            <ParameterOverrideHarness
              {...(baseProps as any)}
              condition={{
                id: 5,
                nextTrialId: "target-a",
                customParameters: {},
              }}
              paramKey=""
              isTargetDynamic
              hasSurveyJsonParam
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(dynamicEmpty.container.querySelectorAll("td")).toHaveLength(5);
    dynamicEmpty.unmount();

    const normalEmpty = render(
      <table>
        <tbody>
          <tr>
            <ParameterOverrideHarness
              {...(baseProps as any)}
              condition={{
                id: 6,
                nextTrialId: "target-a",
                customParameters: {},
              }}
              paramKey=""
              isTargetDynamic={false}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(normalEmpty.container.querySelectorAll("td")).toHaveLength(2);
    normalEmpty.unmount();

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverrideHarness
              {...(baseProps as any)}
              condition={{
                id: 7,
                customParameters: {
                  difficulty: { source: "typed", value: "medium" },
                },
              }}
              paramKey="difficulty"
              isTargetDynamic={false}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders direct dynamic parameter overrides and add buttons", () => {
    const addCustomParameter = vi.fn();
    const condition = {
      id: 8,
      nextTrialId: "target-a",
      customParameters: {
        "components::button::text": { source: "typed", value: "Continue" },
      },
    } as any;
    const props = {
      condition,
      paramKey: "components::button::text",
      targetTrialParameters: { "target-a": [] },
      findTrialById: vi.fn(() => ({
        id: "target-a",
        columnMapping: {
          components: {
            value: [
              {
                name: "button",
                type: "ButtonResponseComponent",
              },
            ],
          },
        },
      })),
      isJumpCondition: false,
      setConditions: vi.fn(),
      conditions: [condition],
      targetTrialCsvColumns: { "target-a": ["csv_text"] },
      isTargetDynamic: true,
      hasSurveyJsonParam: false,
    };

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverrideHarness {...(props as any)} />
          </tr>
          <tr>
            <AddParamButtonCellHarness
              condition={condition}
              addCustomParameter={addCustomParameter}
              isTargetDynamic
              hasSurveyJsonParam={false}
            />
          </tr>
        </tbody>
      </table>,
    );

    fireEvent.change(screen.getAllByRole("combobox")[3], {
      target: { value: "type_value" },
    });
    expect(props.setConditions).toHaveBeenCalledWith(expect.any(Array), true);

    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(addCustomParameter).toHaveBeenCalledWith(8, true);
  });

  it("renders a four-part dynamic override with missing mapping metadata", () => {
    const condition = {
      id: 9,
      nextTrialId: "missing-target",
      customParameters: {
        "components::survey::survey_json::question1": {
          source: "typed",
          value: "answer",
        },
      },
    } as any;

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverrideHarness
              condition={condition}
              paramKey="components::survey::survey_json::question1"
              targetTrialParameters={{}}
              findTrialById={vi.fn(() => ({
                id: "missing-target",
                plugin: "plugin-dynamic",
                columnMapping: { components: {} },
              }))}
              setConditions={vi.fn()}
              conditions={[condition]}
              targetTrialCsvColumns={{}}
              triggerSave={vi.fn()}
              isTargetDynamic
              hasSurveyJsonParam
            />
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByRole("option", { name: "Survey JSON" })).toHaveValue(
      "survey_json",
    );
    expect(screen.getByRole("option", { name: "raw_label" })).toHaveValue(
      "raw_label",
    );
  });

  it("handles malformed dynamic keys without component metadata", () => {
    metadataMockState.missing = true;
    const condition = {
      id: 10,
      customParameters: {
        "components::broken": { source: "typed", value: "raw" },
      },
    } as any;

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverrideHarness
              condition={condition}
              paramKey="components::broken"
              targetTrialParameters={{}}
              findTrialById={vi.fn()}
              setConditions={vi.fn()}
              conditions={[condition]}
              targetTrialCsvColumns={{}}
              triggerSave={vi.fn()}
              isTargetDynamic
            />
          </tr>
        </tbody>
      </table>,
    );

    expect(
      screen.getByRole("option", { name: "Select property" }),
    ).toBeInTheDocument();
  });
});
