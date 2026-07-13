import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Loop } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import { installTrialsContext, getMocks, renderSubCanvas } from "./testHarness";

const mocks = getMocks();

describe("SubCanvas move flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installTrialsContext();
    mocks.moveModalProps = undefined;
    mocks.dragging = false;
    mocks.resizing = false;
  });

  it("closes the move modal without moving anything", () => {
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    expect(screen.getByTestId("move-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close Move"));

    expect(screen.queryByTestId("move-modal")).not.toBeInTheDocument();
    expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
  });

  it("logs and stops when the move destination is missing", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    renderSubCanvas();

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("missing-destination", true);
    });

    expect(consoleError).toHaveBeenCalledWith("Destination item not found");
  });

  it("moves a loop as a branch of another loop destination", async () => {
    const loopMoveTimeline: TimelineItem[] = [
      {
        id: "parent-loop",
        type: "loop",
        name: "Branch Parent Loop",
        branches: ["move-loop", "dest-loop"],
      },
      {
        id: "move-loop",
        type: "loop",
        name: "Move Loop",
        branches: ["child-trial"],
      },
      {
        id: "dest-loop",
        type: "loop",
        name: "Destination Loop",
        branches: [],
      },
      { id: "child-trial", type: "trial", name: "Child Trial", branches: [] },
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
      trials: ["child-trial"],
      branches: ["child-trial"],
      code: "",
      parentLoopId: "loop_parent",
    } as unknown as Loop;
    const loops = new Map<string | number, Loop>([
      [
        "loop_parent",
        {
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
          trials: ["parent-loop", "move-loop", "dest-loop"],
          code: "",
        } as unknown as Loop,
      ],
      [
        "dest-loop",
        {
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
          branches: ["existing-branch"],
          code: "",
        } as unknown as Loop,
      ],
      ["move-loop", selectedLoop],
      [
        "parent-loop",
        {
          id: "parent-loop",
          name: "Branch Parent Loop",
          repetitions: 1,
          randomize: false,
          orders: false,
          stimuliOrders: [],
          orderColumns: [],
          categories: false,
          categoryColumn: "",
          categoryData: [],
          trials: [],
          branches: ["move-loop", "dest-loop"],
          code: "",
        } as unknown as Loop,
      ],
    ]);
    mocks.trialsContext.getLoop.mockImplementation(
      async (id: string | number) => loops.get(id) || null,
    );

    const { onRefreshMetadata } = renderSubCanvas({
      loopTimeline: loopMoveTimeline,
      selectedTrial: null,
      selectedLoop,
    });

    fireEvent.click(screen.getByTitle("Move Trial/Loop"));
    await act(async () => {
      await mocks.moveModalProps.onConfirm("dest-loop", true);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "parent-loop",
        { branches: ["dest-loop", "child-trial"] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        branches: [],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("dest-loop", {
        branches: ["existing-branch", "move-loop"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: ["parent-loop", "dest-loop"] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        parentLoopId: "loop_parent",
      });
    });
    expect(onRefreshMetadata).toHaveBeenCalled();
  });

  it("moves a loop as parent of another loop destination", async () => {
    const loopMoveTimeline: TimelineItem[] = [
      { id: "move-loop", type: "loop", name: "Move Loop", branches: [] },
      { id: "dest-loop", type: "loop", name: "Destination Loop", branches: [] },
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
            trials: ["move-loop", "dest-loop"],
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
      await mocks.moveModalProps.onConfirm("dest-loop", false);
    });

    await waitFor(() => {
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        branches: ["dest-child"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("dest-loop", {
        branches: ["move-loop"],
      });
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith(
        "loop_parent",
        { trials: ["dest-loop"] },
      );
      expect(mocks.trialsContext.updateLoop).toHaveBeenCalledWith("move-loop", {
        parentLoopId: "loop_parent",
      });
    });
  });
});
