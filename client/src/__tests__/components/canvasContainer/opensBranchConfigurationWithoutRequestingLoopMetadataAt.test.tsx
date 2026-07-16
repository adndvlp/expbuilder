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

  it("opens branch configuration without requesting loop metadata at root", async () => {
    installTrialsContext({ selectedTrial: makeTrial(1) });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Branches"));

    expect(await screen.findByTestId("branched-modal")).toHaveTextContent(
      "Trial 1",
    );
    expect(mocks.trialsContext.getLoopTimeline).not.toHaveBeenCalled();
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
      timeline: [{ id: "loop-1", type: "loop", name: "Loop 1", trials: [1] }],
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
});
