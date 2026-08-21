import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import { getTerminalTrialIds } from "../../../pages/ExperimentBuilder/components/Canvas/features/loop-branching/terminalTrials";

const trial = (
  id: string,
  branches: Array<string | number> = [],
): TimelineItem => ({ id, type: "trial", name: id, branches });

describe("getTerminalTrialIds", () => {
  it("returns the branch origin and every trial in the final branch block", () => {
    const items = [
      trial("intro"),
      trial("question", ["left", "right"]),
      trial("left"),
      trial("right"),
    ];

    expect(getTerminalTrialIds(items)).toEqual(
      new Set(["question", "left", "right"]),
    );
  });

  it("ignores branches whose targets belong to an outer scope", () => {
    const items = [trial("intro"), trial("source", ["outer-target"] )];

    expect(getTerminalTrialIds(items)).toEqual(new Set(["source"]));
  });

  it("keeps the same source eligible after adding a same-scope child", () => {
    const items = [trial("source", ["inside"]), trial("inside")];

    expect(getTerminalTrialIds(items)).toEqual(new Set(["source", "inside"]));
  });
});
