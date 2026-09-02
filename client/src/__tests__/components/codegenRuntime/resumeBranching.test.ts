import { describe, expect, it } from "vitest";
import {
  getResumeCheckpointFactory,
  getResumeCheckpointFactoryWithManifest,
  getResumeResolver,
} from "./testHarness";

describe("resumeCode", () => {
  it("rejects missing, corrupt, and unversioned resume data", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(resolveResumeBranch(null)).toBeNull();
    expect(resolveResumeBranch("not-json")).toBeNull();
    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [42],
          branchConditions: [],
          trialData: { response: "anything" },
        }),
      ),
    ).toBeNull();
  });

  it("resolves a versioned branch checkpoint without reevaluating it", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          version: 1,
          completed: { builderId: "source", trialIndex: 4 },
          route: {
            kind: "branch",
            targetId: "selected",
            conditionId: 8,
            customParameters: {
              stimulus: { source: "typed", value: "restored" },
            },
            usedDefault: false,
          },
        }),
      ),
    ).toEqual({
      kind: "branch",
      sourceId: "source",
      targetId: "selected",
      conditionId: 8,
      customParameters: {
        stimulus: { source: "typed", value: "restored" },
      },
      usedDefault: false,
    });
  });

  it("stores the branch decision in the versioned checkpoint", () => {
    const createCheckpoint = getResumeCheckpointFactory();

    expect(
      createCheckpoint({
        builder_id: "source",
        trial_index: 4,
        response: "yes",
        branches: ["fallback", "selected"],
        branchConditions: [
          {
            id: 8,
            nextTrialId: "selected",
            rules: [{ column: "response", op: "==", value: "yes" }],
            customParameters: {
              stimulus: { source: "typed", value: "restored" },
            },
          },
        ],
      }),
    ).toEqual({
      version: 1,
      completed: { builderId: "source", trialIndex: 4 },
      route: {
        kind: "branch",
        targetId: "selected",
        conditionId: 8,
        customParameters: {
          stimulus: { source: "typed", value: "restored" },
        },
        usedDefault: false,
      },
    });
  });

  it("stores a sequential route from the compiled address manifest", () => {
    const createCheckpoint = getResumeCheckpointFactoryWithManifest({
      first: "second",
    });

    expect(
      createCheckpoint({
        builder_id: "first",
        trial_index: 0,
        branches: [],
        branchConditions: [],
      }),
    ).toEqual({
      version: 1,
      completed: { builderId: "first", trialIndex: 0 },
      route: {
        kind: "sequential",
        targetId: "second",
        conditionId: null,
        customParameters: null,
        usedDefault: false,
      },
    });
  });
});
