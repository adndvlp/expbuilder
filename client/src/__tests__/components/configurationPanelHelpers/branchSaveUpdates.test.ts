import { buildBranchingSaveUpdates, describe, expect, it } from "./testHarness";

describe("buildBranchingSaveUpdates", () => {
  it("removes stale branches when no Default or Then references remain", () => {
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
      branches: [],
      branchConditions: [],
    });
  });

  it("keeps only destinations referenced by the saved conditions", () => {
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
      branches: [2],
      branchConditions: [
        {
          id: 1,
          nextTrialId: 2,
          rules: [{ column: "response", op: "==", value: "left" }],
          customParameters: {},
        },
      ],
    });
  });

  it("replaces stale destinations with the configured destination", () => {
    const updates = buildBranchingSaveUpdates({
      conditions: [
        {
          id: 1,
          nextTrialId: "earlier-trial",
          rules: [{ column: "response", op: "==", value: "go" }],
          customParameters: {},
        },
      ],
      existingBranches: [2, 3],
      isBranchTarget: (trialId) => trialId === "earlier-trial",
    });

    expect(updates).toEqual({
      branches: ["earlier-trial"],
      branchConditions: [
        {
          id: 1,
          nextTrialId: "earlier-trial",
          rules: [{ column: "response", op: "==", value: "go" }],
          customParameters: {},
        },
      ],
    });
  });
});
