import { describe, expect, test } from "@jest/globals";
import { createLoopBranch } from "../../routes/timeline/loopBranching/createLoopBranch.js";

const trial = (id, name, parentLoopId, branches = []) => ({
  id,
  type: "Trial",
  name,
  branches,
  ...(parentLoopId ? { parentLoopId } : {}),
});

describe("sequential loop branch ordering", () => {
  test("places a root target before the route it chains into", () => {
    const source = trial(1, "Source", "inner", [2]);
    const document = {
      trials: [source, trial(2, "Existing exit")],
      loops: [{ id: "inner", name: "Inner", trials: [1], branches: [] }],
      timeline: [
        { id: "inner", type: "loop", name: "Inner" },
        { id: 2, type: "trial", name: "Existing exit" },
      ],
    };

    const result = createLoopBranch(
      document,
      source,
      null,
      "sequential",
      "2026-08-23T00:00:00.000Z",
    );

    expect(result.error).toBeUndefined();
    expect(source.branches).toEqual([result.trial.id]);
    expect(result.trial.branches).toEqual([2]);
    expect(document.timeline.map((item) => item.id)).toEqual([
      "inner",
      result.trial.id,
      2,
    ]);
  });

  test("places an ancestor-scope target before its existing route", () => {
    const source = trial(1, "Source", "inner", [2]);
    const document = {
      trials: [source, trial(2, "Existing exit", "outer")],
      loops: [
        {
          id: "outer",
          name: "Outer",
          trials: ["inner", 2],
          branches: [],
        },
        {
          id: "inner",
          name: "Inner",
          parentLoopId: "outer",
          trials: [1],
          branches: [],
        },
      ],
      timeline: [{ id: "outer", type: "loop", name: "Outer" }],
    };

    const result = createLoopBranch(
      document,
      source,
      "outer",
      "sequential",
      "2026-08-23T00:00:00.000Z",
    );

    const outer = document.loops.find((loop) => loop.id === "outer");
    expect(result.error).toBeUndefined();
    expect(source.branches).toEqual([result.trial.id]);
    expect(result.trial.branches).toEqual([2]);
    expect(outer.trials).toEqual(["inner", result.trial.id, 2]);
  });
});
