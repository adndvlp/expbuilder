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
          nativeTrial(41, "Before"),
          nativeTrial(42, targetName),
          nativeTrial(43, "After"),
        ],
      },
      nativeTrial(20, "Parent Tail"),
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
    manifest.scopes.root = ["outer"];
    const code = nestedCode("Target / punctuation");
    expect(code).toContain("const Target$20$$2f$$20$punctuation_timeline =");
    const rows = await nativeTimelineRuntime(code, manifest).run();
    expect(rows.map((row) => row.builder_id)).toEqual([41, 42, 43, 20]);
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
    expect(rows.map((row) => row.builder_id)).toEqual([0, 42]);
    expect(rows[1].parameters).toEqual(payload);
    expect(rows[1].timeline_variables).toEqual({ outerRow: 1, innerRow: 1 });
    expect(fixture.window.ExpBuilderRuntime.reportError).not.toHaveBeenCalled();
  });

  it("[TJ-06] keeps a nested jump separate from exit-branch state", async () => {
    const entry = nativeTrial(0, "Entry", {
      repeatConditions: [
        {
          id: 8,
          jumpToTrialId: 42,
          rules: [{ column: "response", op: "==", value: "go" }],
        },
      ],
    });
    const fixture = nativeTimelineRuntime(
      entry.timelineProps + nestedCode() + tail(),
      scopes(),
    );
    const rows = await fixture.run();
    expect(rows.map((row) => row.builder_id)).toEqual([0, 42, 43, 20, 99]);
    expect(fixture.storage.has("jsPsych_jumpRequest")).toBe(false);
    expect(fixture.window.location.reload).not.toHaveBeenCalled();
    expect(
      fixture.window.ExpBuilderRuntime.emit.mock.calls.filter(
        ([type]) => type === "jump-target-enter",
      ),
    ).toHaveLength(1);
    expect(
      fixture.window.ExpBuilderRuntime.emit.mock.calls.some(
        ([type]) => type === "branch-decision",
      ),
    ).toBe(false);
  });

  it("routes a sequential resume through every nested-loop ancestor", async () => {
    const manifest = scopes();
    manifest.scopes.root = ["outer", "99"];
    const fixture = nativeTimelineRuntime(nestedCode() + tail(), manifest, {
      resume: {
        kind: "sequential",
        sourceId: "source",
        targetId: "42",
        conditionId: null,
      },
    });
    const rows = await fixture.run();
    expect(rows.map((row) => row.builder_id)).toEqual([42, 43, 20, 99]);
    expect(rows[0].timeline_variables).toEqual({ outerRow: 1, innerRow: 1 });
    expect(fixture.storage.has("jsPsych_jumpRequest")).toBe(false);
  });
});
