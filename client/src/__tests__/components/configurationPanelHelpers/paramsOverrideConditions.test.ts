import {
  afterEach,
  describe,
  expect,
  it,
  paramsActions,
  vi,
} from "./testHarness";
import type { ParamsOverrideCondition } from "./testHarness";

describe("ParamsOverride condition helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds conditions with default trial-scoped rule shape", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);

    expect(paramsActions.addCondition([])).toEqual([
      {
        id: 123,
        rules: [{ trialId: "", column: "", op: "==", value: "", prop: "" }],
        paramsToOverride: {},
      },
    ]);
  });

  it("resets data-field selectors and loads data fields when trialId changes", () => {
    const loadTrialDataFields = vi.fn();
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "response",
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

    const updated = paramsActions.updateRule(
      conditions,
      1,
      0,
      "trialId",
      2,
      loadTrialDataFields,
    );

    expect(updated[0].rules[0]).toEqual({
      trialId: 2,
      column: "",
      op: "==",
      value: "yes",
      prop: "",
      fieldType: "",
      componentIdx: "",
    });
    expect(loadTrialDataFields).toHaveBeenCalledWith(2);
  });

  it("adds/removes ParamsOverride conditions and rules without mutating unrelated conditions", () => {
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "rt", op: "==", value: "100" }],
        paramsToOverride: {},
      },
      {
        id: 2,
        rules: [{ trialId: 2, column: "response", op: "!=", value: "no" }],
        paramsToOverride: {},
      },
    ];

    const withRule = paramsActions.addRuleToCondition(conditions, 1);
    const withoutRule = paramsActions.removeRuleFromCondition(withRule, 1, 0);
    const withoutCondition = paramsActions.removeCondition(conditions, 2);
    const noMatch = paramsActions.addRuleToCondition(conditions, 99);

    expect(withRule[0].rules).toHaveLength(2);
    expect(withRule[1]).toBe(conditions[1]);
    expect(withoutRule[0].rules).toEqual([
      { trialId: "", column: "", op: "==", value: "", prop: "" },
    ]);
    expect(withoutCondition).toEqual([conditions[0]]);
    expect(noMatch).toEqual(conditions);
  });

  it("updates ParamsOverride rule fields without loading data unless trialId changes to a value", () => {
    const loadTrialDataFields = vi.fn();
    const conditions: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "rt", op: "==", value: "100" }],
        paramsToOverride: {},
      },
    ];

    const valueUpdated = paramsActions.updateRule(
      conditions,
      1,
      0,
      "value",
      "200",
      loadTrialDataFields,
    );
    const trialCleared = paramsActions.updateRule(
      conditions,
      1,
      0,
      "trialId",
      "",
      loadTrialDataFields,
    );
    const missingCondition = paramsActions.updateRule(
      conditions,
      99,
      0,
      "value",
      "300",
      loadTrialDataFields,
    );
    const missingRule = paramsActions.updateRule(
      conditions,
      1,
      99,
      "value",
      "400",
      loadTrialDataFields,
    );

    expect(valueUpdated[0].rules[0].value).toBe("200");
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
    expect(missingRule).toEqual(conditions);
    expect(loadTrialDataFields).not.toHaveBeenCalled();
  });
});
