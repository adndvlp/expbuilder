import { afterEach, vi } from "vitest";

const hoistedTrialsState = vi.hoisted(() => ({
  timeline: [] as any[],
  loopTimeline: [] as any[],
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => hoistedTrialsState,
}));

export const trialsState = hoistedTrialsState;

export function selectedTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: "current",
    name: "Current Trial",
    plugin: "plugin-html-keyboard-response",
    branches: ["target-a"],
    columnMapping: {
      score: { source: "csv", value: "score" },
    },
    ...overrides,
  } as any;
}

export function registerBranchedWrapperLifecycle() {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });
}
