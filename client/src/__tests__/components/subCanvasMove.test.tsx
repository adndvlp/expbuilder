import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoopSubCanvas from "../../pages/ExperimentBuilder/components/Canvas/SubCanvas";
import type { Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  moveModalProps: undefined as any,
}));

vi.mock("reactflow", () => ({
  default: () => <div data-testid="react-flow" />,
  ReactFlowProvider: ({ children }: any) => children,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  Handle: () => null,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useDraggable",
  () => ({
    useDraggable: () => ({
      dragging: false,
      pos: { x: 0, y: 0 },
      handleMouseDown: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useResizable",
  () => ({
    useResizable: () => ({
      resizing: false,
      size: { width: 420, height: 320 },
      handleResizeMouseDown: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges",
  () => ({
    default: () => ({ nodes: [], edges: [] }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/components/MoveItemModal",
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
        </div>
      );
    },
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
  () => ({
    default: () => null,
  }),
);

const loopTimeline: TimelineItem[] = [
  { id: 10, type: "trial", name: "Parent", branches: [11, 12] },
  { id: 11, type: "trial", name: "Move Me", branches: [13] },
  { id: 12, type: "trial", name: "Destination", branches: [] },
  { id: 13, type: "trial", name: "Child", branches: [] },
];

const selectedTrial = {
  id: 11,
  type: "Trial",
  name: "Move Me",
  plugin: "plugin-dynamic",
  parameters: {},
  trialCode: "",
  branches: [13],
} as Trial;

function installTrialsContext() {
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
    getLoop: vi.fn(async () => null),
    updateTrial: vi.fn(async (id: string | number, patch: Partial<Trial>) => ({
      ...(trials.get(id) as Trial),
      ...patch,
    })),
    updateTrialField: vi.fn(),
    updateLoop: vi.fn(),
    timeline: [...loopTimeline],
    updateTimeline: vi.fn(async () => true),
  };
}

function renderSubCanvas(overrides: Partial<React.ComponentProps<typeof LoopSubCanvas>> = {}) {
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

describe("SubCanvas move flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installTrialsContext();
    mocks.moveModalProps = undefined;
  });

  it("moves a branched trial as a branch and reconnects its children to the old parent", async () => {
    const { onRefreshMetadata } = renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));

    expect(screen.getByTestId("move-modal")).toBeInTheDocument();
    expect(mocks.moveModalProps.availableDestinations).toEqual([
      { id: 10, name: "Parent", type: "trial", hasBranches: true },
      { id: 12, name: "Destination", type: "trial", hasBranches: false },
      { id: 13, name: "Child", type: "trial", hasBranches: false },
    ]);

    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(10, {
        branches: [12, 13],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        branches: [],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(12, {
        branches: [11],
      });
    });

    expect(mocks.trialsContext.updateTimeline).toHaveBeenCalledWith([
      { id: 10, type: "trial", name: "Parent", branches: [11, 12] },
      { id: 12, type: "trial", name: "Destination", branches: [] },
      { id: 11, type: "trial", name: "Move Me", branches: [] },
      { id: 13, type: "trial", name: "Child", branches: [] },
    ]);
    expect(onRefreshMetadata).toHaveBeenCalled();
  });

  it("moves a trial as parent of the destination branches", async () => {
    mocks.trialsContext.getTrial.mockImplementation(async (id: string | number) => {
      if (id === 12) {
        return {
          id: 12,
          type: "Trial",
          name: "Destination",
          plugin: "plugin-dynamic",
          parameters: {},
          trialCode: "",
          branches: [13],
        } as Trial;
      }
      return {
        id,
        type: "Trial",
        name: String(id),
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: id === 10 ? [11, 12] : [13],
      } as Trial;
    });

    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as parent"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        branches: [13],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(12, {
        branches: [11],
      });
    });
  });
});
