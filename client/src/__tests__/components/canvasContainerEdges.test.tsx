import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../pages/ExperimentBuilder/components/Canvas";

const edgeMocks = vi.hoisted(() => ({
  trialsContext: {} as any,
  flowLayoutProps: undefined as any,
  loopRangeIds: [] as Array<number | string>,
  moveDestinationId: undefined as number | string | undefined,
  moveAddAsBranch: false,
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => edgeMocks.trialsContext,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout",
  () => ({
    useFlowLayout: (props: any) => {
      edgeMocks.flowLayoutProps = props;
      return {
        nodes: [],
        edges: [],
      };
    },
  }),
);

vi.mock("reactflow", () => ({
  default: ({ onPaneClick }: { onPaneClick: () => void }) => (
    <button type="button" onClick={onPaneClick}>
      mock pane
    </button>
  ),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial",
  () => ({
    default: () => <div data-testid="mock-branched-trial" />,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/LoopRangeModal",
  () => ({
    default: ({ onConfirm, onClose }: any) => (
      <div data-testid="mock-loop-range">
        <button type="button" onClick={() => onConfirm(edgeMocks.loopRangeIds)}>
          confirm loop range
        </button>
        <button type="button" onClick={onClose}>
          close loop range
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/components/MoveItemModal",
  () => ({
    default: ({ onConfirm, onClose, itemName }: any) => (
      <div data-testid="mock-move-item">
        <span>moving {itemName}</span>
        <button
          type="button"
          onClick={() =>
            onConfirm(edgeMocks.moveDestinationId, edgeMocks.moveAddAsBranch)
          }
        >
          confirm move edge
        </button>
        <button type="button" onClick={onClose}>
          close move edge
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/Canvas/components/CanvasToolbar",
  () => ({
    default: ({ onCreateLoop, onAddTrial, onMoveItem }: any) => (
      <div data-testid="mock-canvas-toolbar">
        <button type="button" onClick={onCreateLoop}>
          toolbar loop
        </button>
        <button type="button" onClick={onAddTrial}>
          toolbar trial
        </button>
        {onMoveItem && (
          <button type="button" onClick={onMoveItem}>
            toolbar move
          </button>
        )}
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

function installTrialsContext(overrides: Partial<any> = {}) {
  edgeMocks.trialsContext = {
    timeline: [],
    loopTimeline: [],
    selectedTrial: null,
    setSelectedTrial: vi.fn(),
    selectedLoop: null,
    setSelectedLoop: vi.fn(),
    createTrial: vi.fn(async (data: any) => ({
      id: 99,
      type: "trial",
      branches: data.branches || [],
      ...data,
    })),
    createLoop: vi.fn(async (data: any) => ({
      id: "loop-new",
      type: "loop",
      ...data,
    })),
    getTrial: vi.fn(async (id: number | string) => makeTrial(Number(id))),
    getLoop: vi.fn(async (id: number | string) => ({
      id,
      type: "loop",
      name: `Loop ${id}`,
      trials: [],
      branches: [],
    })),
    updateTrial: vi.fn(async () => true),
    updateLoop: vi.fn(async () => true),
    updateTimeline: vi.fn(async () => true),
    getLoopTimeline: vi.fn(async () => []),
    ...overrides,
  };
}

describe("Canvas container edge harness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    edgeMocks.loopRangeIds = [];
    edgeMocks.moveDestinationId = undefined;
    edgeMocks.moveAddAsBranch = false;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    installTrialsContext();
  });

  it("handles empty loop confirmation and toolbar trial names with existing items", async () => {
    installTrialsContext({
      timeline: [
        { id: 1, type: "trial", name: "New Trial", branches: [] },
      ],
    });

    render(<Canvas />);

    fireEvent.click(screen.getByText("toolbar trial"));

    await waitFor(() => {
      expect(edgeMocks.trialsContext.createTrial).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Trial 1",
        }),
      );
    });

    fireEvent.click(screen.getByText("toolbar loop"));
    fireEvent.click(screen.getByText("confirm loop range"));

    expect(window.alert).toHaveBeenCalledWith(
      "You must select at least 1 trial/loop to create a loop.",
    );
    expect(edgeMocks.trialsContext.createLoop).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mock-loop-range")).not.toBeInTheDocument();
  });

  it("uses the reorder append fallback when a mocked move targets itself", async () => {
    edgeMocks.moveDestinationId = 2;
    installTrialsContext({
      selectedTrial: makeTrial(2, { branches: [3] }),
      timeline: [
        { id: 2, type: "trial", name: "Trial 2", branches: [3] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
      ],
      getTrial: vi.fn(async (id: number | string) =>
        makeTrial(Number(id), { branches: id === 2 ? [3] : [] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByText("toolbar move"));
    fireEvent.click(screen.getByText("confirm move edge"));

    await waitFor(() => {
      const reorderedTimeline =
        edgeMocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
      expect(reorderedTimeline.map((item: any) => item.id)).toEqual([3, 2]);
    });
  });
});
