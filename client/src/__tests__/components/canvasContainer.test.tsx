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
    onClose,
    onOpenNestedLoop,
  }: {
    loopId: string;
    loopName: string;
    onClose: () => void;
    onOpenNestedLoop: (id: string) => void;
  }) => (
    <div data-testid="sub-canvas">
      SubCanvas {loopId} {loopName}
      <button type="button" onClick={() => onOpenNestedLoop("loop-child")}>
        Open Nested Loop
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
});
