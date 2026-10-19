import { describe, expect, it, vi } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../../helpers/nativeTimelineRuntime";

function createRuntime(conditional = false) {
  const entry = nativeTrial(0, "Entry", { branches: [1] });
  const source = nativeTrial(1, "Source", {
    branches: [2],
    branchConditions: conditional
      ? [
          {
            id: 10,
            rules: [{ column: "response", op: "==", value: "exit" }],
            nextTrialId: 2,
          },
        ]
      : [],
  });
  const final = nativeTrial(2, "Final");
  const loop = generateLoopCode({
    id: "rows",
    repetitions: 2,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    unifiedStimuli: [{ row: 1 }, { row: 2 }, { row: 3 }],
    trials: [source],
  })();
  return nativeTimelineRuntime(
    entry.timelineProps + loop + final.timelineProps,
    scopeManifest({ root: [0, "rows", 2], rows: [1] }),
    { response: "exit" },
  );
}

describe("default continuation through CSV loops", () => {
  it("executes every row and repetition before following its last trial's default exit", async () => {
    const runtime = createRuntime();
    const abort = vi.spyOn(runtime.instance, "abortTimelineByName");
    const rows = await runtime.run();
    expect(rows.map((row) => row.builder_id)).toEqual([0, 1, 1, 1, 1, 1, 1, 2]);
    expect(
      rows
        .filter((row) => row.builder_id === 1)
        .map((row) => row.timeline_variables),
    ).toEqual([1, 2, 3, 1, 2, 3].map((row) => ({ row })));
    expect(abort).not.toHaveBeenCalled();
  });

  it("still leaves the loop immediately when its trial selects a conditional exit", async () => {
    const runtime = createRuntime(true);
    const abort = vi.spyOn(runtime.instance, "abortTimelineByName");
    const rows = await runtime.run();
    expect(rows.map((row) => row.builder_id)).toEqual([0, 1, 2]);
    expect(rows[1].timeline_variables).toEqual({ row: 1 });
    expect(abort).toHaveBeenCalledOnce();
  });
});
