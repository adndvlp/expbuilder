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

bindCanvasMocks(mocks);

describe("Canvas container", () => {
  beforeEach(setupCanvasTest);

  it("moves an item that disappears from a refreshed timeline", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2),
      timeline: [
        { id: 1, type: "trial", name: "Trial 1", branches: [2] },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
        { id: 3, type: "trial", name: "Trial 3", branches: [] },
      ],
    });
    const { rerender } = render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 3"));
    mocks.trialsContext.timeline = [
      { id: 1, type: "trial", name: "Trial 1", branches: [2] },
      { id: 3, type: "trial", name: "Trial 3", branches: [] },
    ];
    rerender(<Canvas />);
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTimeline).toHaveBeenCalled();
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(1, {
      branches: [],
    });
    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expect(reorderedTimeline.map((item: any) => item.id)).toEqual([1, 3, 2]);
  });

  it("moves a selected loop sequentially behind a trial destination", async () => {
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
        { id: 4, type: "trial", name: "Trial 4", branches: [5] },
        { id: 5, type: "trial", name: "Trial 5", branches: [] },
      ],
      getTrial: vi.fn(async (id: number | string) =>
        makeTrial(Number(id), { branches: id === 4 ? [5] : [] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Trial 4"));
    fireEvent.click(screen.getByText("Sequential"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop-child",
        {
          branches: [5],
        },
      );
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(4, {
      branches: ["loop-child"],
    });
  });

  it("moves a selected loop sequentially behind a loop destination", async () => {
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
      ],
      getLoop: vi.fn(async (id: number | string) =>
        makeLoop(String(id), { branches: id === "loop-1" ? [2] : [8] }),
      ),
    });

    render(<Canvas />);

    fireEvent.click(screen.getByTitle("Move Item"));
    fireEvent.click(screen.getByText("Loop 1"));
    fireEvent.click(screen.getByText("Sequential"));
    fireEvent.click(screen.getByText("Move"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop-child",
        {
          branches: [2],
        },
      );
    });
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop-1", {
      branches: ["loop-child"],
    });
  });
});
