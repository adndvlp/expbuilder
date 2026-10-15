import { describe, expect, it, vi } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../../helpers/nativeTimelineRuntime";

async function runLoop(fields: {
  branches: (string | number)[];
  branchConditions?: unknown[];
}) {
  const code = generateLoopCode({
    ...fields,
    id: "csv-loop",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    trials: [nativeTrial(1, "Source")],
    unifiedStimuli: [
      { stimulus: "row-1" },
      { stimulus: "row-2" },
      { stimulus: "row-3" },
    ],
  })();
  const fixture = nativeTimelineRuntime(
    code,
    scopeManifest({ root: ["csv-loop"], "csv-loop": [1] }),
  );
  const abort = vi.spyOn(fixture.instance, "abortTimelineByName");
  const rows = await fixture.run();
  expect(rows.map((row) => row.builder_id)).toEqual([1, 1, 1]);
  expect(rows.map((row) => row.timeline_variables)).toEqual(
    ["row-1", "row-2", "row-3"].map((stimulus) => ({ stimulus })),
  );
  expect(abort).not.toHaveBeenCalled();
  expect(
    fixture.window.ExpBuilderRuntime.emit.mock.calls.some(
      ([type]) => type === "branch-decision",
    ),
  ).toBe(false);
}

describe("legacy loop fields cannot decide CSV routing", () => {
  it("ignores legacy loop branch targets when its CSV procedure finishes", async () => {
    await runLoop({ branches: [999] });
  });

  it("ignores legacy loop branch conditions entirely (branches belong to trials)", async () => {
    await runLoop({
      branches: [999],
      branchConditions: [
        {
          id: "exit-condition",
          rules: [{ column: "loop_id", op: "==", value: "csv-loop" }],
          nextTrialId: 999,
          customParameters: { stimulus: { source: "typed", value: "x" } },
        },
      ],
    });
  });
});
