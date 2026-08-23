import { describe, expect, it, vi } from "vitest";
import { getNavigationCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/navigationCoordinator";
import { getPersistenceCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/persistenceCoordinator";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: unknown) => values.set(key, String(value)),
  };
}

function createRuntime() {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const reload = vi.fn();
  const emit = vi.fn();
  const window = {
    location: { reload },
    ExpBuilderRuntime: { emit },
    ExpBuilderNavigation: undefined,
    ExpBuilderPersistence: undefined,
  };
  const execute = new Function(
    "window",
    "localStorage",
    "sessionStorage",
    `${getPersistenceCoordinatorRuntimeCode()}\n${getNavigationCoordinatorRuntimeCode()}`,
  );
  execute(window, localStorage, sessionStorage);
  return { emit, localStorage, reload, sessionStorage, window };
}

describe("generated navigation coordinator", () => {
  it("reloads only after the triggering trial has persisted", async () => {
    const runtime = createRuntime();
    const pauseRuntime = vi.fn();
    runtime.window.ExpBuilderNavigation!.requestJump(
      42,
      { conditionId: 7, sourceId: "source", sourceSessionId: "old" },
      { builder_id: "source", trial_index: 3 },
      pauseRuntime,
    );
    expect(pauseRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.window.ExpBuilderNavigation!.isTransitionPending()).toBe(
      true,
    );

    runtime.window.ExpBuilderNavigation!.onTrialPersisted({
      builder_id: "other",
      trial_index: 2,
    });
    expect(runtime.reload).not.toHaveBeenCalled();

    runtime.window.ExpBuilderNavigation!.onTrialPersisted({
      builder_id: "source",
      trial_index: 3,
    });
    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledTimes(1));
    expect(runtime.localStorage.getItem("jsPsych_jumpToTrial")).toBe("42");
    expect(runtime.sessionStorage.getItem("jsPsych_jumpReload")).toBe("1");
    expect(runtime.emit).toHaveBeenCalledWith(
      "jump-persisted",
      expect.objectContaining({ targetId: "42" }),
    );
  });

  it("reloads after loop completion follows durable child data", async () => {
    const runtime = createRuntime();
    runtime.window.ExpBuilderNavigation!.onTrialPersisted({
      builder_id: "child",
      loop_id: "loop-1",
      trial_index: 5,
    });
    runtime.window.ExpBuilderNavigation!.requestJump(
      "target",
      { sourceId: "loop-1" },
      { loop_id: "loop-1", trial_index: 5 },
    );

    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledTimes(1));
  });

  it("waits for every in-flight save before reloading", async () => {
    const runtime = createRuntime();
    const earlierSave = runtime.window.ExpBuilderPersistence!.start();
    runtime.window.ExpBuilderNavigation!.requestJump(
      "target",
      { sourceId: "source" },
      { builder_id: "source", trial_index: 2 },
    );
    runtime.window.ExpBuilderNavigation!.onTrialPersisted({
      builder_id: "source",
      trial_index: 2,
    });

    await Promise.resolve();
    expect(runtime.reload).not.toHaveBeenCalled();
    runtime.window.ExpBuilderPersistence!.finish(earlierSave);
    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledTimes(1));
  });
});
