import {
  afterEach,
  describe,
  expect,
  it,
  loopActions,
  vi,
} from "./testHarness";
import type { LoopCondition } from "./testHarness";

describe("ConditionalLoop condition helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds loop conditions with default rule shape", () => {
    vi.spyOn(Date, "now").mockReturnValue(456);

    expect(loopActions.addCondition([])).toEqual([
      {
        id: 456,
        rules: [
          {
            trialId: "",
            column: "",
            op: "==",
            value: "",
            prop: "",
            fieldType: "",
            componentIdx: "",
          },
        ],
      },
    ]);
  });

  it("resets selectors and loads data fields when loop condition trial changes", () => {
    const loadTrialDataFields = vi.fn();
    const conditions: LoopCondition[] = [
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
      },
    ];

    const updated = loopActions.updateRule(
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

  it("adds/removes ConditionalLoop conditions and rules while preserving unrelated items", () => {
    const conditions: LoopCondition[] = [
      {
        id: 1,
        rules: [{ trialId: 1, column: "rt", op: "==", value: "100" }],
      },
      {
        id: 2,
        rules: [{ trialId: 2, column: "response", op: "!=", value: "no" }],
      },
    ];

    const withRule = loopActions.addRuleToCondition(conditions, 1);
    const withoutRule = loopActions.removeRuleFromCondition(withRule, 1, 0);
    const withoutCondition = loopActions.removeCondition(conditions, 2);
    const noMatch = loopActions.removeRuleFromCondition(conditions, 99, 0);

    expect(withRule[0].rules).toHaveLength(2);
    expect(withRule[1]).toBe(conditions[1]);
    expect(withoutRule[0].rules).toEqual([
      {
        trialId: "",
        column: "",
        op: "==",
        value: "",
        prop: "",
        fieldType: "",
        componentIdx: "",
      },
    ]);
    expect(withoutCondition).toEqual([conditions[0]]);
    expect(noMatch).toEqual(conditions);
  });
});
