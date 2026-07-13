import {
  afterEach,
  describe,
  expect,
  it,
  loopActions,
  loopRuleHelpers,
  vi,
} from "./testHarness";
import type { LoopCondition } from "./testHarness";

describe("ConditionalLoop condition helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates ConditionalLoop rule fields without loading data unless trialId changes to a value", () => {
    const loadTrialDataFields = vi.fn();
    const conditions: LoopCondition[] = [
      {
        id: 1,
        rules: [
          { trialId: 1, column: "rt", op: "==", value: "100" },
          { trialId: 2, column: "response", op: "!=", value: "no" },
        ],
      },
    ];

    const valueUpdated = loopActions.updateRule(
      conditions,
      1,
      0,
      "value",
      "200",
      loadTrialDataFields,
    );
    const trialCleared = loopActions.updateRule(
      conditions,
      1,
      0,
      "trialId",
      "",
      loadTrialDataFields,
    );
    const missingCondition = loopActions.updateRule(
      conditions,
      99,
      0,
      "value",
      "300",
      loadTrialDataFields,
    );

    expect(valueUpdated[0].rules[0].value).toBe("200");
    expect(valueUpdated[0].rules[1]).toBe(conditions[0].rules[1]);
    expect(trialCleared[0].rules[0]).toEqual({
      trialId: "",
      column: "",
      op: "==",
      value: "100",
      prop: "",
      fieldType: "",
      componentIdx: "",
    });
    expect(missingCondition).toEqual(conditions);
    expect(loadTrialDataFields).not.toHaveBeenCalled();
  });

  it("resets dependent selectors in ConditionalLoop rule helpers", () => {
    const conditions: LoopCondition[] = [
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
      },
    ];

    expect(
      loopRuleHelpers.updateTrialSelection(conditions, 1, 0, "2")[0].rules[0],
    ).toEqual({
      trialId: "2",
      column: "old_column",
      op: "==",
      value: "",
      prop: "",
      fieldType: "",
      componentIdx: "",
    });
    expect(
      loopRuleHelpers.updateFieldType(conditions, 1, 0, "survey")[0].rules[0],
    ).toEqual({
      trialId: 1,
      column: "old_column",
      op: "==",
      value: "",
      prop: "",
      fieldType: "survey",
      componentIdx: "",
    });
    expect(
      loopRuleHelpers.updateComponentIdx(conditions, 1, 0, "2")[0].rules[0],
    ).toEqual({
      trialId: 1,
      column: "old_column",
      op: "==",
      value: "",
      prop: "",
      fieldType: "components",
      componentIdx: "2",
    });
    expect(
      loopRuleHelpers.updateProp(conditions, 1, 0, "rt")[0].rules[0],
    ).toEqual({
      trialId: 1,
      column: "old_column",
      op: "==",
      value: "",
      prop: "rt",
      fieldType: "components",
      componentIdx: "0",
    });
  });
});
