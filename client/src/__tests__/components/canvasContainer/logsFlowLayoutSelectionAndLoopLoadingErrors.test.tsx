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

  it("logs flow-layout selection and loop loading errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext({
      getTrial: vi.fn(async () => {
        throw new Error("trial read failed");
      }),
      getLoop: vi.fn(async () => {
        throw new Error("loop read failed");
      }),
      getLoopTimeline: vi.fn(async () => {
        throw new Error("loop timeline failed");
      }),
    });

    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onSelectTrial({ id: 1 });
      await mocks.flowLayoutProps.onSelectLoop({ id: "loop-1" });
      await mocks.flowLayoutProps.onToggleLoop(
        { id: "loop-1", type: "loop", name: "Loop 1" },
        null,
      );
    });

    expect(console.error).toHaveBeenCalledWith(
      "Error fetching full trial data:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching full loop data:",
      expect.any(Error),
    );
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error loading loop:",
        expect.any(Error),
      );
    });
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
      await mocks.flowLayoutProps.onToggleLoop(
        { id: "missing-loop", type: "loop", name: "Missing Loop" },
        null,
      );
    });

    expect(screen.getAllByTestId("react-flow")).toHaveLength(1);
    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith(
      "missing-loop",
      true,
      false,
      true,
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(null);
  });

  it("keeps loop-scoped selection and nested expansion in one ReactFlow", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(1, { parentLoopId: "loop-1" }),
      timeline: [
        { id: "loop-1", type: "loop", name: "Loop 1", branches: [] },
        { id: "outside", type: "trial", name: "Outside", branches: [] },
      ],
      getLoopTimeline: vi.fn(async (id: string | number) =>
        id === "loop-1"
          ? [
              { id: 1, type: "trial", name: "Trial 1", branches: [] },
              {
                id: "loop-child",
                type: "loop",
                name: "Child Loop",
                branches: [],
              },
            ]
          : [],
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Branches"));

    expect(await screen.findByTestId("branched-modal")).toHaveTextContent(
      "Trial 1",
    );
    expect(mocks.trialsContext.getLoopTimeline).not.toHaveBeenCalled();

    await act(async () => {
      await mocks.flowLayoutProps.onToggleLoop(
        { id: "loop-1", type: "loop", name: "Loop 1" },
        null,
      );
    });

    expect(screen.getAllByTestId("react-flow")).toHaveLength(1);
    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith(
      "loop-1",
      true,
      false,
      true,
    );

    await act(async () => {
      await mocks.flowLayoutProps.onToggleLoop(
        { id: "loop-child", type: "loop", name: "Child Loop" },
        "loop-1",
      );
    });
    await act(async () => {
      await mocks.flowLayoutProps.onSelectLoop(
        { id: "loop-child", type: "loop", name: "Child Loop" },
        "loop-child",
      );
    });

    expect(mocks.trialsContext.getLoopTimeline).toHaveBeenCalledWith(
      "loop-child",
      true,
      false,
      true,
    );
    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-child");
    expect(mocks.trialsContext.setSelectedLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop-child" }),
    );
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
  });
});
