import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../pages/ExperimentBuilder/components/Canvas";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  flowLayoutProps: undefined as any,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout",
  () => ({
    useFlowLayout: (props: any) => {
      mocks.flowLayoutProps = props;
      return {
        nodes: [{ id: "node-1", type: "trial", position: { x: 0, y: 0 } }],
        edges: [],
      };
    },
  }),
);

vi.mock("reactflow", () => ({
  default: ({ onPaneClick }: { onPaneClick: () => void }) => (
    <div data-testid="react-flow">
      <button type="button" onClick={onPaneClick}>
        Pane
      </button>
    </div>
  ),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
  () => ({
    default: ({ selectedTrial, onClose }: any) => (
      <div data-testid="branched-modal">
        Branched {selectedTrial?.name}
        <button type="button" onClick={onClose}>
          Close Branch Modal
        </button>
      </div>
    ),
  }),
);

vi.mock("../../pages/ExperimentBuilder/components/Canvas/SubCanvas", () => ({
  default: ({
    loopId,
    loopName,
    onRefreshMetadata,
    onNavigateToLoop,
    onNavigateToRoot,
    onClose,
    onSelectTrial,
    onSelectLoop,
    onOpenNestedLoop,
  }: {
    loopId: string;
    loopName: string;
    onRefreshMetadata: () => void;
    onNavigateToLoop: (index: number) => void;
    onNavigateToRoot: () => void;
    onClose: () => void;
    onSelectTrial: (trial: any) => void;
    onSelectLoop: (loop: any) => void;
    onOpenNestedLoop: (id: string) => void;
  }) => (
    <div data-testid="sub-canvas">
      SubCanvas {loopId} {loopName}
      <button type="button" onClick={onRefreshMetadata}>
        Refresh Loop
      </button>
      <button type="button" onClick={() => onNavigateToLoop(0)}>
        Navigate First Loop
      </button>
      <button type="button" onClick={onNavigateToRoot}>
        Navigate Root
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectTrial({ id: 7, type: "trial", name: "Inner Trial" })
        }
      >
        Select Inner Trial
      </button>
      <button
        type="button"
        onClick={() =>
          onSelectLoop({ id: "loop-child", type: "loop", name: "Child Loop" })
        }
      >
        Select Inner Loop
      </button>
      <button type="button" onClick={() => onOpenNestedLoop("loop-child")}>
        Open Nested Loop
      </button>
      <button type="button" onClick={() => onOpenNestedLoop("loop-1")}>
        Open Root Nested
      </button>
      <button type="button" onClick={onClose}>
        Close SubCanvas
      </button>
    </div>
  ),
}));

function makeTrial(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "trial",
    name: `Trial ${id}`,
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    branches: [],
    ...overrides,
  };
}

function makeLoop(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "loop",
    name: id === "loop-child" ? "Child Loop" : "Loop 1",
    trials: [1, 2],
    branches: [],
    ...overrides,
  };
}

function installTrialsContext(overrides: Partial<any> = {}) {
  const trialsById = new Map<number | string, any>([
    [1, makeTrial(1, { branches: [2] })],
    [2, makeTrial(2)],
    [3, makeTrial(3)],
  ]);
  const loopsById = new Map<number | string, any>([
    ["loop-1", makeLoop("loop-1")],
    ["loop-child", makeLoop("loop-child", { parentLoopId: "loop-1" })],
  ]);

  mocks.trialsContext = {
    timeline: [
      { id: 1, type: "trial", name: "Trial 1", branches: [2] },
      { id: 2, type: "trial", name: "Trial 2", branches: [] },
      { id: 3, type: "trial", name: "Trial 3", branches: [] },
    ],
    loopTimeline: [],
    selectedTrial: null,
    setSelectedTrial: vi.fn(),
    selectedLoop: null,
    setSelectedLoop: vi.fn(),
    createTrial: vi.fn(async (data: any) => ({
      id: 99,
      ...data,
      branches: data.branches || [],
    })),
    createLoop: vi.fn(async (data: any) => ({
      id: "loop-new",
      type: "loop",
      ...data,
    })),
    getTrial: vi.fn(async (id: number | string) => trialsById.get(id)),
    getLoop: vi.fn(async (id: number | string) => loopsById.get(id)),
    updateTrial: vi.fn(async () => true),
    updateLoop: vi.fn(async () => true),
    updateTimeline: vi.fn(async () => true),
    getLoopTimeline: vi.fn(async () => []),
    ...overrides,
  };
}

