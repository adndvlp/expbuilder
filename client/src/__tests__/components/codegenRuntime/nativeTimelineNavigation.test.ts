import { describe, expect, it, vi } from "vitest";
import { resumeCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode";

type Row = Record<string, unknown>;
type NativeNode = {
  timeline: NativeNode[];
  data: { builder_id: string };
  name: string;
  on_timeline_start(): void;
  on_timeline_finish(): void;
};
type Navigation = {
  registerTrial(id: string, node: Row): void;
  registerLoop(id: string, node: Row): void;
  attach(instance: Row, timeline: NativeNode[]): void;
  attachPreview(instance: Row, timeline: NativeNode[]): void;
  sampleLoop(id: string, order: number[], randomize: boolean, conditional: boolean): void;
  requestBranch(data: Row, decision: Row): void;
  requestJump(target: string, context: Row, data: Row): void;
  onTrialPersisted(data: Row): void;
  completeTrial(data: Row, merge: boolean): void;
  takeParameters(id: string): Row | null;
  clearTransientState(): void;
  checkpointTrialComplete(data: Row, fallback: Row): {
    cursor: { targetId: string; afterCompleted: boolean; loops: unknown[]; globalRouting: { nativeTimeline: { index: number } } };
  };
};

function runtime() {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  const window = {
    ExpBuilderNavigation: undefined as unknown as Navigation,
    ExpBuilderPersistence: undefined as unknown as { start(): number; finish(token: number): void },
    location: { reload: vi.fn() },
    ExpBuilderRuntime: { emit: vi.fn(), reportError: vi.fn() },
    ExpBuilderExecutionAddresses: {
      version: 2, revision: "r1", nextBySource: {},
      scopes: { root: ["outer", "final"], outer: ["inner", "parent"], inner: ["source", "target"] },
      mergePointIds: [],
      allScopes: undefined as Record<string, string[]> | undefined,
      addressesByTarget: Object.fromEntries([
        ["outer", "loop", null, []], ["inner", "loop", "outer", ["outer"]],
        ["source", "trial", "inner", ["outer", "inner"]],
        ["target", "trial", "inner", ["outer", "inner"]],
        ["parent", "trial", "outer", ["outer"]], ["final", "trial", null, []],
      ].map(([targetId, targetKind, targetOwnerId, enterLoopIds]) => [targetId, { targetId, targetKind, targetOwnerId, enterLoopIds }])),
    },
  };
  new Function("window", "localStorage", "sessionStorage", resumeCode())(window, localStorage, localStorage);
  const nav = window.ExpBuilderNavigation;
  const jsPsych = { abortTimelineByName: vi.fn(), pauseExperiment: vi.fn(), resumeExperiment: vi.fn() };
  for (const id of ["source", "target", "parent", "final"]) nav.registerTrial(id, { type: "test", data: { builder_id: id } });
  for (const id of ["inner", "outer"]) nav.registerLoop(id, { timeline_variables: [{ row: 1 }, { row: 2 }], repetitions: 3 });
  const timeline: NativeNode[] = [];
  nav.attach(jsPsych, timeline);
  const root = timeline[0];
  root.on_timeline_start();
  const outerEntry = root.timeline[0];
  outerEntry.on_timeline_start();
  const outer = outerEntry.timeline[0];
  nav.sampleLoop("outer", [0, 1], false, false);
  outer.on_timeline_start();
  const outerRow = outer.timeline[0];
  outerRow.on_timeline_start();
  const innerEntry = outerRow.timeline[0];
  innerEntry.on_timeline_start();
  const inner = innerEntry.timeline[0];
  nav.sampleLoop("inner", [0, 1], false, false);
  inner.on_timeline_start();
  const innerRow = inner.timeline[0];
  innerRow.on_timeline_start();
  innerRow.timeline[0].on_timeline_start();
  return { window, nav, jsPsych, root, outer, outerRow, inner, innerRow };
}

describe("native timeline navigation", () => {
  it("aborts the child loop by name and inserts the target in the parent's future queue", () => {
    const r = runtime();
    r.nav.requestBranch({ builder_id: "source", trial_index: 0 }, { targetId: "parent", usedDefault: false });
    expect(r.jsPsych.abortTimelineByName).toHaveBeenCalledWith(r.inner.name);
    expect(r.outerRow.timeline).toHaveLength(2);
    expect(r.outerRow.timeline[1].timeline[0].data.builder_id).toBe("parent");
    expect(r.jsPsych.abortTimelineByName).not.toHaveBeenCalledWith(r.outer.name);
  });

  it("cuts all exited descendants when branching to the main timeline", () => {
    const r = runtime();
    r.nav.requestBranch({ builder_id: "source" }, { targetId: "final", usedDefault: false });
    expect(r.jsPsych.abortTimelineByName).toHaveBeenCalledWith(r.outer.name);
    expect(r.root.timeline[1].timeline[0].data.builder_id).toBe("final");
    const checkpoint = r.nav.checkpointTrialComplete({ builder_id: "final" }, { completed: null });
    expect(checkpoint.cursor.loops).toEqual([]);
  });

  it("keeps the active CSV scope for a backward jump and waits for durable source data without reloading", async () => {
    const r = runtime();
    r.nav.requestJump("source", { sourceId: "source" }, { builder_id: "source", trial_index: 3 });
    expect(r.jsPsych.pauseExperiment).toHaveBeenCalledOnce();
    expect(r.innerRow.timeline).toHaveLength(2);
    const token = r.window.ExpBuilderPersistence.start();
    r.nav.onTrialPersisted({ builder_id: "source", trial_index: 3 });
    await Promise.resolve();
    expect(r.jsPsych.resumeExperiment).not.toHaveBeenCalled();
    r.window.ExpBuilderPersistence.finish(token);
    await vi.waitFor(() => expect(r.jsPsych.resumeExperiment).toHaveBeenCalledOnce());
    expect(r.innerRow.timeline[1].timeline[0].data.builder_id).toBe("source");
    expect(r.jsPsych.abortTimelineByName).not.toHaveBeenCalled();
    expect(r.window.location.reload).not.toHaveBeenCalled();
  });

  it("defers an ordinary last-item exit until the entire loop finishes", () => {
    const r = runtime();
    r.innerRow.timeline[1].on_timeline_start();
    r.nav.requestBranch({ builder_id: "target" }, { targetId: "parent", usedDefault: true, conditionId: null });
    expect(r.jsPsych.abortTimelineByName).not.toHaveBeenCalled();
    r.innerRow.on_timeline_finish();
    expect(r.jsPsych.abortTimelineByName).not.toHaveBeenCalled();
    r.inner.on_timeline_finish();
    expect(r.outerRow.timeline[1].timeline[0].data.builder_id).toBe("parent");
  });

  it("continues after a merge destination excluded from the initial root queue", () => {
    const r = runtime();
    r.window.ExpBuilderExecutionAddresses.scopes.root = ["outer"];
    r.window.ExpBuilderExecutionAddresses.allScopes = { root: ["outer", "final"] };
    r.nav.requestBranch({ builder_id: "source" }, { targetId: "final", usedDefault: false });
    r.root.timeline[1].on_timeline_start();
    r.nav.completeTrial({ builder_id: "final" }, true);
    expect(r.root.timeline).toHaveLength(2);
  });

  it("preserves the route's exit scope when a destination branches again inside a new loop", () => {
    const r = runtime();
    r.nav.requestBranch({ builder_id: "source" }, { targetId: "parent", usedDefault: false });
    r.outerRow.timeline[1].on_timeline_start();
    const parameters = { stimulus: { source: "typed", value: "selected" } };
    r.nav.requestBranch({ builder_id: "parent" }, { targetId: "target", usedDefault: false, customParameters: parameters });
    const entry = r.outerRow.timeline[2];
    entry.on_timeline_start();
    const loop = entry.timeline[0];
    r.nav.sampleLoop("inner", [0, 1], false, false);
    loop.on_timeline_start();
    const row = loop.timeline[0];
    row.on_timeline_start();
    row.timeline[0].on_timeline_start();
    expect(r.nav.takeParameters("target")).toEqual(parameters);
    expect(r.nav.takeParameters("target")).toBeNull();
    r.jsPsych.abortTimelineByName.mockClear();
    r.nav.requestBranch({ builder_id: "target" }, { targetId: "source", usedDefault: false });
    row.timeline[1].on_timeline_start();
    r.nav.completeTrial({ builder_id: "source" }, false);
    expect(r.jsPsych.abortTimelineByName).toHaveBeenCalledWith(loop.name);
  });

  it("checkpoints the selected future route after a cross-scope response", () => {
    const r = runtime();
    const data = { builder_id: "source", trial_index: 2 };
    r.nav.requestBranch(data, { targetId: "final", usedDefault: false });
    const checkpoint = r.nav.checkpointTrialComplete(data, { completed: { builderId: "source" } });
    expect(checkpoint.cursor).toMatchObject({ targetId: "final", afterCompleted: false, loops: [] });
    expect(checkpoint.cursor.globalRouting.nativeTimeline.index).toBe(1);
  });

  it("uses the same coordinator in a selected preview and confines it to the compiled selection", () => {
    const r = runtime();
    const source = { type: "test", data: { builder_id: "source" } };
    r.nav.clearTransientState();
    r.nav.registerTrial("source", source);
    const timeline = [source] as unknown as NativeNode[];
    r.nav.attachPreview(r.jsPsych, timeline);
    timeline[0].on_timeline_start();
    timeline[0].timeline[0].on_timeline_start();
    expect(() => r.nav.requestBranch({ builder_id: "source" }, { targetId: "outside-preview" })).not.toThrow();
    expect(timeline[0].timeline).toHaveLength(1);
  });

  it("handles a second jump requested while the preceding durability barrier is completing", async () => {
    const r = runtime();
    r.jsPsych.resumeExperiment.mockImplementationOnce(() => {
      const data = { builder_id: "source", trial_index: 4 };
      r.nav.requestJump("target", { sourceId: "source" }, data);
      r.nav.onTrialPersisted(data);
    });
    const data = { builder_id: "source", trial_index: 3 };
    r.nav.requestJump("source", { sourceId: "source" }, data);
    r.nav.onTrialPersisted(data);
    await vi.waitFor(() => expect(r.jsPsych.resumeExperiment).toHaveBeenCalledTimes(2));
    expect(r.window.location.reload).not.toHaveBeenCalled();
  });
});
