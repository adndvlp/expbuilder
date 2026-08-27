import { describe, expect, it } from "vitest";
import {
  getResumeCheckpointFactory,
  getResumeCheckpointFactoryWithManifest,
  getResumeResolver,
} from "./testHarness";

describe("resumeCode", () => {
  it("returns null for missing or corrupt resume data", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(resolveResumeBranch(null)).toBeNull();
    expect(resolveResumeBranch("not-json")).toBeNull();
  });

  it("returns the complete only-branch decision", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [42],
          branchConditions: [],
          trialData: { response: "anything" },
        }),
      ),
    ).toEqual({
      kind: "branch",
      sourceId: null,
      targetId: "42",
      conditionId: null,
      customParameters: null,
      usedDefault: true,
    });
  });

  it("uses matching condition.nextTrialId for multiple branches", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [{ column: "response", op: "==", value: "yes" }],
            },
          ],
          trialData: { response: "yes" },
        }),
      ),
    ).toEqual({
      kind: "branch",
      sourceId: null,
      targetId: "3",
      conditionId: 1,
      customParameters: null,
      usedDefault: false,
    });
  });

  it("supports nested survey response fields and array comparisons", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [
                {
                  column: "SurveyComponent_1_choice",
                  op: "==",
                  value: "blue",
                },
                {
                  column: "selected_values",
                  op: "==",
                  value: "ready",
                },
              ],
            },
          ],
          trialData: {
            SurveyComponent_1_response: { choice: "blue" },
            selected_values: ["ready", "go"],
          },
        }),
      ),
    ).toEqual({
      kind: "branch",
      sourceId: null,
      targetId: "3",
      conditionId: 1,
      customParameters: null,
      usedDefault: false,
    });
  });

  it("falls back to the first branch when no conditions match", () => {
    const resolveResumeBranch = getResumeResolver();

    expect(
      resolveResumeBranch(
        JSON.stringify({
          branches: [2, 3],
          branchConditions: [
            {
              id: 1,
              nextTrialId: 3,
              rules: [{ column: "response", op: "==", value: "yes" }],
            },
          ],
          trialData: { response: "no" },
        }),
      ),
    ).toEqual({
      kind: "branch",
      sourceId: null,
      targetId: "2",
      conditionId: null,
      customParameters: null,
      usedDefault: true,
    });
  });

  it("stores a versioned resolved route with its custom parameters", () => {
    const createCheckpoint = getResumeCheckpointFactory();
    const checkpoint = createCheckpoint({
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
    });

    expect(checkpoint).toEqual({
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
    expect(getResumeResolver()(JSON.stringify(checkpoint))).toEqual({
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

  it("creates a sequential checkpoint from the compiled address manifest", () => {
    const createCheckpoint = getResumeCheckpointFactoryWithManifest({
      source: "next-trial",
    });

    expect(
      createCheckpoint({ builder_id: "source", trial_index: 2 }),
    ).toEqual({
      version: 1,
      completed: { builderId: "source", trialIndex: 2 },
      route: {
        kind: "sequential",
        targetId: "next-trial",
        conditionId: null,
        customParameters: null,
        usedDefault: false,
      },
    });
  });
});