function expectTimelineItem(
  item: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
) {
  expect(item).toEqual(expect.objectContaining(expected));
}

describe("Canvas container", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    installTrialsContext();
  });

  it("creates the first trial from the toolbar and selects it", async () => {
    installTrialsContext({ timeline: [] });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Add trial"));

    await waitFor(() => {
      expect(mocks.trialsContext.createTrial).toHaveBeenCalledWith({
        type: "Trial",
        name: "New Trial",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
      });
    });
    expect(mocks.trialsContext.updateTimeline).toHaveBeenCalledWith([
      {
        id: 99,
        type: "trial",
        name: "New Trial",
        branches: [],
      },
    ]);
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, name: "New Trial" }),
    );
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(null);
  });

  it("normalizes a newly created trial that omits branches", async () => {
    installTrialsContext({
      timeline: [],
      createTrial: vi.fn(async (data: any) => ({
        id: 99,
        name: data.name,
        type: data.type,
      })),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Add trial"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTimeline).toHaveBeenCalledWith([
        expect.objectContaining({ id: 99, branches: [] }),
      ]);
    });
  });

  it("logs toolbar create-trial failures without mutating timeline", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      timeline: [],
      createTrial: vi.fn(async () => {
        throw new Error("create failed");
      }),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Add trial"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error creating trial:",
        expect.any(Error),
      );
    });
    expect(mocks.trialsContext.updateTimeline).not.toHaveBeenCalled();
  });

  it("does not open the loop range modal when loop creation is cancelled", () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Add loop"));

    expect(screen.queryByText("Select trials/loops for loop")).not.toBeInTheDocument();
    expect(mocks.trialsContext.createLoop).not.toHaveBeenCalled();
  });

  it("creates a loop from the range modal including branch descendants", async () => {
    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Add loop"));
    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to group these trials/loops into a loop?",
    );

    fireEvent.click(screen.getByLabelText("Trial 1"));
    fireEvent.click(screen.getByText("Confirm (2 items)"));

    await waitFor(() => {
      expect(mocks.trialsContext.createLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Loop 1",
          repetitions: 1,
          randomize: false,
          trials: [1, 2],
        }),
      );
    });
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-new", name: "Loop 1" }),
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
  });

  it("logs loop creation failures and closes the loop range modal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      createLoop: vi.fn(async () => {
        throw new Error("loop failed");
      }),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Add loop"));
    fireEvent.click(screen.getByLabelText("Trial 3"));
    fireEvent.click(screen.getByText("Confirm (1 items)"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error creating loop:",
        expect.any(Error),
      );
    });
    expect(screen.queryByText("Select trials/loops for loop")).not.toBeInTheDocument();
  });

  it("wires flow-layout selection callbacks and clears selection on pane click", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onSelectTrial({ id: 2 });
    });

    expect(mocks.trialsContext.getTrial).toHaveBeenCalledWith(2);
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
    );
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(null);

    await act(async () => {
      await mocks.flowLayoutProps.onSelectLoop({ id: "loop-1" });
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-1");
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-1" }),
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText("Pane"));

    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenLastCalledWith(null);
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenLastCalledWith(null);
  });

  it("logs flow-layout selection and loop loading errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      getTrial: vi.fn(async () => {
        throw new Error("trial read failed");
      }),
      getLoop: vi.fn(async () => {
        throw new Error("loop read failed");
      }),
    });

    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onSelectTrial({ id: 1 });
      await mocks.flowLayoutProps.onSelectLoop({ id: "loop-1" });
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error fetching full trial data:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching full loop data:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error loading loop:",
      expect.any(Error),
    );
  });

  it("ignores empty flow-layout selections and a missing opened loop", async () => {
    installTrialsContext({
      getTrial: vi.fn(async () => undefined),
      getLoop: vi.fn(async () => undefined),
    });

    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onSelectTrial({ id: 404 });
      await mocks.flowLayoutProps.onSelectLoop({ id: "missing-loop" });
      await mocks.flowLayoutProps.onOpenLoop("missing-loop");
    });

    expect(screen.queryByTestId("sub-canvas")).not.toBeInTheDocument();
    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith(
      "missing-loop",
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(null);
  });

  it("opens branch configuration with loop-scoped metadata and renders opened loops", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(1, { parentLoopId: "loop-1" }),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Branches"));

    expect(await screen.findByTestId("branched-modal")).toHaveTextContent(
      "Trial 1",
    );
    await waitFor(() => {
      expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith("loop-1");
    });

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });

    expect(await screen.findByTestId("sub-canvas")).toHaveTextContent(
      "Loop 1",
    );
    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-1");
    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith("loop-1");

    fireEvent.click(screen.getByText("Open Nested Loop"));

    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-child");
    });
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-child" }),
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
  });

  it("opens branch configuration without requesting loop metadata at root", async () => {
    installTrialsContext({ selectedTrial: makeTrial(1) });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Branches"));

    expect(await screen.findByTestId("branched-modal")).toHaveTextContent(
      "Trial 1",
    );
    expect(mocks.trialsContext.getLoopTimeline).not.toHaveBeenCalled();
  });

  it("logs refresh failures for an opened loop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });

    mocks.trialsContext.getLoopTimeline.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(await screen.findByText("Refresh Loop"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error refreshing loop metadata:",
        expect.any(Error),
      );
    });
  });

  it("adds a direct branch when the parent has no existing branches", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(3);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.createTrial).toHaveBeenCalledWith({
        type: "Trial",
        name: "New Trial",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
      });
    });
    expect(mocks.trialsContext.getTrial).toHaveBeenCalledWith(3);
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      3,
      { branches: [99] },
      expect.objectContaining({ id: 99, name: "New Trial" }),
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
    );
  });

  it("adds direct branches when trial and loop data omit branch arrays", async () => {
    installTrialsContext({
      timeline: [{ id: 3, type: "trial", name: "Trial 3" }],
      getTrial: vi.fn(async () => makeTrial(3, { branches: undefined })),
    });
    const trialRender = render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(3);
    });

    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      3,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    trialRender.unmount();

    installTrialsContext({
      timeline: [
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [1] },
      ],
      getLoop: vi.fn(async () => makeLoop("loop-1", { branches: undefined })),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch("loop-1");
    });

    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
      "loop-1",
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
  });

  it("ignores missing branch parents and parent lookups that return empty", async () => {
    installTrialsContext({
      getTrial: vi.fn(async (id: number | string) =>
        id === 3 ? undefined : makeTrial(Number(id)),
      ),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch("missing-parent");
    });
    expect(mocks.trialsContext.createTrial).not.toHaveBeenCalled();

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(3);
    });

    expect(mocks.trialsContext.createTrial).toHaveBeenCalled();
    expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
  });

  it("logs branch creation failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      createTrial: vi.fn(async () => {
        throw new Error("branch create failed");
      }),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(3);
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error adding branch:",
      expect.any(Error),
    );
  });

  it("adds a branch from the add-trial modal when the parent already has branches", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("As Branch (Parallel)"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        1,
        { branches: [2, 99] },
        expect.objectContaining({ id: 99 }),
      );
    });
  });

  it("logs add-as-parent failures from the add-trial modal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      createTrial: vi.fn(async () => {
        throw new Error("parent create failed");
      }),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("As Parent (Sequential)"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error adding trial as parent:",
        expect.any(Error),
      );
    });
  });

  it("adds direct and parent trials to loop nodes", async () => {
    installTrialsContext({
      timeline: [
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [1], branches: [] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
      ],
    });
    const firstRender = render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch("loop-1");
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-1");
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
      "loop-1",
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    firstRender.unmount();

    installTrialsContext({
      timeline: [
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [1], branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
      ],
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch("loop-1");
    });
    fireEvent.click(screen.getByText("As Parent (Sequential)"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop-1",
        { branches: [99] },
        expect.objectContaining({ id: 99, branches: [] }),
      );
    });
  });

  it("closes add-trial and move-item modals without confirming", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Add New Trial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Move Item"));
    expect(screen.getByText("Move Item")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Move Item")).not.toBeInTheDocument();
  });

  it("inserts a new trial as parent of existing branches", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });

    fireEvent.click(screen.getByText("As Parent (Sequential)"));

    await waitFor(() => {
      expect(mocks.trialsContext.createTrial).toHaveBeenCalledWith({
        type: "Trial",
        name: "New Trial",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: [2],
      });
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      1,
      { branches: [99] },
      expect.objectContaining({ id: 99, branches: [2] }),
    );

    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expectTimelineItem(reorderedTimeline?.[0], { id: 1, branches: [99] });
    expectTimelineItem(reorderedTimeline?.[1], {
      id: 99,
      type: "trial",
      branches: [2],
    });
  });

  it("creates parent trials when source lookups are empty or omit branches", async () => {
    const runScenario = async (
      parentType: "trial" | "loop",
      lookupResult: any,
    ) => {
      const parentId = parentType === "trial" ? 1 : "loop-1";
      installTrialsContext({
        timeline: [
          {
            id: parentId,
            type: parentType,
            name: parentType === "trial" ? "Trial 1" : "Loop 1",
            branches: [2],
          },
          { id: 2, type: "trial", name: "Trial 2", branches: [] },
        ],
        ...(parentType === "trial"
          ? { getTrial: vi.fn(async () => lookupResult) }
          : { getLoop: vi.fn(async () => lookupResult) }),
      });
      const view = render(<Canvas />);

      await act(async () => {
        await mocks.flowLayoutProps.onAddBranch(parentId);
      });
      fireEvent.click(screen.getByText("As Parent (Sequential)"));

      await waitFor(() => {
        expect(mocks.trialsContext.createTrial).toHaveBeenCalledWith(
          expect.objectContaining({ branches: [] }),
        );
      });
      view.unmount();
    };

    await runScenario("trial", undefined);
    await runScenario("trial", makeTrial(1, { branches: undefined }));
    await runScenario("loop", undefined);
    await runScenario("loop", makeLoop("loop-1", { branches: undefined }));
  });

  it("appends a colliding parent result and normalizes its missing branches", async () => {
    installTrialsContext({
      createTrial: vi.fn(async () => ({ id: 1, name: "Colliding Parent" })),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("As Parent (Sequential)"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTimeline).toHaveBeenCalled();
    });
    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expect(reorderedTimeline.map((item: any) => item.id)).toEqual([2, 3, 1]);
    expectTimelineItem(reorderedTimeline.at(-1), {
      id: 1,
      branches: [],
    });
  });

  it("moves a selected trial sequentially and reconnects its previous parent", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2),
      timeline: [
        { id: 1, type: "trial", name: "Trial 1", branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
      ],
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 3"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(1, {
        branches: [],
      });
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(2, {
      branches: [],
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(3, {
      branches: [2],
    });

    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expect(reorderedTimeline.map((item: any) => item.id)).toEqual([1, 3, 2]);
  });

  it("moves a selected trial as a parallel branch of a branched destination", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(3),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 1"));
    fireEvent.click(screen.getByText("Branch (Parallel)"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(3, {
        branches: [],
      });
    });
    expect(mocks.trialsContext.getTrial).toHaveBeenCalledWith(1);
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(1, {
      branches: [2, 3],
    });

    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expect(reorderedTimeline.map((item: any) => item.id)).toEqual([1, 3, 2]);
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
      const destinationId = destinationType === "trial" ? 3 : "loop-1";
      const destination =
        destinationType === "trial"
          ? { id: 3, type: "trial", name: "Trial 3", branches: [9] }
          : {
              id: "loop-1",
              type: "loop",
              name: "Loop 1",
              trials: [1],
              branches: [9],
            };
      const lookupResult =
        lookupState === "missing"
          ? undefined
          : destinationType === "trial"
            ? makeTrial(3, { branches: undefined })
            : makeLoop("loop-1", { branches: undefined });

      installTrialsContext({
        selectedTrial: makeTrial(2),
        timeline: [
          { id: 2, type: "trial", name: "Trial 2", branches: [] },
          destination,
        ],
        ...(destinationType === "trial"
          ? { getTrial: vi.fn(async () => lookupResult) }
          : { getLoop: vi.fn(async () => lookupResult) }),
      });
      render(<Canvas />);

      fireEvent.click(screen.getByTitle("Move Item"));
      fireEvent.click(screen.getByText(destination.name));
      fireEvent.click(
        screen.getByText(
          mode === "branch" ? "Branch (Parallel)" : "Sequential",
        ),
      );
      fireEvent.click(screen.getByText("Move"));

      await waitFor(() => {
        expect(mocks.trialsContext.updateTimeline).toHaveBeenCalled();
      });

      const destinationUpdater =
        destinationType === "trial"
          ? mocks.trialsContext.updateTrial
          : mocks.trialsContext.updateLoop;
      if (lookupState === "missing") {
        expect(
          destinationUpdater.mock.calls.some(
            ([id]: [number | string]) => id === destinationId,
          ),
        ).toBe(false);
      } else {
        expect(destinationUpdater).toHaveBeenCalledWith(destinationId, {
          branches: [2],
        });
      }
    },
  );

  it("moves selected loops into loop destinations in branch and sequential modes", async () => {
    installTrialsContext({
      selectedLoop: makeLoop("loop-child", { name: "Child Loop", branches: [8] }),
      timeline: [
        { id: "loop-child", type: "loop", name: "Child Loop", trials: [8], branches: [8] },
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [1], branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 8, type: "trial", name: "Trial 8", branches: [] },
      ],
    });
    const firstRender = render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Loop 1"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-child", {
        branches: [],
      });
    });
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-1", {
      branches: ["loop-child"],
    });
    firstRender.unmount();
  });

  it("does not open the move modal when the selected item is absent from the timeline", () => {
    installTrialsContext({
      selectedTrial: makeTrial(404, { name: "Missing Trial" }),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));

    expect(screen.queryByText("No available destinations")).not.toBeInTheDocument();
  });

  it("reconnects children and updates a loop parent when moving a trial", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2, { branches: [3] }),
      timeline: [
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [2], branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [3] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
        { id: 4, type: "trial", name: "Trial 4", branches: [] },
      ],
      getTrial: vi.fn(async (id: number | string) =>
        makeTrial(Number(id), { branches: id === 2 ? [3] : [] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 4"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-1", {
        branches: [3],
      });
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(2, {
      branches: [],
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(4, {
      branches: [2],
    });
  });

  it("does not duplicate a reconnected child already owned by the parent", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2, { branches: [3] }),
      timeline: [
        { id: 1, type: "trial", name: "Trial 1", branches: [2, 3] },
        { id: 2, type: "trial", name: "Trial 2", branches: [3] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
        { id: 4, type: "trial", name: "Trial 4", branches: [] },
      ],
      getTrial: vi.fn(async (id: number | string) =>
        makeTrial(Number(id), { branches: [] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 4"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(1, {
        branches: [3],
      });
    });
  });

  it("moves an item that disappears from a refreshed timeline", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2),
      timeline: [
        { id: 1, type: "trial", name: "Trial 1", branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
      ],
    });
    const { rerender } = render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 3"));
    mocks.trialsContext.timeline = [
      { id: 1, type: "trial", name: "Trial 1", branches: [2] },
      { id: 3, type: "trial", name: "Trial 3", branches: [] },
    ];
    rerender(<Canvas />);
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTimeline).toHaveBeenCalled();
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(1, {
      branches: [],
    });
    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expect(reorderedTimeline.map((item: any) => item.id)).toEqual([1, 3, 2]);
  });

  it("moves a selected loop sequentially behind a trial destination", async () => {
    installTrialsContext({
      selectedLoop: makeLoop("loop-child", { name: "Child Loop", branches: [8] }),
      timeline: [
        { id: "loop-child", type: "loop", name: "Child Loop", trials: [8], branches: [8] },
        { id: 4, type: "trial", name: "Trial 4", branches: [5] },
        { id: 5, type: "trial", name: "Trial 5", branches: [] },
      ],
      getTrial: vi.fn(async (id: number | string) =>
        makeTrial(Number(id), { branches: id === 4 ? [5] : [] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 4"));
    fireEvent.click(screen.getByText("Sequential"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-child", {
        branches: [5],
      });
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(4, {
      branches: ["loop-child"],
    });
  });

  it("moves a selected loop sequentially behind a loop destination", async () => {
    installTrialsContext({
      selectedLoop: makeLoop("loop-child", { name: "Child Loop", branches: [8] }),
      timeline: [
        { id: "loop-child", type: "loop", name: "Child Loop", trials: [8], branches: [8] },
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [1], branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
      ],
      getLoop: vi.fn(async (id: number | string) =>
        makeLoop(String(id), { branches: id === "loop-1" ? [2] : [8] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Loop 1"));
    fireEvent.click(screen.getByText("Sequential"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-child", {
        branches: [2],
      });
    });
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-1", {
      branches: ["loop-child"],
    });
  });

  it("moves a selected trial sequentially behind a loop destination", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(3),
      timeline: [
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
        { id: "loop-1", type: "loop", name: "Loop 1", trials: [1], branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
      ],
      getLoop: vi.fn(async (id: number | string) =>
        makeLoop(String(id), { branches: [2] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Loop 1"));
    fireEvent.click(screen.getByText("Sequential"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(3, {
        branches: [2],
      });
    });
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-1", {
      branches: [3],
    });
  });

  it("logs move failures and missing destinations", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      selectedTrial: makeTrial(2),
      timeline: [
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
      ],
      updateTrial: vi.fn(async () => {
        throw new Error("move update failed");
      }),
    });
    const { rerender } = render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 3"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error moving item:",
        expect.any(Error),
      );
    });

    installTrialsContext({
      selectedTrial: makeTrial(2),
      timeline: [
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
      ],
    });
    rerender(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 3"));
    mocks.trialsContext.timeline = [
      { id: 2, type: "trial", name: "Trial 2", branches: [] },
    ];
    rerender(<Canvas />);
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Destination item not found");
    });
  });

  it("ignores loop-stack navigation while the opened loop is at root", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });
    const callsBeforeNavigation = mocks.trialsContext.getLoop.mock.calls.length;

    fireEvent.click(await screen.findByText("Navigate First Loop"));

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledTimes(
      callsBeforeNavigation,
    );
  });

  it("reuses the loop stack when a nested cycle reaches an existing loop", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });
    fireEvent.click(await screen.findByText("Open Nested Loop"));
    await waitFor(() => {
      expect(screen.getByTestId("sub-canvas")).toHaveTextContent(
        "loop-child Child Loop",
      );
    });

    fireEvent.click(screen.getByText("Open Root Nested"));
    await waitFor(() => {
      expect(screen.getByTestId("sub-canvas")).toHaveTextContent(
        "loop-1 Loop 1",
      );
    });

    fireEvent.click(screen.getByText("Open Nested Loop"));
    await waitFor(() => {
      expect(screen.getByTestId("sub-canvas")).toHaveTextContent(
        "loop-child Child Loop",
      );
    });
  });

  it("does not select a nested loop when its follow-up lookup disappears", async () => {
    let childLookups = 0;
    installTrialsContext({
      getLoop: vi.fn(async (id: number | string) => {
        if (id === "loop-child") {
          childLookups += 1;
          return childLookups === 1 ? makeLoop("loop-child") : undefined;
        }
        return makeLoop(String(id));
      }),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });
    fireEvent.click(await screen.findByText("Open Nested Loop"));

    await waitFor(() => {
      expect(childLookups).toBe(2);
    });
    expect(mocks.trialsContext.setSelectedLoop).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-child" }),
    );
  });

  it("handles open SubCanvas refresh, selection, nested navigation and root close", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });

    fireEvent.click(await screen.findByText("Refresh Loop"));
    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenLastCalledWith(
      "loop-1",
      true,
      true,
    );

    fireEvent.click(screen.getByText("Select Inner Trial"));
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
    );
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText("Select Inner Loop"));
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-child" }),
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByText("Open Nested Loop"));
    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-child");
    });

    const loopCallsBeforeSecondNestedOpen =
      mocks.trialsContext.getLoop.mock.calls.length;
    fireEvent.click(screen.getByText("Open Nested Loop"));
    await waitFor(() => {
      expect(mocks.trialsContext.getLoop.mock.calls.length).toBeGreaterThan(
        loopCallsBeforeSecondNestedOpen,
      );
    });

    fireEvent.click(screen.getByText("Navigate First Loop"));
    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-1");
    });

    fireEvent.click(screen.getByText("Navigate Root"));
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenLastCalledWith(null);
  });

  it("opens branch configuration for a selected loop and closes a root SubCanvas", async () => {
    installTrialsContext({
      selectedLoop: makeLoop("loop-1", { parentLoopId: "parent-loop" }),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Branches"));
    expect(await screen.findByTestId("branched-modal")).toHaveTextContent(
      "Loop 1",
    );
    await waitFor(() => {
      expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith(
        "parent-loop",
      );
    });

    fireEvent.click(screen.getByText("Close Branch Modal"));
    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });

    fireEvent.click(await screen.findByText("Close SubCanvas"));
    await waitFor(() => {
      expect(screen.queryByTestId("sub-canvas")).not.toBeInTheDocument();
    });
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenLastCalledWith(null);
  });

  it("returns to the previous loop when closing a nested SubCanvas", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onOpenLoop("loop-1");
    });

    fireEvent.click(await screen.findByText("Open Nested Loop"));
    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-child");
    });

    fireEvent.click(screen.getByText("Close SubCanvas"));

    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-1");
    });
  });
});
