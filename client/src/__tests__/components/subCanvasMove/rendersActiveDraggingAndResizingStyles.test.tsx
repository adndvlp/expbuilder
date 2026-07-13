import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trial } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import {
  installTrialsContext,
  getMocks,
  renderSubCanvas,
  renderSparseDestinationScenario,
  selectedTrial,
} from "./testHarness";

const mocks = getMocks();

describe("SubCanvas move flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installTrialsContext();
    mocks.moveModalProps = undefined;
    mocks.dragging = false;
    mocks.resizing = false;
  });

  it("renders active dragging and resizing styles", () => {
    mocks.dragging = true;
    mocks.resizing = true;

    const { container } = renderSubCanvas();
    const surface = container.firstElementChild as HTMLElement;

    expect(surface.style.userSelect).toBe("none");
    expect(surface.style.transition).toBe("none");
  });

  it("moves a branched trial as a branch and reconnects its children to the old parent", async () => {
    const { onRefreshMetadata } = renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));

    expect(screen.getByTestId("move-modal")).toBeInTheDocument();
    expect(mocks.moveModalProps.availableDestinations).toEqual([
      { id: 10, name: "Parent", type: "trial", hasBranches: true },
      { id: 12, name: "Destination", type: "trial", hasBranches: false },
      { id: 13, name: "Child", type: "trial", hasBranches: false },
    ]);

    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(10, {
        branches: [12, 13],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        branches: [],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(12, {
        branches: [11],
      });
    });

    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_parent", {
      trials: [10, 12],
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
      parentLoopId: "loop_parent",
    });
    expect(mocks.trialsContext.updateTimeline).not.toHaveBeenCalled();
    expect(onRefreshMetadata).toHaveBeenCalled();
  });

  it("moves a trial whose refreshed timeline omits its branches", async () => {
    const sparseTimeline: TimelineItem[] = [
      { id: 10, type: "trial", name: "Parent", branches: [11, 12] },
      { id: 11, type: "trial", name: "Move Me" },
      { id: 12, type: "trial", name: "Destination", branches: [] },
    ];
    renderSubCanvas({ loopTimeline: sparseTimeline });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(10, {
        branches: [12],
      });
    });
  });

  it("does not duplicate a child already reconnected to the old parent", async () => {
    const duplicateChildTimeline: TimelineItem[] = [
      { id: 10, type: "trial", name: "Parent", branches: [11, 13] },
      { id: 11, type: "trial", name: "Move Me", branches: [13] },
      { id: 12, type: "trial", name: "Destination", branches: [] },
      { id: 13, type: "trial", name: "Child", branches: [] },
    ];
    renderSubCanvas({ loopTimeline: duplicateChildTimeline });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(10, {
        branches: [13],
      });
    });
  });

  it("moves a trial as parent of the destination branches", async () => {
    mocks.trialsContext.getTrial.mockImplementation(
      async (id: string | number) => {
        if (id === 12) {
          return {
            id: 12,
            type: "Trial",
            name: "Destination",
            plugin: "plugin-dynamic",
            parameters: {},
            trialCode: "",
            branches: [13],
          } as Trial;
        }
        return {
          id,
          type: "Trial",
          name: String(id),
          plugin: "plugin-dynamic",
          parameters: {},
          trialCode: "",
          branches: id === 10 ? [11, 12] : [13],
        } as Trial;
      },
    );

    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as parent"));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        branches: [13],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(12, {
        branches: [11],
      });
    });

    expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("loop_parent", {
      trials: [10, 12],
    });
    expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
      parentLoopId: "loop_parent",
    });
    expect(mocks.trialsContext.updateTimeline).not.toHaveBeenCalled();
  });

  it.each([
    ["branch", "trial", "missing"],
    ["branch", "trial", "without branches"],
    ["branch", "loop", "missing"],
    ["branch", "loop", "without branches"],
    ["sequential", "trial", "missing"],
    ["sequential", "trial", "without branches"],
    ["sequential", "loop", "missing"],
    ["sequential", "loop", "without branches"],
  ] as const)(
    "moves with a %s %s destination whose lookup is %s",
    async (mode, destinationType, lookupState) => {
      const destinationId = renderSparseDestinationScenario(
        destinationType,
        lookupState,
      );

      fireEvent.click(screen.getByTitle("Move Trial/Loop"));
      await act(async () => {
        await mocks.moveModalProps.onConfirm(destinationId, mode === "branch");
      });

      const destinationUpdater =
        destinationType === "trial"
          ? mocks.trialsContext.updateTrial
          : mocks.trialsContext.updateLoop;
      if (lookupState === "missing") {
        expect(
          destinationUpdater.mock.calls.some(
            (call: any[]) => call[0] === destinationId,
          ),
        ).toBe(false);
      } else {
        expect(destinationUpdater).toHaveBeenCalledWith(destinationId, {
          branches: [11],
        });
      }
    },
  );

  it("finishes a move when the parent loop lookup is empty", async () => {
    mocks.trialsContext.getLoop = vi.fn(async () => null);
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_parent");
    });
    expect(mocks.trialsContext.updateLoop).not.toHaveBeenCalled();
  });

  it("leaves direct loop children unchanged when the moved id is absent", async () => {
    mocks.trialsContext.getLoop = vi.fn(async () => ({
      id: "loop_parent",
      name: "Parent Loop",
      trials: [10, 12],
    }));
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    fireEvent.click(screen.getByText("Move as branch"));

    await waitFor(() => {
      expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_parent");
    });
    expect(mocks.trialsContext.updateLoop).not.toHaveBeenCalled();
  });

  it("does not open the move modal when the selected item is not in the loop timeline", () => {
    renderSubCanvas({
      selectedTrial: {
        ...selectedTrial,
        id: 999,
        name: "Missing Trial",
      } as Trial,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));

    expect(screen.queryByTestId("move-modal")).not.toBeInTheDocument();
  });
});
