import {
  afterEach,
  describe,
  expect,
  it,
  paramsActions,
  paramsRuleHelpers,
  vi,
} from "./testHarness";
import type { ParamsOverrideCondition } from "./testHarness";

describe("ParamsOverride condition helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds normal and dynamic parameters to override", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
        paramsToOverride: {
          stimulus: { source: "typed", value: "old" },
        },
      },
    ];

    const normal = paramsActions.addParameterToOverride(
      conditions,
      1,
      [
        { key: "stimulus", label: "Stimulus", type: "html_string" },
        { key: "choices", label: "Choices", type: "string_array" },
      ],
      false,
    );
    const dynamic = paramsActions.addParameterToOverride(
      conditions,
      1,
      [],
      true,
    );
    const missingCondition = paramsActions.addParameterToOverride(
      conditions,
      99,
      [],
      true,
    );

    expect(normal[0].paramsToOverride).toEqual({
      stimulus: { source: "typed", value: "old" },
      choices: { source: "none", value: null },
    });
    expect(dynamic[0].paramsToOverride).toEqual({
      stimulus: { source: "typed", value: "old" },
      "::::": { source: "none", value: null },
    });
    expect(missingCondition).toEqual(conditions);
  });

  it("leaves ParamsOverride params unchanged when no target parameter is available", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
        paramsToOverride: {
          stimulus: { source: "typed", value: "old" },
        },
      },
    ];

    const exhausted = paramsActions.addParameterToOverride(
      conditions,
      1,
      [{ key: "stimulus", label: "Stimulus", type: "html_string" }],
      false,
    );
    const missingCondition = paramsActions.removeParameterFromOverride(
      conditions,
      99,
      "stimulus",
    );

    expect(exhausted[0].paramsToOverride).toEqual(
      conditions[0].paramsToOverride,
    );
    expect(missingCondition).toEqual(conditions);
  });

  it("updates and removes parameter override values", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
        paramsToOverride: {},
      },
    ];

    const updated = paramsActions.updateParameterOverride(
      conditions,
      1,
      "stimulus",
      "typed",
      "new stimulus",
    );
    const removed = paramsActions.removeParameterFromOverride(
      updated,
      1,
      "stimulus",
    );
    const missingCondition = paramsActions.updateParameterOverride(
      conditions,
      99,
      "stimulus",
      "typed",
      "ignored",
    );
    const initialized = paramsActions.updateParameterOverride(
      [
        {
          id: 2,
          rules: [{ trialId: 1, column: "response", op: "==", value: "" }],
          paramsToOverride: undefined,
        } as unknown as ParamsOverrideCondition,
      ],
      2,
      "choices",
      "typed",
      ["yes", "no"],
    );

    expect(updated[0].paramsToOverride.stimulus).toEqual({
      source: "typed",
      value: "new stimulus",
    });
    expect(removed[0].paramsToOverride).toEqual({});
    expect(missingCondition).toEqual(conditions);
    expect(initialized[0].paramsToOverride).toEqual({
      choices: { source: "typed", value: ["yes", "no"] },
    });
  });

  it("resets dynamic selectors in ParamsOverride rule helpers", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "old_column",
            op: "==",
            value: "yes",
            prop: "response",
            fieldType: "components",
            componentIdx: "0",
          },
        ],
        paramsToOverride: {},
      },
    ];

    expect(
      paramsRuleHelpers.updateFieldType(conditions, 1, 0, "survey")[0].rules[0],
    ).toEqual({
      trialId: 1,
      column: "",
      op: "==",
      value: "",
      prop: "",
      fieldType: "survey",
      componentIdx: "",
    });
    expect(
      paramsRuleHelpers.updateComponentIdx(conditions, 1, 0, "2")[0].rules[0],
    ).toEqual({
      trialId: 1,
      column: "",
      op: "==",
      value: "",
      prop: "",
      fieldType: "components",
      componentIdx: "2",
    });
  });
});
