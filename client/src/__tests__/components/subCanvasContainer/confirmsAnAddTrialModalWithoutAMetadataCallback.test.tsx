import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SubCanvas from "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas";

const mocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  generateProps: undefined as any,
}));

vi.mock("../../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => mocks.trialsContext,
}));

vi.mock(
  "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges",
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
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
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
  "../../../pages/ExperimentBuilder/components/Canvas/components/AddTrialModal",
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

function renderSubCanvas(
  overrides: Partial<Parameters<typeof SubCanvas>[0]> = {},
) {
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
