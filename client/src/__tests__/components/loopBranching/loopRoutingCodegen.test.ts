import { describe, expect, it } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../../helpers/nativeTimelineRuntime";

const settings = {
  repetitions: 1,
  randomize: false,
  orders: false,
  stimuliOrders: [],
  categories: false,
  categoryData: [],
};
const payload = { stimulus: { source: "typed", value: "nested" } };
function nestedCode(targetName = "Target") {
  return generateLoopCode({
    ...settings,
    id: "outer",
    unifiedStimuli: [{ outerRow: 1 }],
    trials: [
      {
        ...settings,
        isLoop: true,
        loopId: "inner",
        loopName: "Inner",
        unifiedStimuli: [{ innerRow: 1 }],
        items: [
          nativeTrial(41, "Before", { branches: [42], defaultNextTrialId: 42 }),
          nativeTrial(42, targetName, { branches: [43], defaultNextTrialId: 43 }),
          nativeTrial(43, "After", { branches: [20], defaultNextTrialId: 20 }),
        ],
      },
      nativeTrial(20, "Parent Tail", { branches: [99], defaultNextTrialId: 99 }),
    ],
  })();
}
const scopes = () =>
  scopeManifest({
    root: [0, "outer", 99],
    outer: ["inner", 20],
    inner: [41, 42, 43],
  });
const tail = () => nativeTrial(99, "Final").timelineProps;

describe("nested loop route generation", () => {
  it("[TG-07] preserves domain IDs while sanitizing generated names", async () => {
    const manifest = scopes();
    manifest.entries.root = "outer";
    const code = nestedCode("Target / punctuation");
    expect(code).toContain("const Target$20$$2f$$20$punctuation_timeline =");
    const rows = await nativeTimelineRuntime(code + tail(), manifest).run();
    expect(rows.map((row) => row.builder_id)).toEqual([41, 42, 43, 20, 99]);
  });

  it("executes an exact branch target inside a nested loop", async () => {
    const entry = nativeTrial(0, "Entry", {
      branches: [42],
      branchConditions: [
        {
          id: 7,
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: 42,
          customParameters: payload,
        },
      ],
    });
    const fixture = nativeTimelineRuntime(
      entry.timelineProps + nestedCode() + tail(),
      scopes(),
    );
    const rows = await fixture.run();
    expect(rows.map((row) => row.builder_id)).toEqual([0, 42, 43, 20, 99]);
    expect(rows[1].parameters).toEqual(payload);
    expect(rows[1].timeline_variables).toEqual({ outerRow: 1, innerRow: 1 });
    expect(fixture.window.ExpBuilderRuntime.reportError).not.toHaveBeenCalled();
  });

  it("[TJ-06] continues a selected nested destination through its explicit connections", async () => {
    const entry = nativeTrial(0, "Entry", { branches: [42], defaultNextTrialId: 42 });
    const fixture = nativeTimelineRuntime(entry.timelineProps + nestedCode() + tail(), scopes());
    expect((await fixture.run()).map(row => row.builder_id)).toEqual([0, 42, 43, 20, 99]);
    expect(fixture.window.location.reload).not.toHaveBeenCalled();
  });

  it("[TJ-04] restores the selected route through every native ancestor", async () => {
    const manifest = scopes();
    const code = nativeTrial(0, "Entry", { branches: [42], defaultNextTrialId: 42 }).timelineProps + nestedCode() + tail();
    let checkpoint = "";
    const first = nativeTimelineRuntime(code, manifest, { onTrial(data) {
      if (data.builder_id === 42) checkpoint = first.storage.get("jsPsych_resumeTrial")!;
    } });
    await first.run();
    const resumed = nativeTimelineRuntime(code, manifest, { resume: first.resolveCheckpoint(checkpoint)! });
    const rows = await resumed.run();
    expect(rows.map(row => row.builder_id)).toEqual([42, 43, 20, 99]);
    expect(rows[0].timeline_variables).toEqual({ outerRow: 1, innerRow: 1 });
  });
});
