import { vi } from "vitest";
import Actions from "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas/Actions";
import type {
  Loop,
  Trial,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";

const timeline: TimelineItem[] = [
  { id: 1, type: "trial", name: "New Trial", branches: [] },
  {
    id: "loop_parent",
    type: "loop",
    name: "Parent Loop",
    branches: [],
    trials: [10, 11],
  },
];

const loopTimeline: TimelineItem[] = [
  { id: 10, type: "trial", name: "Loop Start", branches: [11] },
  { id: 11, type: "trial", name: "Loop Branch", branches: [] },
  {
    id: "loop_child",
    type: "loop",
    name: "Child Loop",
    branches: [],
    trials: [12],
  },
];

export type { Loop, Trial };

export function createActions(
  overrides: Partial<Parameters<typeof Actions>[0]> = {},
) {
  const newTrial = {
    id: 99,
    type: "Trial",
    name: "New Trial 1",
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    parentLoopId: "loop_parent",
    branches: [],
  } as Trial;
  const newLoop = {
    id: "loop_nested",
    name: "Nested Loop 1",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [10, 11],
    code: "",
    parentLoopId: "loop_parent",
  } as Loop;
  const parentTrial = {
    id: 10,
    type: "Trial",
    name: "Loop Start",
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    branches: [11],
  } as Trial;
  const parentLoop = {
    id: "loop_parent",
    name: "Parent Loop",
    repetitions: 1,
    randomize: false,
    orders: false,
    stimuliOrders: [],
    orderColumns: [],
    categories: false,
    categoryColumn: "",
    categoryData: [],
    trials: [10, 11, "loop_child"],
    code: "",
    csvJson: [{ stimulus: "a.png" }],
  } as Loop;

  const props = {
    onSelectTrial: vi.fn(),
    onSelectLoop: vi.fn(),
    onRefreshMetadata: vi.fn(),
    loopTimeline,
    getTrial: vi.fn(async (id: string | number) =>
      id === 10 ? parentTrial : null,
    ),
    getLoop: vi.fn(async (id: string | number) =>
      id === "loop_parent" ? parentLoop : null,
    ),
    timeline,
    createTrial: vi.fn(async (trial: Omit<Trial, "id">) => ({
      ...newTrial,
      ...trial,
      id: newTrial.id,
    })),
    updateLoop: vi.fn(async (id: string | number, loop: Partial<Loop>) => ({
      ...parentLoop,
      id,
      ...loop,
    })),
    updateTrial: vi.fn(async (id: string | number, trial: Partial<Trial>) => ({
      ...parentTrial,
      id: Number(id),
      ...trial,
    })),
    updateTrialField: vi.fn(async () => true),
    loopId: "loop_parent",
    setShowLoopModal: vi.fn(),
    createLoop: vi.fn(async (loop: Omit<Loop, "id">) => ({
      ...newLoop,
      ...loop,
      id: newLoop.id,
    })),
    updateTimeline: vi.fn(async () => true),
    ...overrides,
  };

  return { props, api: Actions(props) };
}

export function setupActionsTest() {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockReturnValue(true);
}
