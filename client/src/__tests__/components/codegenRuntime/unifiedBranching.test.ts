import { describe, expect, it, vi } from "vitest";
import useLoopCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import {
  nativeTimelineRuntime,
  nativeTrial,
  scopeManifest,
} from "../../helpers/nativeTimelineRuntime";

const loop = (
  id: string,
  trials: Parameters<typeof useLoopCode>[0]["trials"],
  parentLoopId?: string,
  repetitions = 1,
) => ({
  isLoop: true as const,
  loopId: id,
  loopName: id,
  items: trials,
  timelineProps: useLoopCode({
    id,
    trials,
    parentLoopId,
    repetitions,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    categories: false,
    categoryData: [],
    unifiedStimuli: [{ value: "row-1" }, { value: "row-2" }],
  })(),
});

describe("explicit branching contract", () => {
  it("follows a shared terminal without executing a later stored trial", async () => {
    const manifest = scopeManifest({ root: [1, 2, 3, 4, 5] });
    manifest.entries = { root: "1" };
    const trials = [
      nativeTrial(1, "Start", { branches: [2, 4], defaultNextTrialId: 4 }),
      nativeTrial(2, "Yes", { branches: [3], defaultNextTrialId: 3 }),
      nativeTrial(3, "Shared", { defaultNextTrialId: null }),
      nativeTrial(4, "No", { branches: [3], defaultNextTrialId: 3 }),
      nativeTrial(5, "Unrelated"),
    ];
    const runtime = nativeTimelineRuntime(
      trials.map((trial) => trial.timelineProps).join("\n"),
      manifest,
    );
    expect((await runtime.run()).map((row) => row.builder_id)).toEqual([
      1, 4, 3,
    ]);
  });

  it("can revisit itself and an earlier trial through the same contract", async () => {
    const parameters = { stimulus: { source: "typed", value: "again" } };
    const a = nativeTrial(1, "A", {
      branches: [1, 2],
      defaultNextTrialId: 2,
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "repeat" }],
          nextTrialId: 1,
          customParameters: parameters,
        },
      ],
    });
    const b = nativeTrial(2, "B", {
      branches: [1],
      defaultNextTrialId: null,
      branchConditions: [
        {
          id: 2,
          rules: [{ column: "response", op: "==", value: "repeat" }],
          nextTrialId: 1,
        },
      ],
    });
    let aVisits = 0;
    let bVisits = 0;
    const runtime = nativeTimelineRuntime(
      a.timelineProps + b.timelineProps,
      scopeManifest({ root: [1, 2] }),
      {
        onTrial(data) {
          data.response =
            data.builder_id === 1
              ? ++aVisits === 1
                ? "repeat"
                : "stop"
              : ++bVisits === 1
                ? "repeat"
                : "stop";
        },
      },
    );
    const rows = await runtime.run();
    expect(rows.map((row) => row.builder_id)).toEqual([1, 1, 2, 1, 2]);
    expect(rows.map((row) => row.parameters)).toEqual([
      null,
      parameters,
      null,
      null,
      null,
    ]);
  });

  it("waits for durable writes before entering any selected destination", async () => {
    const source = nativeTrial(1, "Source", {
      branches: [2],
      defaultNextTrialId: 2,
    });
    const target = nativeTrial(2, "Target");
    const entered: unknown[] = [];
    const runtime = nativeTimelineRuntime(
      source.timelineProps + target.timelineProps,
      scopeManifest({ root: [1, 2] }),
      {
        onTrial(data) {
          entered.push(data.builder_id);
        },
      },
    );
    const token = runtime.window.ExpBuilderPersistence.start();
    const running = runtime.run();
    await vi.waitFor(() => expect(entered).toEqual([1]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(entered).toEqual([1]);
    runtime.window.ExpBuilderPersistence.finish(token);
    await running;
    expect(entered).toEqual([1, 2]);
    expect(runtime.window.location.reload).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "keeps CSV rows and repetitions for a default exit; a matched exit is immediate (%s)",
    async (conditional) => {
      const source = nativeTrial(1, "Source", {
        branches: [2],
        defaultNextTrialId: conditional ? null : 2,
        branchConditions: conditional
          ? [{ id: 1, rules: [], nextTrialId: 2 }]
          : [],
      });
      const container = loop("rows", [source], undefined, 2);
      const target = nativeTrial(2, "Target");
      const runtime = nativeTimelineRuntime(
        container.timelineProps + target.timelineProps,
        scopeManifest({ root: ["rows", 2], rows: [1] }),
      );
      expect((await runtime.run()).map((row) => row.builder_id)).toEqual(
        conditional ? [1, 2] : [1, 1, 1, 1, 2],
      );
    },
  );

  it("does not carry a deferred exit from an earlier CSV row", async () => {
    const source = nativeTrial(1, "Choose", {
      branches: [2, 3],
      defaultNextTrialId: 3,
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "first" }],
          nextTrialId: 2,
        },
      ],
    });
    const exit = nativeTrial(2, "Exit", {
      branches: [4],
      defaultNextTrialId: 4,
    });
    const terminal = nativeTrial(3, "Terminal");
    const code =
      loop("rows", [source, exit, terminal]).timelineProps +
      nativeTrial(4, "Old Exit").timelineProps +
      nativeTrial(5, "Continuation").timelineProps;
    const manifest = scopeManifest({ root: ["rows", 4, 5], rows: [1, 2, 3] });
    manifest.loopContinuations.rows = "5";
    let visits = 0;
    const runtime = nativeTimelineRuntime(code, manifest, {
      onTrial(data) {
        if (data.builder_id === 1)
          data.response = ++visits === 1 ? "first" : "last";
      },
    });
    expect((await runtime.run()).map((row) => row.builder_id)).toEqual([
      1, 2, 1, 3, 5,
    ]);
  });

  it("retains an ancestor's CSV iteration when a descendant selects it", async () => {
    const source = nativeTrial(1, "Source", {
      branches: [3],
      defaultNextTrialId: null,
      branchConditions: [{ id: 1, rules: [], nextTrialId: 3 }],
    });
    const abandoned = nativeTrial(2, "Abandoned");
    const parent = nativeTrial(3, "Parent");
    const inner = loop("inner", [source, abandoned], "outer");
    const outer = loop("outer", [inner, parent]);
    const runtime = nativeTimelineRuntime(
      outer.timelineProps,
      scopeManifest({ root: ["outer"], outer: ["inner", 3], inner: [1, 2] }),
    );
    expect((await runtime.run()).map((row) => row.builder_id)).toEqual([
      1, 3, 1, 3,
    ]);
  });

  it.each([1, 2, 3, 8])(
    "exits %i nested loop levels through the same operation",
    async (depth) => {
      const source = nativeTrial(1, "Deep Source", {
        branches: [2],
        defaultNextTrialId: null,
        branchConditions: [{ id: 1, rules: [], nextTrialId: 2 }],
      });
      let child: typeof source | ReturnType<typeof loop> = source;
      const scopes: Record<string, (string | number)[]> = {
        root: ["level0", 2],
      };
      for (let index = depth - 1; index >= 0; index--) {
        const id = "level" + index;
        scopes[id] = [index === depth - 1 ? 1 : "level" + (index + 1)];
        child = loop(
          id,
          [child],
          index === 0 ? undefined : "level" + (index - 1),
        );
      }
      const runtime = nativeTimelineRuntime(
        child.timelineProps + nativeTrial(2, "Root Target").timelineProps,
        scopeManifest(scopes),
      );
      expect((await runtime.run()).map((row) => row.builder_id)).toEqual([
        1, 2,
      ]);
    },
  );

  it("restores a pending destination and parameters without reevaluating its source", async () => {
    const source = nativeTrial(1, "Source", {
      branches: [2],
      defaultNextTrialId: null,
      branchConditions: [
        {
          id: 1,
          rules: [],
          nextTrialId: 2,
          customParameters: { stimulus: { source: "typed", value: "saved" } },
        },
      ],
    });
    const target = nativeTrial(2, "Target");
    const code = source.timelineProps + target.timelineProps;
    const manifest = scopeManifest({ root: [1, 2] });
    let checkpoint = "";
    const first = nativeTimelineRuntime(code, manifest, {
      onTrial(data) {
        if (data.builder_id === 2)
          checkpoint = first.storage.get("jsPsych_resumeTrial")!;
      },
    });
    await first.run();
    const resume = first.resolveCheckpoint(checkpoint)!;
    const restored = nativeTimelineRuntime(code, manifest, { resume });
    const rows = await restored.run();
    expect(rows.map((row) => row.builder_id)).toEqual([2]);
    expect(rows[0].parameters).toEqual({
      stimulus: { source: "typed", value: "saved" },
    });
  });

  it("restores explicit completion without resurrecting an exited loop", async () => {
    const source = nativeTrial(1, "Finish", {
      branchConditions: [
        { id: 1, rules: [], nextTrialId: "FINISH_EXPERIMENT" },
      ],
    });
    const code =
      loop("rows", [source]).timelineProps +
      nativeTrial(2, "Unrelated").timelineProps;
    const manifest = scopeManifest({ root: ["rows", 2], rows: [1] });
    const first = nativeTimelineRuntime(code, manifest);
    expect((await first.run()).map((row) => row.builder_id)).toEqual([1]);
    const saved = first.resolveCheckpoint(
      first.storage.get("jsPsych_resumeTrial")!,
    )!;
    expect(saved).toMatchObject({
      targetId: "FINISH_EXPERIMENT",
      loops: [],
      globalRouting: { nativeTimeline: { index: 1 } },
    });
    expect(
      await nativeTimelineRuntime(code, manifest, { resume: saved }).run(),
    ).toEqual([]);
  });
});
