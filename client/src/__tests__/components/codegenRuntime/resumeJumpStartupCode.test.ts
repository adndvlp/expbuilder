import { describe, expect, it, vi } from "vitest";
import {
  activateResumeRouteDecisionCode,
  resumeJumpStartupCode,
} from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/resumeJumpStartupCode";
import {
  createJumpRequest,
  getJumpRequestRuntimeCode,
  type ExecutionAddress,
} from "../../../pages/ExperimentBuilder/modules/experiment-runtime/jumpRequest";
import { getNavigationCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/navigationCoordinator";
import { getPersistenceCoordinatorRuntimeCode } from "../../../pages/ExperimentBuilder/modules/experiment-runtime/persistenceCoordinator";

type ResumeBranchDecision = {
  kind: "branch" | "sequential";
  sourceId: string | number | null;
  targetId: string;
  conditionId: string | number | null;
  customParameters: Record<string, unknown> | null;
  usedDefault: boolean;
};

type MemoryStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: unknown) => void;
};

function createStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const address = (targetId: string): ExecutionAddress => ({
  targetId,
  targetKind: "trial",
  targetOwnerId: null,
  enterLoopIds: [],
});

function executeStartup(options: {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  isResuming: boolean;
  resolveResumeBranch: (raw: string) => ResumeBranchDecision | null;
  emit?: (type: string, payload: Record<string, unknown>) => void;
}) {
  const runtimeCode = `
    let isResuming = initialIsResuming;
    let trialSessionId = 'existing-session';
    const crypto = { randomUUID: () => 'fresh-session' };
    const _generateSessionName = () => null;
    const window = {
      location: { reload: () => undefined },
      ExpBuilderRuntime: {
        emit,
        reportError: () => undefined
      },
      ExpBuilderExecutionAddresses: {
        version: 2,
        revision: 'revision-1',
        nextBySource: {},
        addressesByTarget: {
          '42': ${JSON.stringify(address("42"))},
          'nested-target': ${JSON.stringify(address("nested-target"))},
          'second': ${JSON.stringify(address("second"))}
        }
      }
    };
    ${getPersistenceCoordinatorRuntimeCode()}
    ${getJumpRequestRuntimeCode()}
    ${getNavigationCoordinatorRuntimeCode()}
    ${resumeJumpStartupCode()}
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null;
    ${activateResumeRouteDecisionCode()}
    return {
      isResuming,
      trialSessionId,
      enter: (id, kind) => window.ExpBuilderNavigation.enterItem(id, kind),
      branchState: {
        nextTrialId: window.nextTrialId,
        skipRemaining: window.skipRemaining,
        branchingActive: window.branchingActive,
        customParameters: window.branchCustomParameters
      }
    };
  `;
  const execute = new Function(
    "localStorage",
    "sessionStorage",
    "initialIsResuming",
    "_resolveResumeBranch",
    "emit",
    runtimeCode,
  ) as (
    localStorage: MemoryStorage,
    sessionStorage: MemoryStorage,
    isResuming: boolean,
    resolveResumeBranch: (raw: string) => ResumeBranchDecision | null,
    emit: (type: string, payload: Record<string, unknown>) => void,
  ) => {
    isResuming: boolean;
    trialSessionId: string;
    enter: (id: string, kind: "trial" | "loop") => boolean | null;
    branchState: Record<string, unknown>;
  };

  return execute(
    options.localStorage,
    options.sessionStorage,
    options.isResuming,
    options.resolveResumeBranch,
    options.emit ?? (() => undefined),
  );
}

describe("resume/jump startup protocol", () => {
  it("preserves a versioned jump request across its intentional reload", () => {
    const request = createJumpRequest(
      address("42"),
      "revision-1",
      "source",
      3,
      { conditionId: 9, navigationKind: "jump" },
    );
    const localStorage = createStorage({
      jsPsych_jumpRequest: JSON.stringify(request),
      jsPsych_resumeTrial: "saved-trial",
      jsPsych_currentSessionId: "old-session",
      jsPsych_participantNumber: "7",
    });
    const sessionStorage = createStorage({ jsPsych_jumpReload: "1" });
    const resolver = vi.fn(() => null);
    const emit = vi.fn();

    const result = executeStartup({
      localStorage,
      sessionStorage,
      isResuming: true,
      resolveResumeBranch: resolver,
      emit,
    });

    expect(
      JSON.parse(localStorage.getItem("jsPsych_jumpRequest") ?? "{}"),
    ).toMatchObject({
      address: { targetId: "42" },
      reloadGuard: { observedProgress: 0 },
    });
    expect(localStorage.getItem("jsPsych_resumeTrial")).toBeNull();
    expect(sessionStorage.getItem("jsPsych_jumpReload")).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "jump-reload-resume",
      expect.objectContaining({
        conditionId: 9,
        targetId: "42",
        comingFromJumpReload: true,
        newSessionId: "fresh-session",
      }),
    );
    expect(result).toMatchObject({
      isResuming: false,
      trialSessionId: "fresh-session",
      branchState: { branchingActive: false },
    });
  });

  it("keeps a resume branch on the branch route instead of jump storage", () => {
    const localStorage = createStorage({
      jsPsych_resumeTrial: "saved-trial",
      jsPsych_currentSessionId: "existing-session",
    });
    const result = executeStartup({
      localStorage,
      sessionStorage: createStorage(),
      isResuming: true,
      resolveResumeBranch: () => ({
        kind: "branch",
        sourceId: "source",
        targetId: "nested-target",
        conditionId: 4,
        customParameters: {
          stimulus: { source: "typed", value: "restored" },
        },
        usedDefault: false,
      }),
    });

    expect(localStorage.getItem("jsPsych_jumpRequest")).toBeNull();
    expect(result.branchState).toEqual({
      nextTrialId: "nested-target",
      skipRemaining: true,
      branchingActive: true,
      customParameters: {
        stimulus: { source: "typed", value: "restored" },
      },
    });
  });

  it("routes a sequential resume through the canonical address cursor", () => {
    const localStorage = createStorage({
      jsPsych_resumeTrial: "saved-trial",
      jsPsych_currentSessionId: "existing-session",
    });
    const result = executeStartup({
      localStorage,
      sessionStorage: createStorage(),
      isResuming: true,
      resolveResumeBranch: () => ({
        kind: "sequential",
        sourceId: "first",
        targetId: "second",
        conditionId: null,
        customParameters: null,
        usedDefault: false,
      }),
    });

    expect(localStorage.getItem("jsPsych_jumpRequest")).toBeNull();
    expect(result.branchState).toEqual({
      nextTrialId: null,
      skipRemaining: false,
      branchingActive: false,
      customParameters: null,
    });
    expect(result.enter("first", "trial")).toBe(false);
    expect(result.enter("second", "trial")).toBe(true);
    expect(result.enter("second", "trial")).toBeNull();
  });
});
