import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoopSubCanvas from "../../pages/ExperimentBuilder/components/Canvas/SubCanvas";
import type { Loop, Trial } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  moveModalProps: undefined as any,
  dragging: false,
  resizing: false,
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
      dragging: mocks.dragging,
      pos: { x: 0, y: 0 },
      handleMouseDown: vi.fn(),
    }),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useResizable",
  () => ({
    useResizable: () => ({
      resizing: mocks.resizing,
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
          <button type="button" onClick={props.onClose}>
            Close Move
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

function installTrialsContext(overrides: Partial<any> = {}) {
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
    mocks.dragging = false;
    mocks.resizing = false;
  });

  it("renders active dragging and resizing styles", () => {
    mocks.dragging = true;
    mocks.resizing = true;

    const { container } = renderSubCanvas();
    const surface = container.firstElementChild as HTMLElement;

    expect(surface.style.userSelect).toBe("none");
    expect(surface.style.transition).toBe("none");
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

    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_parent", {
      trials: [10, 12],
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
      parentLoopId: "loop_parent",
    });
    expect(mocks.trialsContext.updateTimeline).not.toHaveBeenCalled();
    expect(onRefreshMetadata).toHaveBeenCalled();
  });

  it("moves a trial whose refreshed timeline omits its branches", async () => {
    const sparseTimeline: TimelineItem[] = [
      { id: 10, type: "trial", name: "Parent", branches: [11, 12] },
      { id: 11, type: "trial", name: "Move Me" },
      { id: 12, type: "trial", name: "Destination", branches: [] },
    ];
    renderSubCanvas({ loopTimeline: sparseTimeline });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(10, {
        branches: [12],
      });
    });
  });

  it("does not duplicate a child already reconnected to the old parent", async () => {
    const duplicateChildTimeline: TimelineItem[] = [
      { id: 10, type: "trial", name: "Parent", branches: [11, 13] },
      { id: 11, type: "trial", name: "Move Me", branches: [13] },
      { id: 12, type: "trial", name: "Destination", branches: [] },
      { id: 13, type: "trial", name: "Child", branches: [] },
    ];
    renderSubCanvas({ loopTimeline: duplicateChildTimeline });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(10, {
        branches: [13],
      });
    });
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

    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_parent", {
      trials: [10, 12],
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
      parentLoopId: "loop_parent",
    });
    expect(mocks.trialsContext.updateTimeline).not.toHaveBeenCalled();
  });

  it.each([
    ["branch", "trial", "missing"],
    ["branch", "trial", "without branches"],
    ["branch", "loop", "missing"],
    ["branch", "loop", "without branches"],
    ["sequential", "trial", "missing"],
    ["sequential", "trial", "without branches"],
    ["sequential", "loop", "missing"],
    ["sequential", "loop", "without branches"],
  ] as const)(
    "moves with a %s %s destination whose lookup is %s",
    async (mode, destinationType, lookupState) => {
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

      fireEvent.click(screen.getByTitle("Move Trial/Loop"));
      await act(async () => {
        await mocks.moveModalProps.onConfirm(
          destinationId,
          mode === "branch",
        );
      });

      const destinationUpdater =
        destinationType === "trial"
          ? mocks.trialsContext.updateTrial
          : mocks.trialsContext.updateLoop;
      if (lookupState === "missing") {
        expect(
          destinationUpdater.mock.calls.some(
            (call: any[]) => call[0] === destinationId,
          ),
        ).toBe(false);
      } else {
        expect(destinationUpdater).toHaveBeenCalledWith(destinationId, {
          branches: [11],
        });
      }
    },
  );

  it("finishes a move when the parent loop lookup is empty", async () => {
    mocks.trialsContext.getLoop = vi.fn(async () => null);
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_parent");
    });
    expect(mocks.trialsContext.updateLoop).not.toHaveBeenCalled();
  });

  it("leaves direct loop children unchanged when the moved id is absent", async () => {
    mocks.trialsContext.getLoop = vi.fn(async () => ({
      id: "loop_parent",
      name: "Parent Loop",
      trials: [10, 12],
    }));
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_parent");
    });
    expect(mocks.trialsContext.updateLoop).not.toHaveBeenCalled();
  });

  it("does not open the move modal when the selected item is not in the loop timeline", () => {
    renderSubCanvas({
      selectedTrial: {
        ...selectedTrial,
        id: 999,
        name: "Missing Trial",
      } as Trial,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));

    expect(screen.queryByTestId("move-modal")).not.toBeInTheDocument();
  });

  it("closes the move modal without moving anything", () => {
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    expect(screen.getByTestId("move-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close Move"));

    expect(screen.queryByTestId("move-modal")).not.toBeInTheDocument();
    expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
  });

  it("logs and stops when the move destination is missing", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("missing-destination", true);
    });

    expect(consoleError).toHaveBeenCalledWith("Destination item not found");
  });

  it("moves a loop as a branch of another loop destination", async () => {
    const loopMoveTimeline: TimelineItem[] = [
      {
        id: "parent-loop",
        type: "loop",
        name: "Branch Parent Loop",
        branches: ["move-loop", "dest-loop"],
      },
      {
        id: "move-loop",
        type: "loop",
        name: "Move Loop",
        branches: ["child-trial"],
      },
      {
        id: "dest-loop",
        type: "loop",
        name: "Destination Loop",
        branches: [],
      },
      { id: "child-trial", type: "trial", name: "Child Trial", branches: [] },
    ];
    const selectedLoop = {
      id: "move-loop",
      name: "Move Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: ["child-trial"],
      branches: ["child-trial"],
      code: "",
      parentLoopId: "loop_parent",
    } as unknown as Loop;
    const loops = new Map<string | number, Loop>([
      [
        "loop_parent",
        {
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
          trials: ["parent-loop", "move-loop", "dest-loop"],
          code: "",
        } as unknown as Loop,
      ],
      [
        "dest-loop",
        {
          id: "dest-loop",
          name: "Destination Loop",
          repetitions: 1,
          randomize: false,
          orders: false,
          stimuliOrders: [],
          orderColumns: [],
          categories: false,
          categoryColumn: "",
          categoryData: [],
          trials: [],
          branches: ["existing-branch"],
          code: "",
        } as unknown as Loop,
      ],
      ["move-loop", selectedLoop],
      [
        "parent-loop",
        {
          id: "parent-loop",
          name: "Branch Parent Loop",
          repetitions: 1,
          randomize: false,
          orders: false,
          stimuliOrders: [],
          orderColumns: [],
          categories: false,
          categoryColumn: "",
          categoryData: [],
          trials: [],
          branches: ["move-loop", "dest-loop"],
          code: "",
        } as unknown as Loop,
      ],
    ]);
    mocks.trialsContext.getLoop.mockImplementation(async (id: string | number) =>
      loops.get(id) || null,
    );

    const { onRefreshMetadata } = renderSubCanvas({
      loopTimeline: loopMoveTimeline,
      selectedTrial: null,
      selectedLoop,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("dest-loop", true);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "parent-loop",
        { branches: ["dest-loop", "child-trial"] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        branches: [],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("dest-loop", {
        branches: ["existing-branch", "move-loop"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: ["parent-loop", "dest-loop"] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        parentLoopId: "loop_parent",
      });
    });
    expect(onRefreshMetadata).toHaveBeenCalled();
  });

  it("moves a loop as parent of another loop destination", async () => {
    const loopMoveTimeline: TimelineItem[] = [
      { id: "move-loop", type: "loop", name: "Move Loop", branches: [] },
      { id: "dest-loop", type: "loop", name: "Destination Loop", branches: [] },
    ];
    const selectedLoop = {
      id: "move-loop",
      name: "Move Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: [],
      branches: [],
      code: "",
    } as unknown as Loop;
    mocks.trialsContext.getLoop.mockImplementation(async (id: string | number) => {
      if (id === "dest-loop") {
        return {
          id: "dest-loop",
          name: "Destination Loop",
          repetitions: 1,
          randomize: false,
          orders: false,
          stimuliOrders: [],
          orderColumns: [],
          categories: false,
          categoryColumn: "",
          categoryData: [],
          trials: [],
          branches: ["dest-child"],
          code: "",
        } as unknown as Loop;
      }
      if (id === "loop_parent") {
        return {
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
          trials: ["move-loop", "dest-loop"],
          code: "",
        } as unknown as Loop;
      }
      return selectedLoop;
    });

    renderSubCanvas({
      loopTimeline: loopMoveTimeline,
      selectedTrial: null,
      selectedLoop,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("dest-loop", false);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        branches: ["dest-child"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("dest-loop", {
        branches: ["move-loop"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: ["dest-loop"] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        parentLoopId: "loop_parent",
      });
    });
  });

  it("moves a loop as parent of a trial destination", async () => {
    const loopMoveTimeline: TimelineItem[] = [
      { id: "move-loop", type: "loop", name: "Move Loop", branches: [] },
      { id: 12, type: "trial", name: "Destination Trial", branches: [] },
    ];
    const selectedLoop = {
      id: "move-loop",
      name: "Move Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: [],
      branches: [],
      code: "",
    } as unknown as Loop;
    mocks.trialsContext.getTrial.mockImplementation(async (id: string | number) =>
      id === 12
        ? ({
            id: 12,
            type: "Trial",
            name: "Destination Trial",
            plugin: "plugin-dynamic",
            parameters: {},
            trialCode: "",
            branches: ["dest-child"],
          } as unknown as Trial)
        : null,
    );
    mocks.trialsContext.getLoop.mockImplementation(async (id: string | number) => {
      if (id === "loop_parent") {
        return {
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
          trials: ["move-loop", 12],
          code: "",
        } as unknown as Loop;
      }
      return selectedLoop;
    });

    renderSubCanvas({
      loopTimeline: loopMoveTimeline,
      selectedTrial: null,
      selectedLoop,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm(12, false);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        branches: ["dest-child"],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(12, {
        branches: ["move-loop"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: [12] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        parentLoopId: "loop_parent",
      });
    });
  });

  it("moves a trial as parent of a loop destination", async () => {
    const mixedTimeline: TimelineItem[] = [
      { id: 11, type: "trial", name: "Move Me", branches: [] },
      { id: "dest-loop", type: "loop", name: "Destination Loop", branches: [] },
    ];
    mocks.trialsContext.getLoop.mockImplementation(async (id: string | number) => {
      if (id === "dest-loop") {
        return {
          id: "dest-loop",
          name: "Destination Loop",
          repetitions: 1,
          randomize: false,
          orders: false,
          stimuliOrders: [],
          orderColumns: [],
          categories: false,
          categoryColumn: "",
          categoryData: [],
          trials: [],
          branches: ["dest-child"],
          code: "",
        } as unknown as Loop;
      }
      if (id === "loop_parent") {
        return {
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
          trials: [11, "dest-loop"],
          code: "",
        } as unknown as Loop;
      }
      return null;
    });

    renderSubCanvas({
      loopTimeline: mixedTimeline,
      selectedTrial: {
        ...selectedTrial,
        branches: [],
      } as Trial,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("dest-loop", false);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        branches: ["dest-child"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("dest-loop", {
        branches: [11],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: ["dest-loop"] },
      );
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        parentLoopId: "loop_parent",
      });
    });
  });

  it("logs errors thrown while moving an item", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const moveError = new Error("move failed");
    mocks.trialsContext.updateTrial.mockRejectedValueOnce(moveError);
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm(12, true);
    });

    expect(consoleError).toHaveBeenCalledWith("Error moving item:", moveError);
  });
});
