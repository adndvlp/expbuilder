import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../../pages/ExperimentBuilder/components/Canvas";
import {
  bindCanvasMocks,
  installTrialsContext,
  makeLoop,
  makeTrial,
  setupCanvasTest,
} from "./testHarness";

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
  default: () => null,
}));

bindCanvasMocks(mocks);

describe("Canvas container", () => {
  beforeEach(setupCanvasTest);

  it("moves selected loops into loop destinations in branch and sequential modes", async () => {
    installTrialsContext({
      selectedLoop: makeLoop("loop-child", {
        name: "Child Loop",
        branches: [8],
      }),
      timeline: [
        {
          id: "loop-child",
          type: "loop",
          name: "Child Loop",
          trials: [8],
          branches: [8],
        },
        {
          id: "loop-1",
          type: "loop",
          name: "Loop 1",
          trials: [1],
          branches: [2],
        },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 8, type: "trial", name: "Trial 8", branches: [] },
      ],
    });
    const firstRender = render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Loop 1"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop-child",
        {
          branches: [],
        },
      );
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

    expect(
      screen.queryByText("No available destinations"),
    ).not.toBeInTheDocument();
  });

  it("reconnects children and updates a loop parent when moving a trial", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2, { branches: [3] }),
      timeline: [
        {
          id: "loop-1",
          type: "loop",
          name: "Loop 1",
          trials: [2],
          branches: [2],
        },
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
});
