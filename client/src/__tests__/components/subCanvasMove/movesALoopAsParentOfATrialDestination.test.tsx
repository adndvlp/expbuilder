import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Loop,
  Trial,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import {
  installTrialsContext,
  getMocks,
  renderSubCanvas,
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

  it("moves a loop as parent of a trial destination", async () => {
    const loopMoveTimeline: TimelineItem[] = [
      { id: "move-loop", type: "loop", name: "Move Loop", branches: [] },
      { id: 12, type: "trial", name: "Destination Trial", branches: [] },
    ];
    const selectedLoop = {
      id: "move-loop",
      name: "Move Loop",
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      orderColumns: [],
      categories: false,
      categoryColumn: "",
      categoryData: [],
      trials: [],
      branches: [],
      code: "",
    } as unknown as Loop;
    mocks.trialsContext.getTrial.mockImplementation(
      async (id: string | number) =>
        id === 12
          ? ({
              id: 12,
              type: "Trial",
              name: "Destination Trial",
              plugin: "plugin-dynamic",
              parameters: {},
              trialCode: "",
              branches: ["dest-child"],
            } as unknown as Trial)
          : null,
    );
    mocks.trialsContext.getLoop.mockImplementation(
      async (id: string | number) => {
        if (id === "loop_parent") {
          return {
            id: "loop_parent",
            name: "Parent Loop",
            repetitions: 1,
            randomize: false,
            orders: false,
            stimuliOrders: [],
            orderColumns: [],
            categories: false,
            categoryColumn: "",
            categoryData: [],
            trials: ["move-loop", 12],
            code: "",
          } as unknown as Loop;
        }
        return selectedLoop;
      },
    );

    renderSubCanvas({
      loopTimeline: loopMoveTimeline,
      selectedTrial: null,
      selectedLoop,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm(12, false);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        branches: ["dest-child"],
      });
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(12, {
        branches: ["move-loop"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: [12] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        parentLoopId: "loop_parent",
      });
    });
  });

  it("moves a trial as parent of a loop destination", async () => {
    const mixedTimeline: TimelineItem[] = [
      { id: 11, type: "trial", name: "Move Me", branches: [] },
      { id: "dest-loop", type: "loop", name: "Destination Loop", branches: [] },
    ];
    mocks.trialsContext.getLoop.mockImplementation(
      async (id: string | number) => {
        if (id === "dest-loop") {
          return {
            id: "dest-loop",
            name: "Destination Loop",
            repetitions: 1,
            randomize: false,
            orders: false,
            stimuliOrders: [],
            orderColumns: [],
            categories: false,
            categoryColumn: "",
            categoryData: [],
            trials: [],
            branches: ["dest-child"],
            code: "",
          } as unknown as Loop;
        }
        if (id === "loop_parent") {
          return {
            id: "loop_parent",
            name: "Parent Loop",
            repetitions: 1,
            randomize: false,
            orders: false,
            stimuliOrders: [],
            orderColumns: [],
            categories: false,
            categoryColumn: "",
            categoryData: [],
            trials: [11, "dest-loop"],
            code: "",
          } as unknown as Loop;
        }
        return null;
      },
    );

    renderSubCanvas({
      loopTimeline: mixedTimeline,
      selectedTrial: {
        ...selectedTrial,
        branches: [],
      } as Trial,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("dest-loop", false);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        branches: ["dest-child"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("dest-loop", {
        branches: [11],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: ["dest-loop"] },
      );
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(11, {
        parentLoopId: "loop_parent",
      });
    });
  });

  it("logs errors thrown while moving an item", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const moveError = new Error("move failed");
    mocks.trialsContext.updateTrial.mockRejectedValueOnce(moveError);
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm(12, true);
    });

    expect(consoleError).toHaveBeenCalledWith("Error moving item:", moveError);
  });
});
