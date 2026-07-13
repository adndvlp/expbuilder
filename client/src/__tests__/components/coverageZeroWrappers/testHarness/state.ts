import { vi } from "vitest";

const trialsState = vi.hoisted(() => ({
  value: {} as any,
}));

const phaseState = vi.hoisted(() => ({
  setMinimumPercentAcceptable: vi.fn(),
  setColumnMapping: vi.fn(),
  setIncludeInstructions: vi.fn(),
  columnMapping: {
    stale: { source: "typed", value: "old" },
  } as any,
  trialCode: (pluginName: string) => `// ${pluginName}\n`,
}));

export { phaseState, trialsState };
