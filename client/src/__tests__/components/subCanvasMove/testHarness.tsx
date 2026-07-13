import { render } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import LoopSubCanvas from "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas";
import type {
  Loop,
  Trial,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  moveModalProps: undefined as any,
  dragging: false,
  resizing: false,
}));

export function getMocks() {
  return mocks;
}

vi.mock("reactflow", () => ({
  default: () => <div data-testid="react-flow" />,
  ReactFlowProvider: ({ children }: any) => children,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  Handle: () => null,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/hooks/useDraggable",
  () => ({
    useDraggable: () => ({
      dragging: mocks.dragging,
      pos: { x: 0, y: 0 },
      handleMouseDown: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/hooks/useResizable",
  () => ({
    useResizable: () => ({
      resizing: mocks.resizing,
      size: { width: 420, height: 320 },
      handleResizeMouseDown: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges",
  () => ({
    default: () => ({ nodes: [], edges: [] }),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/components/MoveItemModal",
  () => ({
    default: (props: any) => {
      mocks.moveModalProps = props;
      return (
        <div data-testid="move-modal">
          <span>{props.itemName}</span>
          <button type="button" onClick={() => props.onConfirm(12, true)}>
            Move as branch
          </button>
          <button type="button" onClick={() => props.onConfirm(12, false)}>
            Move as parent
          </button>
          <button type="button" onClick={props.onClose}>
            Close Move
          </button>
        </div>
      );
    },
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
  () => ({
    default: () => null,
  }),
);

export const loopTimeline: TimelineItem[] = [
  { id: 10, type: "trial", name: "Parent", branches: [11, 12] },
  { id: 11, type: "trial", name: "Move Me", branches: [13] },
  { id: 12, type: "trial", name: "Destination", branches: [] },
  { id: 13, type: "trial", name: "Child", branches: [] },
];

export const selectedTrial = {
  id: 11,
  type: "Trial",
  name: "Move Me",
  plugin: "plugin-dynamic",
  parameters: {},
  trialCode: "",
  branches: [13],
} as Trial;

export function installTrialsContext(overrides: Partial<any> = {}) {
  const trials = new Map<string | number, Trial>([
    [
      10,
      {
        id: 10,
        type: "Trial",
        name: "Parent",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: [11, 12],
      } as Trial,
    ],
    [11, selectedTrial],
    [
      12,
      {
        id: 12,
        type: "Trial",
        name: "Destination",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: [],
      } as Trial,
    ],
  ]);

  mocks.trialsContext = {
    createTrial: vi.fn(),
    createLoop: vi.fn(),
    getTrial: vi.fn(async (id: string | number) => trials.get(id) || null),
    getLoop: vi.fn(async (id: string | number) =>
      id === "loop_parent"
        ? ({
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
            trials: [10, 11, 12],
            code: "",
          } as Loop)
        : null,
    ),
    updateTrial: vi.fn(async (id: string | number, patch: Partial<Trial>) => ({
      ...(trials.get(id) as Trial),
      ...patch,
    })),
    updateTrialField: vi.fn(),
    updateLoop: vi.fn(),
    timeline: [...loopTimeline],
    updateTimeline: vi.fn(async () => true),
    ...overrides,
  };
}

export function renderSubCanvas(
  overrides: Partial<React.ComponentProps<typeof LoopSubCanvas>> = {},
) {
  const onRefreshMetadata = vi.fn();
  const view = render(
    <LoopSubCanvas
      loopId="loop_parent"
      loopName="Parent Loop"
      loopTimeline={loopTimeline}
      onClose={vi.fn()}
      isDark={false}
      selectedTrial={selectedTrial}
      selectedLoop={null}
      onSelectTrial={vi.fn()}
      onSelectLoop={vi.fn()}
      onRefreshMetadata={onRefreshMetadata}
      {...overrides}
    />,
  );

  return { ...view, onRefreshMetadata };
}

export function renderSparseDestinationScenario(
  destinationType: "trial" | "loop",
  lookupState: "missing" | "without branches",
) {
  const destinationId = destinationType === "trial" ? 12 : "dest-loop";
  const destination: TimelineItem =
    destinationType === "trial"
      ? {
          id: 12,
          type: "trial",
          name: "Destination",
          branches: [13],
        }
      : {
          id: "dest-loop",
          type: "loop",
          name: "Destination Loop",
          branches: [13],
        };
  const sparseLookup =
    lookupState === "missing"
      ? undefined
      : destinationType === "trial"
        ? ({
            ...selectedTrial,
            id: 12,
            name: "Destination",
            branches: undefined,
          } as any)
        : ({
            id: "dest-loop",
            name: "Destination Loop",
            trials: [],
            branches: undefined,
          } as any);
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
    trials: [11, destinationId],
    code: "",
  } as Loop;
  const sparseTimeline: TimelineItem[] = [
    { id: 11, type: "trial", name: "Move Me", branches: [] },
    destination,
    { id: 13, type: "trial", name: "Child", branches: [] },
  ];

  installTrialsContext({
    getTrial: vi.fn(async (id: string | number) =>
      id === destinationId ? sparseLookup : null,
    ),
    getLoop: vi.fn(async (id: string | number) =>
      id === "loop_parent" ? parentLoop : sparseLookup,
    ),
  });
  renderSubCanvas({
    loopTimeline: sparseTimeline,
    onRefreshMetadata: undefined,
  });

  return destinationId;
}
