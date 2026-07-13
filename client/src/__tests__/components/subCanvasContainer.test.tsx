import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SubCanvas from "../../pages/ExperimentBuilder/components/Canvas/SubCanvas";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  generateProps: undefined as any,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges",
  () => ({
    default: (props: any) => {
      mocks.generateProps = props;
      return {
        nodes: [{ id: "sub-node-1", position: { x: 0, y: 0 } }],
        edges: [],
      };
    },
  }),
);

vi.mock("reactflow", () => ({
  default: ({ onPaneClick }: { onPaneClick: () => void }) => (
    <div data-testid="sub-react-flow">
      <button type="button" onClick={onPaneClick}>
        Sub Pane
      </button>
    </div>
  ),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
  () => ({
    default: ({ selectedTrial, onClose }: any) => (
      <div data-testid="sub-branch-modal">
        Branch modal {selectedTrial?.name}
        <button type="button" onClick={onClose}>
          Close Branch Modal
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/components/AddTrialModal",
  () => ({
    default: ({ onConfirm, onClose, parentName }: any) => (
      <div data-testid="sub-add-trial-modal">
        Add trial for {parentName}
        <button type="button" onClick={() => onConfirm(true)}>
          Add as branch
        </button>
        <button type="button" onClick={() => onConfirm(false)}>
          Add as parent
        </button>
        <button type="button" onClick={onClose}>
          Close Add Trial
        </button>
      </div>
    ),
  }),
);

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
    name: id === "loop-new" ? "Nested Loop 1" : "Parent Loop",
    trials: [1, 2, 3],
    branches: [],
    csvJson: [{ stimulus: "A" }],
    ...overrides,
  };
}

const loopTimeline = [
  { id: 1, type: "trial", name: "Trial 1", branches: [2] },
  { id: 2, type: "trial", name: "Trial 2", branches: [] },
  { id: 3, type: "trial", name: "Trial 3", branches: [] },
];

function installTrialsContext(overrides: Partial<any> = {}) {
  const trialsById = new Map<number | string, any>([
    [1, makeTrial(1, { branches: [2] })],
    [2, makeTrial(2)],
    [3, makeTrial(3)],
  ]);
  const loopsById = new Map<number | string, any>([
    ["loop-main", makeLoop("loop-main")],
    ["loop-new", makeLoop("loop-new", { parentLoopId: "loop-main" })],
  ]);

  mocks.trialsContext = {
    timeline: loopTimeline,
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
    updateTrialField: vi.fn(async () => true),
    updateLoop: vi.fn(async () => makeLoop("loop-main")),
    updateTimeline: vi.fn(async () => true),
    ...overrides,
  };
}

function renderSubCanvas(overrides: Partial<Parameters<typeof SubCanvas>[0]> = {}) {
  const props = {
    loopId: "loop-main",
    loopName: "Main Loop",
    loopTimeline,
    onClose: vi.fn(),
    isDark: false,
    selectedTrial: makeTrial(1),
    selectedLoop: null,
    onSelectTrial: vi.fn(),
    onSelectLoop: vi.fn(),
    onOpenNestedLoop: vi.fn(),
    onRefreshMetadata: vi.fn(),
    loopStack: [{ id: "root-loop", name: "Root Loop" }],
    onNavigateToLoop: vi.fn(),
    onNavigateToRoot: vi.fn(),
    ...overrides,
  };

  const view = render(<SubCanvas {...props} />);
  return { ...props, ...view };
}

describe("SubCanvas container", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    installTrialsContext();
  });

  it("renders breadcrumbs, closes, and clears selection on pane click", () => {
    const props = renderSubCanvas();

    fireEvent.click(screen.getByText("Root Loop"));
    expect(props.onNavigateToLoop).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByTitle("Close"));
    expect(props.onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Sub Pane"));
    expect(props.onSelectTrial).toHaveBeenCalledWith(null);
    expect(props.onSelectLoop).toHaveBeenCalledWith(null);
  });

  it("opens branching configuration for the selected item", () => {
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Branches"));

    expect(screen.getByTestId("sub-branch-modal")).toHaveTextContent("Trial 1");
    fireEvent.click(screen.getByText("Close Branch Modal"));
    expect(screen.queryByTestId("sub-branch-modal")).not.toBeInTheDocument();
  });

  it("creates a nested loop from the selected range and refreshes metadata", async () => {
    const props = renderSubCanvas();

    fireEvent.click(screen.getByTitle("Create Nested Loop"));
    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to group these trials/loops into a nested loop?",
    );

    fireEvent.click(screen.getByLabelText("Trial 1"));
    fireEvent.click(screen.getByText("Confirm (2 items)"));

    await waitFor(() => {
      expect(mocks.trialsContext.createLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Nested Loop 1",
          parentLoopId: "loop-main",
          trials: [1, 2],
        }),
      );
    });
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-main", {
      trials: [3, "loop-new"],
    });
    expect(props.onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-new", name: "Nested Loop 1" }),
    );
    expect(props.onRefreshMetadata).toHaveBeenCalled();
  });

  it("adds a direct branch inside the loop when the parent has no existing branches", async () => {
    const props = renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch(3);
    });

    expect(mocks.trialsContext.createTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "Trial",
        name: "New Trial",
        parentLoopId: "loop-main",
      }),
    );
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      99,
      "csvFromLoop",
      true,
      false,
    );
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      3,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    expect(props.onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
    );
    expect(props.onRefreshMetadata).toHaveBeenCalled();
  });

  it("ignores branch requests for missing parent items", async () => {
    renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch("missing-parent");
    });

    expect(screen.queryByTestId("sub-add-trial-modal")).not.toBeInTheDocument();
    expect(mocks.trialsContext.createTrial).not.toHaveBeenCalled();
  });

  it("opens and closes the add-trial modal when the parent already has branches", async () => {
    renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch(1);
    });

    expect(screen.getByTestId("sub-add-trial-modal")).toHaveTextContent(
      "Trial 1",
    );
    fireEvent.click(screen.getByText("Close Add Trial"));

    expect(screen.queryByTestId("sub-add-trial-modal")).not.toBeInTheDocument();
  });

  it("adds a branch or parent from the add-trial modal and refreshes metadata", async () => {
    const props = renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Add as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        1,
        { branches: [2, 99] },
        expect.objectContaining({ id: 99 }),
      );
    });
    expect(props.onRefreshMetadata).toHaveBeenCalled();

    vi.clearAllMocks();
    installTrialsContext();
    renderSubCanvas();

    await act(async () => {
      await mocks.generateProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Add as parent"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        1,
        { branches: [99] },
        expect.objectContaining({ id: 99, branches: [2] }),
      );
    });
  });

  it("keeps zero-valued parent ids usable in the add-trial modal", async () => {
    const zeroTimeline = [
      { id: 0, type: "trial", name: "Zero Parent", branches: [1] },
      ...loopTimeline,
    ];
    installTrialsContext({
      getTrial: vi.fn(async (id: number | string) =>
        id === 0
          ? makeTrial(0, { name: "Zero Parent", branches: [1] })
          : makeTrial(Number(id), { branches: id === 1 ? [2] : [] }),
      ),
    });
    renderSubCanvas({ loopTimeline: zeroTimeline });

    await act(async () => {
      await mocks.generateProps.onAddBranch(0);
    });

    expect(screen.getByTestId("sub-add-trial-modal")).toHaveTextContent(
      "Zero Parent",
    );
    fireEvent.click(screen.getByText("Add as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        0,
        { branches: [1, 99] },
        expect.objectContaining({ id: 99 }),
      );
    });
  });

  it("reuses an existing current-loop breadcrumb and renders the dark surface", () => {
    const { container } = renderSubCanvas({
      isDark: true,
      loopStack: [{ id: "loop-main", name: "Main Loop" }],
    });

    expect(screen.getByText("Main Loop")).toBeInTheDocument();
    expect(
      (container.firstElementChild as HTMLElement).style.background,
    ).toContain("rgb(35, 39, 47)");
  });

  it("uses a selected loop for branching and nested-loop selection", () => {
    const zeroLoop = makeLoop("loop-new", {
      id: 0,
      name: "Zero Loop",
    }) as any;
    renderSubCanvas({
      loopTimeline: [
        { id: 0, type: "loop", name: "Zero Loop", branches: [] },
        ...loopTimeline,
      ],
      selectedTrial: null,
      selectedLoop: zeroLoop,
    });

    fireEvent.click(screen.getByTitle("Branches"));
    expect(screen.getByTestId("sub-branch-modal")).toHaveTextContent(
      "Zero Loop",
    );
    fireEvent.click(screen.getByText("Close Branch Modal"));

    fireEvent.click(screen.getByTitle("Create Nested Loop"));
    expect(
      screen.getByText("Select trials/loops for loop"),
    ).toBeInTheDocument();
  });

  it("adds a branch without metadata callbacks when branches are omitted", async () => {
    const sparseTimeline = [{ id: 3, type: "trial", name: "Trial 3" }];
    installTrialsContext({
      getTrial: vi.fn(async () => makeTrial(3, { branches: undefined })),
    });
    renderSubCanvas({
      loopTimeline: sparseTimeline as any,
      onRefreshMetadata: undefined,
    });

    await act(async () => {
      await mocks.generateProps.onAddBranch(3);
    });

    expect(mocks.trialsContext.createTrial).toHaveBeenCalled();
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      3,
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
  });

  it("confirms an add-trial modal without a metadata callback", async () => {
    renderSubCanvas({ onRefreshMetadata: undefined });

    await act(async () => {
      await mocks.generateProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Add as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        1,
        { branches: [2, 99] },
        expect.objectContaining({ id: 99 }),
      );
    });
  });
});
