import { describe, expect, it, vi } from "vitest";
import { getJumpRequestRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/jumpRequest";
import {
  getNavigationCoordinatorRuntimeCode,
  type NavigationStorageKeys,
} from "../../../pages/ExperimentBuilder/modules/experiment-runtime/navigationCoordinator";
import { getPersistenceCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/persistenceCoordinator";

type RuntimeNavigation = {
  requestJump: (
    target: string | number,
    context?: Record<string, unknown>,
    source?: Record<string, unknown>,
    pause?: () => void,
  ) => void;
  onTrialPersisted: (row: Record<string, unknown>) => void;
  isTransitionPending: () => boolean;
  consumeReloadMarker: () => {
    status: string;
    request: Record<string, unknown> | null;
  };
  enterItem: (
    itemId: string | number,
    itemKind: "trial" | "loop",
  ) => boolean | null;
  clearTransientState: () => void;
};

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: unknown) => values.set(key, String(value)),
  };
}

const rootAddress = (targetId: string) => ({
  targetId,
  targetKind: "trial",
  targetOwnerId: null,
  enterLoopIds: [],
});

function createRuntime(
  storageKeys: Partial<NavigationStorageKeys> = {},
) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const reload = vi.fn();
  const emit = vi.fn();
  const window = {
    location: { reload },
    ExpBuilderRuntime: { emit, reportError: vi.fn() },
    ExpBuilderNavigation: undefined as RuntimeNavigation | undefined,
    ExpBuilderPersistence: undefined,
    ExpBuilderJumpProtocol: undefined,
    ExpBuilderExecutionAddresses: {
      version: 2,
      revision: "r1",
      nextBySource: {},
      addressesByTarget: {
        "42": rootAddress("42"),
        target: rootAddress("target"),
        nested: {
          targetId: "nested",
          targetKind: "trial",
          targetOwnerId: "inner",
          enterLoopIds: ["outer", "inner"],
        },
      },
    },
  };
  const execute = new Function(
    "window",
    "localStorage",
    "sessionStorage",
    [
      getPersistenceCoordinatorRuntimeCode(),
      getJumpRequestRuntimeCode(),
      getNavigationCoordinatorRuntimeCode(storageKeys),
    ].join("\n"),
  );
  execute(window, localStorage, sessionStorage);
  return {
    emit,
    localStorage,
    navigation: window.ExpBuilderNavigation!,
    reload,
    sessionStorage,
    window,
  };
}

