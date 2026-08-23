import { describe, expect, it, vi } from "vitest";
import { resumeJumpStartupCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/resumeJumpStartupCode";

type MemoryStorage = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: unknown) => void;
};

function createStorage(initial: Record<string, string> = {}): MemoryStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function executeStartup(options: {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
  isResuming: boolean;
  resolveResumeBranch: (raw: string) => string | null;
  emit?: (type: string, payload: Record<string, unknown>) => void;
}) {
  const execute = new Function(
    "localStorage",
    "sessionStorage",
    "initialIsResuming",
    "_resolveResumeBranch",
    "emit",
    `
      let isResuming = initialIsResuming;
      let trialSessionId = 'existing-session';
      const crypto = { randomUUID: () => 'fresh-session' };
      const _generateSessionName = () => null;
      const window = { ExpBuilderRuntime: { emit } };
      ${resumeJumpStartupCode()}
      return { isResuming, trialSessionId };
    `,
  ) as (
    localStorage: MemoryStorage,
    sessionStorage: MemoryStorage,
    isResuming: boolean,
    resolveResumeBranch: (raw: string) => string | null,
    emit: (type: string, payload: Record<string, unknown>) => void,
  ) => { isResuming: boolean; trialSessionId: string };

  return execute(
    options.localStorage,
    options.sessionStorage,
    options.isResuming,
    options.resolveResumeBranch,
    options.emit ?? (() => undefined),
  );
}

describe("resume/jump startup protocol", () => {
  it("preserves an exact jump target across its intentional reload", () => {
    const localStorage = createStorage({
      jsPsych_jumpToTrial: "42",
      jsPsych_resumeTrial: "saved-trial",
      jsPsych_currentSessionId: "old-session",
      jsPsych_participantNumber: "7",
    });
    const sessionStorage = createStorage({
      jsPsych_jumpReload: "1",
      jsPsych_jumpContext: JSON.stringify({ conditionId: 9 }),
    });
    const resolver = vi.fn(() => null);
    const emit = vi.fn();

    const result = executeStartup({
      localStorage,
      sessionStorage,
      isResuming: true,
      resolveResumeBranch: resolver,
      emit,
    });

    expect(localStorage.getItem("jsPsych_jumpToTrial")).toBe("42");
    expect(localStorage.getItem("jsPsych_resumeTrial")).toBeNull();
    expect(sessionStorage.getItem("jsPsych_jumpReload")).toBeNull();
    expect(sessionStorage.getItem("jsPsych_jumpContext")).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("jump-reload-resume", {
      conditionId: 9,
      targetId: "42",
      newSessionId: "fresh-session",
    });
    expect(result).toEqual({
      isResuming: false,
      trialSessionId: "fresh-session",
    });
  });

  it("turns a resume branch into a same-runtime jump without a reload marker", () => {
    const localStorage = createStorage({
      jsPsych_resumeTrial: "saved-trial",
      jsPsych_currentSessionId: "existing-session",
    });
    const sessionStorage = createStorage();

    const result = executeStartup({
      localStorage,
      sessionStorage,
      isResuming: true,
      resolveResumeBranch: () => "nested-target",
    });

    expect(localStorage.getItem("jsPsych_jumpToTrial")).toBe("nested-target");
    expect(sessionStorage.getItem("jsPsych_jumpReload")).toBeNull();
    expect(result).toEqual({
      isResuming: true,
      trialSessionId: "existing-session",
    });
  });
});
