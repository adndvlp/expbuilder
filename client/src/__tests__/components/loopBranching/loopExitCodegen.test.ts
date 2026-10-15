import { describe, expect, it, vi } from "vitest";
import generateLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../../helpers/nativeTimelineRuntime";

const payload = { stimulus: { source: "typed", value: "outer payload" } };
const settings = {
  repetitions: 1,
  randomize: false,
  orders: false,
  stimuliOrders: [],
  categories: false,
  categoryData: [],
};

function exitRuntime(target: string, terminalSource = false) {
  const source = nativeTrial(
    1,
    "Source",
    terminalSource
      ? {}
      : {
          branches: [target],
          branchConditions: [
            {
              id: 7,
              rules: [{ column: "response", op: "==", value: "go" }],
              nextTrialId: target,
              customParameters: payload,
            },
          ],
        },
  );
  const later = nativeTrial(
    2,
    "Later Trial",
    terminalSource
      ? {
          branches: [target],
          branchConditions: [
            {
              id: 8,
              rules: [{ column: "response", op: "==", value: "go" }],
              nextTrialId: target,
              customParameters: payload,
            },
          ],
        }
      : {},
  );
  const inner = generateLoopCode({
    ...settings,
    id: "inner",
    parentLoopId: "parent",
    trials: [source, later],
    unifiedStimuli: [{ row: 1 }, { row: 2 }],
  })();
  const parentTarget = nativeTrial("parent-target", "Parent Target");
  const parent = generateLoopCode({
    ...settings,
    id: "parent",
    unifiedStimuli: [{ parentRow: 1 }],
    trials: [
      {
        ...settings,
        isLoop: true,
        loopId: "inner",
        loopName: "Inner",
        timelineProps: inner,
        items: [source, later],
      },
      parentTarget,
    ],
  })();
  const final = nativeTrial("root-target", "Root Target");
  return nativeTimelineRuntime(
    parent + final.timelineProps,
    scopeManifest({
      root: ["parent", "root-target"],
      parent: ["inner", "parent-target"],
      inner: [1, 2],
    }),
  );
}

describe("loop exit code generation", () => {
  it("propagates the exact unresolved target and custom parameters to its parent", async () => {
    const rows = await exitRuntime("parent-target").run();
    expect(rows.map((row) => row.builder_id)).toEqual([
      1,
      "parent-target",
      "root-target",
    ]);
    expect(rows[1].parameters).toEqual(payload);
    expect(rows[1].timeline_variables).toEqual({ parentRow: 1 });
  });

  it("propagates the exact unresolved target to the root timeline", async () => {
    const rows = await exitRuntime("root-target").run();
    expect(rows.map((row) => row.builder_id)).toEqual([1, "root-target"]);
    expect(rows[1].parameters).toEqual(payload);
    expect(rows[1].timeline_variables).toEqual({});
  });

  it("does not erase an unresolved exit at the row boundary", async () => {
    const rows = await exitRuntime("parent-target", true).run();
    expect(rows.map((row) => row.builder_id)).toEqual([
      1,
      2,
      "parent-target",
      "root-target",
    ]);
    expect(rows[2].parameters).toEqual(payload);
  });

  it("clears a resolved same-loop branch before a conditional repeat", async () => {
    const source = nativeTrial(1, "Source", { branches: [2] });
    const target = nativeTrial(2, "Target");
    const skipped = nativeTrial(3, "Skipped");
    const loop = generateLoopCode({
      ...settings,
      id: "inner",
      trials: [source, target, skipped],
      unifiedStimuli: [{}],
      isConditionalLoop: true,
      loopConditions: [
        {
          id: 9,
          rules: [
            { trialId: 1, column: "response", op: "==", value: "repeat" },
          ],
        },
      ],
    })();
    let cycle = 0;
    const fixture = nativeTimelineRuntime(
      loop,
      scopeManifest({ root: ["inner"], inner: [1, 2, 3] }),
      {
        onTrial(data) {
          if (data.builder_id === 1)
            data.response = cycle++ === 0 ? "repeat" : "stop";
        },
      },
    );
    const rows = await fixture.run();
    expect(rows.map((row) => row.builder_id)).toEqual([1, 2, 1, 2]);
    expect(
      rows.filter((row) => row.builder_id === 1).map((row) => row.response),
    ).toEqual(["repeat", "stop"]);
  });

  it("does not reinterpret a reached target as another loop branch", async () => {
    const fixture = exitRuntime("parent-target");
    await fixture.run();
    expect(
      fixture.window.ExpBuilderRuntime.emit.mock.calls.filter(
        ([type]) => type === "branch-decision",
      ),
    ).toHaveLength(1);
  });

  it("does not abort a root exit while its exact target is being propagated", async () => {
    const fixture = exitRuntime("root-target");
    const abort = vi.spyOn(fixture.instance, "abortTimelineByName");
    const rows = await fixture.run();
    expect(rows.at(-1)?.builder_id).toBe("root-target");
    expect(abort).toHaveBeenCalledOnce();
    expect(abort.mock.calls[0][0]).toMatch(/^expbuilder-loop-parent-/);
  });

  it("transfers an exit from a non-terminal source without losing its payload", async () => {
    const rows = await exitRuntime("parent-target").run();
    expect(rows.some((row) => row.builder_id === 2)).toBe(false);
    expect(rows.filter((row) => row.parameters)).toEqual([
      expect.objectContaining({
        builder_id: "parent-target",
        parameters: payload,
      }),
    ]);
  });
});
