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
});
