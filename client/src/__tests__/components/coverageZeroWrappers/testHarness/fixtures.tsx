import "./branchedTrialMocks";
import "./webgazerMocks";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BranchedTrial from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial";
import useLoadData from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/useLoadData";
import Webgazer from "../../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/Webgazer";
import { phaseState, trialsState } from "./state";

function selectedTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: "current",
    name: "Current Trial",
    type: "trial",
    plugin: "plugin-html-keyboard-response",
    branches: ["target-a"],
    branchConditions: [],
    repeatConditions: [],
    parameters: {
      include_instructions: {
        "plugin-webgazer-init-camera": true,
      },
      minimum_percent: 50,
    },
    ...overrides,
  } as any;
}

function baseTrialsState(overrides: Record<string, unknown> = {}) {
  const current = selectedTrial();
  return {
    selectedTrial: current,
    setSelectedTrial: vi.fn(),
    updateTrial: vi.fn(async (_id: string, updates: any) => ({
      ...current,
      ...updates,
    })),
    updateLoop: vi.fn(async () => true),
    updateTrialField: vi.fn(async () => true),
    deleteTrial: vi.fn(async () => true),
    getTrial: vi.fn(async (id: string) => ({
      id,
      name: "Loaded Target",
      type: "trial",
      plugin: "plugin-html-keyboard-response",
      csvColumns: ["score", "rt"],
    })),
    getLoop: vi.fn(async (id: string) => ({
      id,
      name: "Loaded Loop",
      type: "loop",
      trials: ["inner-a"],
      csvColumns: ["loop_score"],
    })),
    timeline: [
      { id: "prev-a", name: "Previous A", type: "trial" },
      { id: "current", name: "Current Trial", type: "trial" },
      { id: "target-a", name: "Target A", type: "trial" },
      { id: "loop_1", name: "Loop 1", type: "loop", trials: ["inner-a"] },
    ],
    loopTimeline: [
      { id: "inner-prev", name: "Inner Prev", type: "trial" },
      { id: "current", name: "Current Trial", type: "trial" },
    ],
    getLoopTimeline: vi.fn(async () => []),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  phaseState.columnMapping = {
    stale: { source: "typed", value: "old" },
  };
  phaseState.trialCode = (pluginName: string) => `// ${pluginName}\n`;
  trialsState.value = baseTrialsState();
});

export {
  BranchedTrial,
  Webgazer,
  act,
  baseTrialsState,
  describe,
  expect,
  fireEvent,
  it,
  phaseState,
  render,
  screen,
  selectedTrial,
  trialsState,
  useLoadData,
  vi,
  waitFor,
};
