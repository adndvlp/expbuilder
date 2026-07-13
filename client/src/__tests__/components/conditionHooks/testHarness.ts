import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useParamsOverride } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/useParamsOverride";
import { useConditionalLoop } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/useConditionalLoop";
import type {
  Loop,
  ParamsOverrideCondition,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { LoopCondition } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/types";

const hoistedMocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  loadPluginParameters: vi.fn(),
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => hoistedMocks.trialsContext,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader",
  () => ({
    loadPluginParameters: hoistedMocks.loadPluginParameters,
  }),
);

const currentParameters = [
  { key: "stimulus", label: "Stimulus", type: "html_string", default: "" },
  { key: "choices", label: "Choices", type: "string_array", default: [] },
];

const previousData = [
  { key: "response", label: "Response", type: "string" },
  { key: "rt", label: "RT", type: "number" },
];

function installTrialsContext(overrides: Partial<any> = {}) {
  hoistedMocks.trialsContext = {
    timeline: [
      { id: 1, name: "Intro" },
      { id: 2, name: "Prime" },
      { id: 3, name: "Current" },
    ],
    loopTimeline: [
      { id: 1, name: "Loop Intro" },
      { id: 2, name: "Loop Prime" },
      { id: 3, name: "Loop Current" },
      { id: "loop_2", name: "Nested Loop" },
    ],
    activeLoopId: "loop_1",
    getTrial: vi.fn(async (id: string | number) => ({
      id,
      name: `Trial ${id}`,
      plugin: id === 3 ? "plugin-current" : "plugin-previous",
    })),
    getLoop: vi.fn(async (id: string | number) => ({
      id,
      name: `Loop ${id}`,
      trials: [],
    })),
    getLoopTimeline: vi.fn(async () => []),
    updateTrial: vi.fn(async (id: string | number, data: unknown) => ({
      id,
      name: "Updated",
      ...data,
    })),
    setSelectedTrial: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  installTrialsContext();
  hoistedMocks.loadPluginParameters.mockImplementation(
    async (pluginName: string) => ({
      parameters:
        pluginName === "plugin-current"
          ? currentParameters
          : [{ key: "prompt", label: "Prompt", type: "html_string" }],
      data: previousData,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mocks = hoistedMocks;

function useParamsOverrideHarness(selectedTrial: unknown) {
  return useParamsOverride(selectedTrial);
}

function useConditionalLoopHarness(
  loop: Loop,
  onSave: (conditions: LoopCondition[]) => void,
) {
  return useConditionalLoop(loop, onSave);
}

export {
  act,
  currentParameters,
  describe,
  expect,
  installTrialsContext,
  it,
  mocks,
  previousData,
  renderHook,
  useConditionalLoopHarness,
  useParamsOverrideHarness,
  vi,
  waitFor,
};
export type { Loop, LoopCondition, ParamsOverrideCondition };
