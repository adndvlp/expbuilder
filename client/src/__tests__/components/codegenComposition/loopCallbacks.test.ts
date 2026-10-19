import { describe, expect, it } from "vitest";
import useLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";

describe("loop lifecycle", () => {
  it("preserves custom callbacks, repetition count and the explicit entry", () => {
    const code = useLoopCode({
      id: "rows",
      entryItemId: 1,
      nextItemId: 2,
      repetitions: 3,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      unifiedStimuli: [{ x: 1 }],
      trials: [],
      customOnTimelineStart: "window.started = true;",
      customOnTimelineFinish: "window.finished = true;",
    })();
    expect(code).toContain("window.started = true");
    expect(code).toContain("window.finished = true");
    expect(code).toContain('remainingLoopRepetitions("rows", 3)');
    expect(code).toContain('{"entryItemId":1,"nextItemId":2}');
  });
});
