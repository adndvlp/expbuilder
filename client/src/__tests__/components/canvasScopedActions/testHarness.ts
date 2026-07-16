import { vi } from "vitest";
import type {
  Loop,
  Trial,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import type {
  CanvasActionDependencies,
  LoopCanvasActionScope,
  RootCanvasActionScope,
} from "../../../pages/ExperimentBuilder/components/Canvas/actions";

export const rootItems: TimelineItem[] = [
  { id: 1, type: "trial", name: "Question", branches: [2] },
  { id: 2, type: "trial", name: "End", branches: [] },
  { id: "parent-loop", type: "loop", name: "Loop 1", trials: [10, 11] },
];

export const loopItems: TimelineItem[] = [
  { id: 10, type: "trial", name: "Task", branches: [11] },
  { id: 11, type: "trial", name: "Loca", branches: [] },
];

export function makeTrial(
  id: number,
  overrides: Partial<Trial> = {},
): Trial {
  return {
    id,
    type: "Trial",
    name: `Trial ${id}`,
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    branches: [],
    ...overrides,
  };
}

export function makeLoop(id: string, overrides: Partial<Loop> = {}): Loop {
  return {
    id,
    name: id,
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [],
    code: "",
    ...overrides,
  };
}

export function createDependencies() {
  const trials = new Map<string | number, Trial>([
    [1, makeTrial(1, { name: "Question", branches: [2] })],
    [2, makeTrial(2, { name: "End" })],
    [10, makeTrial(10, { name: "Task", branches: [11] })],
    [11, makeTrial(11, { name: "Loca" })],
  ]);
  const loops = new Map<string | number, Loop>([
    [
      "parent-loop",
      makeLoop("parent-loop", {
        name: "Loop 1",
        trials: [10, 11],
        csvJson: [{ stimulus: "a.png" }],
      }),
    ],
    ["child-loop", makeLoop("child-loop", { branches: [11] })],
  ]);
  const dependencies = {
    createTrial: vi.fn(async (input: Omit<Trial, "id">) =>
      makeTrial(99, input),
    ),
    createLoop: vi.fn(async (input: Omit<Loop, "id">) =>
      makeLoop("nested-loop", input),
    ),
    getTrial: vi.fn(async (id: string | number) => trials.get(id) ?? null),
    getLoop: vi.fn(async (id: string | number) => loops.get(id) ?? null),
    updateTrial: vi.fn(async (id: string | number, patch: Partial<Trial>) => {
      const current = trials.get(id);
      return current ? { ...current, ...patch } : null;
    }),
    updateLoop: vi.fn(async (id: string | number, patch: Partial<Loop>) => {
      const current = loops.get(id);
      return current ? { ...current, ...patch } : null;
    }),
    updateTrialField: vi.fn(async () => true),
    updateTimeline: vi.fn(async () => true),
  } satisfies CanvasActionDependencies;

  return dependencies;
}

export function createRootScope(): RootCanvasActionScope {
  return { kind: "root", items: rootItems };
}

export function createLoopScope(refresh = vi.fn()): LoopCanvasActionScope {
  return {
    kind: "loop",
    loopId: "parent-loop",
    items: loopItems,
    rootItems,
    refresh,
  };
}
