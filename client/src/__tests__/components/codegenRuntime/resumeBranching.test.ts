import { describe, expect, it } from "vitest";
import {
  getResumeResolver,
} from "./testHarness";

describe("resumeCode", () => {
  it("restores an active loop cursor instead of its completed trial's outgoing branch", () => {
    const resolve = getResumeResolver();
    const loops = [{
      loopId: "inner", order: [2, 0, 1], cursor: 1, repetition: 1,
      cycleRows: [], routing: { NextTrialId: null },
    }];
    const checkpoint = {
      version: 3, experimentRevision: "r1",
      completed: { builderId: "source", trialIndex: 5 },
      cursor: { targetId: "active", afterCompleted: false, loops, globalRouting: {} },
      route: { targetId: "outside", kind: "branch" },
    };
    expect(resolve(JSON.stringify(checkpoint))).toMatchObject({
      kind: "cursor", targetId: "active", loops, afterCompleted: false,
    });
    expect(resolve(JSON.stringify({
      ...checkpoint,
      cursor: { ...checkpoint.cursor, loops: [{ ...loops[0], cursor: 3 }] },
    }))).toBeNull();
    expect(resolve(JSON.stringify({
      ...checkpoint,
      cursor: { ...checkpoint.cursor, loops: [{ ...loops[0], order: [0, 0, 1] }] },
    }))).toBeNull();
  });

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

  it.each([1, 2, 4])("rejects checkpoint version %s", version => {
    expect(getResumeResolver()(JSON.stringify({ version, route: { targetId: "selected" } }))).toBeNull();
  });
});
