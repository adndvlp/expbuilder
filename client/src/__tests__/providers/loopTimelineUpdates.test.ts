import { describe, expect, it } from "vitest";
import {
  getLoopTimelineChanges,
  getLoopTimelineFieldChanges,
  getLoopTimelineSnapshot,
  updateLoopTimeline,
} from "../../pages/ExperimentBuilder/providers/TrialsProvider/loopTimelineUpdates";
import { loop, timelineLoop, timelineTrial } from "../helpers/trialFactories";

describe("loopTimelineUpdates", () => {
  it("ignores saves that cannot change timeline membership or names", () => {
    expect(getLoopTimelineChanges({ repetitions: 4 })).toBeNull();
    expect(getLoopTimelineChanges({ orders: true })).toBeNull();
    expect(getLoopTimelineChanges({ code: "return true;" })).toBeNull();
    expect(getLoopTimelineFieldChanges("branches", [2])).toBeNull();
    expect(getLoopTimelineFieldChanges("branchConditions", [])).toBeNull();
    expect(getLoopTimelineSnapshot(loop({ trials: [1] }))).toEqual({
      name: "Loop loop-1",
      trials: [1],
    });
  });

  it("preserves timeline identity when loop metadata is unchanged", () => {
    const timeline = [
      timelineLoop({ id: "loop-1", name: "Loop", trials: [1] }),
      timelineTrial({ id: 2, name: "Branch" }),
    ];
    const result = updateLoopTimeline(timeline, "loop-1", {
      name: "Loop",
      trials: [1],
    });
    expect(result).toBe(timeline);
    expect(result[0]).toBe(timeline[0]);
  });

  it("updates container membership without changing trial connections", () => {
    const source = timelineTrial({ id: 1, branches: [2] });
    const target = timelineTrial({ id: 2 });
    const timeline = [source, target, timelineLoop({ id: "loop-1" })];
    const result = updateLoopTimeline(timeline, "loop-1", {
      name: "Grouped",
      trials: [2, "nested"],
    });
    expect(result[0]).toBe(source);
    expect(result[1]).toBe(target);
    expect(result[2]).toEqual(
      timelineLoop({ id: "loop-1", name: "Grouped", trials: [2, "nested"] }),
    );
    expect(result[2]).not.toHaveProperty("branches");
  });
});
