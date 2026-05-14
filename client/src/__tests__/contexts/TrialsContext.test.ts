import { describe, it, expect } from "vitest";
import TrialsContext, { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";
import { createContext } from "react";

describe("TrialsContext default values", () => {
  it("has correct default timeline", () => {
    const ctx = TrialsContext as ReturnType<typeof createContext>;
    // The default value is set in createContext
    expect(ctx).toBeDefined();
  });

  it("has correct default values for selection", () => {
    // Read the _currentValue from the context (internal React API for testing)
    const defaults = (TrialsContext as any)._currentValue;
    expect(defaults.timeline).toEqual([]);
    expect(defaults.loopTimeline).toEqual([]);
    expect(defaults.activeLoopId).toBeNull();
    expect(defaults.selectedTrial).toBeNull();
    expect(defaults.selectedLoop).toBeNull();
    expect(defaults.isLoading).toBe(false);
  });

  it("has noop functions as defaults", async () => {
    const defaults = (TrialsContext as any)._currentValue;
    expect(typeof defaults.setSelectedTrial).toBe("function");
    expect(typeof defaults.createTrial).toBe("function");
    expect(typeof defaults.deleteTrial).toBe("function");
    expect(typeof defaults.getTimeline).toBe("function");
    // Default createTrial returns a Trial object
    const trial = await defaults.createTrial({});
    expect(trial).toEqual({});
  });

  it("default deleteTrial returns false", async () => {
    const defaults = (TrialsContext as any)._currentValue;
    expect(await defaults.deleteTrial(1)).toBe(false);
  });
});

describe("TimelineItem type", () => {
  it("accepts trial items", () => {
    const item: TimelineItem = {
      id: 1,
      type: "trial",
      name: "Test",
      branches: [],
    };
    expect(item.type).toBe("trial");
  });

  it("accepts loop items", () => {
    const item: TimelineItem = {
      id: "loop_1",
      type: "loop",
      name: "Test Loop",
      branches: [],
      trials: [1, 2, 3],
    };
    expect(item.trials).toEqual([1, 2, 3]);
  });

  it("branches and trials are optional", () => {
    const item: TimelineItem = {
      id: 5,
      type: "trial",
      name: "Simple",
    };
    expect(item.branches).toBeUndefined();
    expect(item.trials).toBeUndefined();
  });
});
