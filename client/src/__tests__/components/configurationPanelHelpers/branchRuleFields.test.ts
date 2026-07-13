import { branchRuleHelpers, describe, expect, it } from "./testHarness";
import type { Condition } from "./testHarness";

describe("BranchedTrial rule helpers", () => {
  it("resets dependent dynamic-plugin fields when field type changes", () => {
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "old_column",
            op: "==",
            value: "yes",
            fieldType: "components",
            componentIdx: "0",
            prop: "response",
          },
        ],
      },
    ];

    expect(
      branchRuleHelpers.updateFieldType(conditions, 1, 0, "survey"),
    ).toEqual([
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "",
            op: "==",
            value: "",
            fieldType: "survey",
            componentIdx: "",
            prop: "",
          },
        ],
      },
    ]);
  });

  it("resets property, column and value when component index changes", () => {
    const conditions: Condition[] = [
      {
        id: 1,
        nextTrialId: 2,
        rules: [
          {
            column: "old_column",
            op: "==",
            value: "yes",
            fieldType: "components",
            componentIdx: "0",
            prop: "response",
          },
        ],
      },
    ];

    expect(branchRuleHelpers.updateComponentIdx(conditions, 1, 0, "2")).toEqual(
      [
        {
          id: 1,
          nextTrialId: 2,
          rules: [
            {
              column: "",
              op: "==",
              value: "",
              fieldType: "components",
              componentIdx: "2",
              prop: "",
            },
          ],
        },
      ],
    );
  });
});
