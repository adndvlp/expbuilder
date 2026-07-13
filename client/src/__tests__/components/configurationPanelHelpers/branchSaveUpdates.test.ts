import { buildBranchingSaveUpdates, describe, expect, it } from "./testHarness";

describe("buildBranchingSaveUpdates", () => {
  it("does not clear existing branches when a condition has no target", () => {
    const updates = buildBranchingSaveUpdates({
      conditions: [
        {
          id: 1,
          nextTrialId: null,
          rules: [{ column: "", op: "==", value: "" }],
          customParameters: {},
        },
      ],
      existingBranches: [2, 3],
      isBranchTarget: () => false,
    });

    expect(updates).toEqual({
      branchConditions: [],
      repeatConditions: [],
    });
  });

  it("keeps existing branches when saving a condition for an existing branch target", () => {
    const updates = buildBranchingSaveUpdates({
      conditions: [
        {
          id: 1,
          nextTrialId: 2,
          rules: [{ column: "response", op: "==", value: "left" }],
          customParameters: {},
        },
      ],
      existingBranches: [2, 3],
      isBranchTarget: (trialId) => trialId === 2,
    });

    expect(updates).toEqual({
      branchConditions: [
        {
          id: 1,
          nextTrialId: 2,
          rules: [{ column: "response", op: "==", value: "left" }],
          customParameters: {},
        },
      ],
      repeatConditions: [],
    });
  });

  it("adds a new downstream branch target without removing existing branches", () => {
    const updates = buildBranchingSaveUpdates({
      conditions: [
        {
          id: 1,
          nextTrialId: "loop_1",
          rules: [{ column: "response", op: "==", value: "go" }],
          customParameters: {},
        },
      ],
      existingBranches: [2, 3],
      isBranchTarget: (trialId) => trialId === "loop_1",
    });

    expect(updates).toEqual({
      branches: [2, 3, "loop_1"],
      branchConditions: [
        {
          id: 1,
          nextTrialId: "loop_1",
          rules: [{ column: "response", op: "==", value: "go" }],
          customParameters: {},
        },
      ],
      repeatConditions: [],
    });
  });
});