describe("generated navigation coordinator", () => {
  it("uses scoped storage keys without touching the public fallbacks", () => {
    const storageKeys: NavigationStorageKeys = {
      jumpRequest: "expbuilder:local:experiment-a:jump-request",
      jumpReload: "expbuilder:local:experiment-a:jump-reload",
      resumeTrial: "expbuilder:local:experiment-a:resume-trial",
      jumpTarget: "expbuilder:local:experiment-a:jump-to-trial",
      jumpContext: "expbuilder:local:experiment-a:jump-context",
    };
    const runtime = createRuntime(storageKeys);

    runtime.localStorage.setItem("jsPsych_resumeTrial", "public-resume");
    runtime.localStorage.setItem("jsPsych_jumpToTrial", "public-target");
    runtime.sessionStorage.setItem("jsPsych_jumpContext", "public-context");
    runtime.localStorage.setItem(storageKeys.resumeTrial, "local-resume");
    runtime.localStorage.setItem(storageKeys.jumpTarget, "local-target");
    runtime.sessionStorage.setItem(storageKeys.jumpContext, "local-context");

    runtime.navigation.requestJump(
      "target",
      { sourceId: "source" },
      { builder_id: "source", trial_index: 2 },
    );

    expect(runtime.localStorage.getItem(storageKeys.jumpRequest)).not.toBeNull();
    expect(runtime.sessionStorage.getItem(storageKeys.jumpReload)).toBe("1");
    expect(runtime.localStorage.getItem(storageKeys.jumpTarget)).toBeNull();
    expect(runtime.sessionStorage.getItem(storageKeys.jumpContext)).toBeNull();
    expect(runtime.localStorage.getItem("jsPsych_jumpRequest")).toBeNull();
    expect(runtime.sessionStorage.getItem("jsPsych_jumpReload")).toBeNull();
    expect(runtime.localStorage.getItem("jsPsych_jumpToTrial")).toBe(
      "public-target",
    );
    expect(runtime.sessionStorage.getItem("jsPsych_jumpContext")).toBe(
      "public-context",
    );

    runtime.navigation.clearTransientState();
    expect(runtime.localStorage.getItem(storageKeys.resumeTrial)).toBeNull();
    expect(runtime.localStorage.getItem("jsPsych_resumeTrial")).toBe(
      "public-resume",
    );
  });

  it("reloads only after the triggering trial has persisted", async () => {
    const runtime = createRuntime();
    const pauseRuntime = vi.fn();
    runtime.navigation.requestJump(
      42,
      { conditionId: 7, sourceId: "source", sourceSessionId: "old" },
      { builder_id: "source", trial_index: 3 },
      pauseRuntime,
    );
    expect(pauseRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.navigation.isTransitionPending()).toBe(true);

    runtime.navigation.onTrialPersisted({
      builder_id: "other",
      trial_index: 2,
    });
    expect(runtime.reload).not.toHaveBeenCalled();

    runtime.navigation.onTrialPersisted({
      builder_id: "source",
      trial_index: 3,
    });
    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(runtime.localStorage.getItem("jsPsych_jumpRequest") ?? "{}"),
    ).toMatchObject({
      version: 2,
      experimentRevision: "r1",
      address: { targetId: "42", enterLoopIds: [] },
      sourceId: "source",
      sourceTrialIndex: "3",
      cursor: { nextEnterIndex: 0, progress: 0 },
    });
    expect(runtime.localStorage.getItem("jsPsych_jumpToTrial")).toBeNull();
    expect(runtime.sessionStorage.getItem("jsPsych_jumpReload")).toBe("1");
    expect(runtime.emit).toHaveBeenCalledWith(
      "jump-persisted",
      expect.objectContaining({ targetId: "42" }),
    );
  });

  it("reloads after loop completion follows durable child data", async () => {
    const runtime = createRuntime();
    runtime.navigation.onTrialPersisted({
      builder_id: "child",
      loop_id: "loop-1",
      trial_index: 5,
    });
    runtime.navigation.requestJump(
      "target",
      { sourceId: "loop-1" },
      { loop_id: "loop-1", trial_index: 5 },
    );

    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledTimes(1));
  });

  it("waits for every in-flight save before reloading", async () => {
    const runtime = createRuntime();
    const earlierSave = runtime.window.ExpBuilderPersistence!.start();
    runtime.navigation.requestJump(
      "target",
      { sourceId: "source" },
      { builder_id: "source", trial_index: 2 },
    );
    runtime.navigation.onTrialPersisted({
      builder_id: "source",
      trial_index: 2,
    });

    await Promise.resolve();
    expect(runtime.reload).not.toHaveBeenCalled();
    runtime.window.ExpBuilderPersistence!.finish(earlierSave);
    await vi.waitFor(() => expect(runtime.reload).toHaveBeenCalledTimes(1));
  });

  it("[TJ-08] rejects a reload attempt unless stored cursor progress advanced", () => {
    const runtime = createRuntime();
    runtime.navigation.requestJump(
      "nested",
      { sourceId: "source" },
      { builder_id: "source", trial_index: 2 },
    );

    expect(runtime.navigation.consumeReloadMarker().status).toBe("ready");
    expect(runtime.navigation.enterItem("outer", "loop")).toBe(true);
    expect(runtime.navigation.consumeReloadMarker()).toMatchObject({
      status: "active",
      request: {
        cursor: { nextEnterIndex: 0, progress: 1 },
        reloadGuard: { observedProgress: 1 },
      },
    });
    expect(runtime.navigation.consumeReloadMarker()).toEqual({
      status: "stalled",
      request: null,
    });
    expect(runtime.localStorage.getItem("jsPsych_jumpRequest")).toBeNull();
    expect(runtime.emit).toHaveBeenCalledWith(
      "jump-invalidated",
      expect.objectContaining({ reason: "JUMP_STALLED" }),
    );
  });
});
