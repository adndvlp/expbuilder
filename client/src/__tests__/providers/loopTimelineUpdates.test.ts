import { describe, expect, it } from "vitest";
import {
  getLoopTimelineChanges,
  updateLoopTimeline,
} from "../../pages/ExperimentBuilder/providers/TrialsProvider/loopTimelineUpdates";
import { timelineLoop, timelineTrial } from "../helpers/trialFactories";

describe("loopTimelineUpdates", () => {
  it("ignores loop saves that cannot change the rendered timeline", () => {
    expect(getLoopTimelineChanges({ repetitions: 4 })).toBeNull();
    expect(getLoopTimelineChanges({ orders: true })).toBeNull();
    expect(getLoopTimelineChanges({ code: "return true;" })).toBeNull();
  });

  it("preserves timeline identity when loop metadata is unchanged", () => {
    const timeline = [
      timelineLoop({
        id: "loop-1",
        name: "Loop",
        branches: [2],
        trials: [1],
      }),
      timelineTrial({ id: 2, name: "Branch" }),
    ];

    const result = updateLoopTimeline(timeline, "loop-1", {
      name: "Loop",
      branches: [2],
      trials: [1],
    });

    expect(result).toBe(timeline);
    expect(result[0]).toBe(timeline[0]);
  });

  it("adds a missing nested-loop branch with its real item shape", () => {
    const timeline = [timelineLoop({ id: "loop-1", name: "Loop" })];

    const result = updateLoopTimeline(
      timeline,
      "loop-1",
      { branches: ["nested"] },
      {
        id: "nested",
        name: "Nested",
        branches: null,
        trials: null,
      },
    );

    expect(result).toEqual([
      timelineLoop({
        id: "loop-1",
        name: "Loop",
        branches: ["nested"],
      }),
      timelineLoop({
        id: "nested",
        name: "Nested",
        branches: [],
        trials: [],
      }),
    ]);
  });
});
