import { describe, expect, it } from "vitest";
import { decideBranch } from "../../pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator";

describe("workspace connection references in the real runtime", () => {
  it("does not execute a routing-only Then with empty rules", () => {
    expect(
      decideBranch(
        {},
        [2, 3],
        [{ id: 7, kind: "route", rules: [], nextTrialId: 3 }],
        2,
      ),
    ).toEqual({
      targetId: 2,
      conditionId: null,
      customParameters: null,
      usedDefault: true,
    });
  });
  it("keeps the existing behavior of a legacy empty condition", () => {
    expect(
      decideBranch({}, [2, 3], [{ id: 7, rules: [], nextTrialId: 3 }], 2)
        .targetId,
    ).toBe(3);
  });
  it("preserves configured condition priority and parameters", () => {
    const decision = decideBranch(
      { response: "yes" },
      [2, 3],
      [
        { id: 5, kind: "route", rules: [], nextTrialId: 2 },
        {
          id: 7,
          kind: "condition",
          rules: [{ column: "response", op: "==", value: "yes" }],
          nextTrialId: 3,
          customParameters: { kept: true },
        },
      ],
      2,
    );
    expect(decision).toEqual({
      targetId: 3,
      conditionId: 7,
      customParameters: { kept: true },
      usedDefault: false,
    });
  });
});
