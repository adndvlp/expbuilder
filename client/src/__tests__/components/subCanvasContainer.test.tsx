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

  render(<SubCanvas {...props} />);
  return props;
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
});
