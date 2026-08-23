import { describe, expect, it, vi } from "vitest";
import type { LoopBranchLevel } from "../../../components/Canvas/features/loop-branching/types";
import {
  commitLoopBranchIntent,
  selectLoopBranchLevel,
  startLoopBranchIntent,
} from "./loopBranch";
import type { LoopBranchIntentDependencies } from "./loopBranch";

const graph = {
  revision: "r1",
  root: { scopeId: null, parentScopeId: null, items: [] },
  scopes: {},
  edges: [],
  diagnostics: [],
};

const levels: LoopBranchLevel[] = [
  {
    scopeId: "inner-loop",
    label: "Nested Loop",
    branchCount: 0,
    crossedLoopIds: [],
  },
  {
    scopeId: null,
    label: "Experiment timeline",
    branchCount: 2,
    crossedLoopIds: ["inner-loop", "outer-loop"],
  },
];

function dependencies(): LoopBranchIntentDependencies {
  return {
    loadLevels: vi.fn().mockResolvedValue({ levels, revision: "r1" }),
    createBranch: vi.fn().mockResolvedValue({
      trial: { id: 9, name: "New Trial", type: "Trial" },
      graph,
    }),
  };
}

describe("loop branch authoring intent", () => {
  it("loads all eligible levels before asking the user for a level", async () => {
    const deps = dependencies();
    const intent = await startLoopBranchIntent({
      experimentId: "experiment-1",
      sourceTrialId: 4,
      dependencies: deps,
    });

    expect(deps.loadLevels).toHaveBeenCalledWith("experiment-1", 4);
    expect(intent.levels).toEqual(levels);
    expect(intent.revision).toBe("r1");
    expect(intent.idempotencyKey).toEqual(expect.any(String));
  });

  it("matches string-like scope ids and rejects unavailable levels", () => {
    const intent = {
      experimentId: "experiment-1",
      sourceTrialId: 4,
      levels: [{ ...levels[0], scopeId: "12" }],
      revision: "r1",
      idempotencyKey: "intent-1",
    };

    expect(selectLoopBranchLevel(intent, "12")).toEqual({
      level: intent.levels[0],
      requiresPlacement: false,
    });
    expect(selectLoopBranchLevel(intent, "missing")).toBeNull();
  });

  it("creates the first branch as parallel without a placement decision", async () => {
    const deps = dependencies();
    const intent = {
      experimentId: "experiment-1",
      sourceTrialId: 4,
      levels,
      revision: "r1",
      idempotencyKey: "intent-1",
    };
    const selection = selectLoopBranchLevel(intent, "inner-loop");
    if (!selection) throw new Error("Expected inner loop level");

    await commitLoopBranchIntent({
      intent,
      selection,
      placement: "sequential",
      dependencies: deps,
    });

    expect(deps.createBranch).toHaveBeenCalledWith(
      "experiment-1",
      4,
      "inner-loop",
      "parallel",
      { expectedRevision: "r1", idempotencyKey: "intent-1" },
    );
  });

  it("honors sequential or parallel placement once the level is occupied", async () => {
    const deps = dependencies();
    const intent = {
      experimentId: "experiment-1",
      sourceTrialId: 4,
      levels,
      revision: "r1",
      idempotencyKey: "intent-2",
    };
    const selection = selectLoopBranchLevel(intent, null);
    if (!selection) throw new Error("Expected root level");

    await commitLoopBranchIntent({
      intent,
      selection,
      placement: "sequential",
      dependencies: deps,
    });

    expect(selection.requiresPlacement).toBe(true);
    expect(deps.createBranch).toHaveBeenCalledWith(
      "experiment-1",
      4,
      null,
      "sequential",
      { expectedRevision: "r1", idempotencyKey: "intent-2" },
    );
  });
});
