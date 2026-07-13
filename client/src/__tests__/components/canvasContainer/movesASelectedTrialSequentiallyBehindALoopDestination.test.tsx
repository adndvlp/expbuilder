import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../../pages/ExperimentBuilder/components/Canvas";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  flowLayoutProps: undefined as any,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout",
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
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
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

vi.mock("../../../pages/ExperimentBuilder/components/Canvas/SubCanvas", () => ({
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

  it("moves a selected trial sequentially behind a loop destination", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(3),
      timeline: [
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
        {
          id: "loop-1",
          type: "loop",
          name: "Loop 1",
          trials: [1],
          branches: [2],
        },
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
});
