import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Canvas from "../../../pages/ExperimentBuilder/components/Canvas";
import {
  bindCanvasMocks,
  expectTimelineItem,
  installTrialsContext,
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

  it("adds direct and parent trials to loop nodes", async () => {
    installTrialsContext({
      timeline: [
        {
          id: "loop-1",
          type: "loop",
          name: "Loop 1",
          trials: [1],
          branches: [],
        },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
      ],
    });
    const firstRender = render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch("loop-1");
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop-1");
    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
      "loop-1",
      { branches: [99] },
      expect.objectContaining({ id: 99 }),
    );
    firstRender.unmount();

    installTrialsContext({
      timeline: [
        {
          id: "loop-1",
          type: "loop",
          name: "Loop 1",
          trials: [1],
          branches: [2],
        },
        { id: 2, type: "trial", name: "Trial 2", branches: [] },
      ],
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch("loop-1");
    });
    fireEvent.click(screen.getByText("As Parent (Sequential)"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop-1",
        { branches: [99] },
        expect.objectContaining({ id: 99, branches: [] }),
      );
    });
  });

  it("closes add-trial and move-item modals without confirming", async () => {
    installTrialsContext({
      selectedTrial: makeTrial(2),
    });
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Add New Trial")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Move Item"));
    expect(screen.getByText("Move Item")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Move Item")).not.toBeInTheDocument();
  });

  it("inserts a new trial as parent of existing branches", async () => {
    render(<Canvas />);

    await act(async () => {
      await mocks.flowLayoutProps.onAddBranch(1);
    });

    fireEvent.click(screen.getByText("As Parent (Sequential)"));

    await waitFor(() => {
      expect(mocks.trialsContext.createTrial).toHaveBeenCalledWith({
        type: "Trial",
        name: "New Trial",
        plugin: "plugin-dynamic",
        parameters: {},
        trialCode: "",
        branches: [2],
      });
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
      1,
      { branches: [99] },
      expect.objectContaining({ id: 99, branches: [2] }),
    );

    const reorderedTimeline =
      mocks.trialsContext.updateTimeline.mock.calls.at(-1)?.[0];
    expectTimelineItem(reorderedTimeline?.[0], { id: 1, branches: [99] });
    expectTimelineItem(reorderedTimeline?.[1], {
      id: 99,
      type: "trial",
      branches: [2],
    });
  });
});
