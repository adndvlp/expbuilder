import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  loop,
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";
import {
  API_URL,
  fetchMock,
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

describe("TrialsProvider", () => {
  registerTrialsProviderLifecycle();

  it("updates loops with partial fields and default branch item shapes", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({
        id: "loop-1",
        name: "Before",
        trials: [1],
        branches: [7],
      }),
    ]);

    queueFetchResponses(
      okJson({
        loop: loop({
          id: "loop-1",
          name: "Before",
          trials: [1],
          branches: [7],
        }),
      }),
      okJson({
        loop: loop({
          id: "loop-1",
          name: "After",
          branches: undefined as any,
          trials: undefined as any,
        }),
      }),
      okJson({
        loop: loop({ id: "loop-1", name: "After", trials: [], branches: [] }),
      }),
      okJson({
        loop: loop({
          id: "loop-1",
          name: "After",
          trials: [],
          branches: [60],
        }),
      }),
      okJson({
        loop: loop({ id: "loop-1", name: "After", trials: [], branches: [] }),
      }),
      okJson({
        loop: loop({
          id: "loop-1",
          name: "After",
          trials: [],
          branches: ["branch-loop"],
        }),
      }),
    );

    await act(async () => {
      await view.getContext()?.updateLoop("loop-1", { name: "After" });
    });

    await act(async () => {
      await view
        .getContext()
        ?.updateLoop("loop-1", { branches: [60] }, { id: 60, name: "Mystery" });
    });

    await act(async () => {
      await view.getContext()?.updateLoop(
        "loop-1",
        { branches: ["branch-loop"] },
        {
          id: "branch-loop",
          name: "Branch Loop",
          branches: null,
          trials: null,
        },
      );
    });

    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({
        id: "loop-1",
        name: "After",
        branches: ["branch-loop"],
        trials: [],
      }),
      timelineTrial({ id: 60, name: "Mystery" }),
      timelineLoop({
        id: "branch-loop",
        name: "Branch Loop",
        branches: [],
        trials: [],
      }),
    ]);
  });

  it("syncs added trials when the current loop has no trials array", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [], branches: [] }),
    ]);
    const currentLoop = loop({
      id: "loop-1",
      name: "Loop",
      trials: undefined as any,
    });
    const updatedLoop = loop({
      id: "loop-1",
      name: "Loop",
      trials: [2],
    });

    queueFetchResponses(
      okJson({ loop: currentLoop }),
      okJson({ loop: updatedLoop }),
      okJson({ trial: trial({ id: 2, parentLoopId: "loop-1" }) }),
    );

    const result = await act(async () => {
      return view.getContext()?.updateLoop("loop-1", { trials: [2] });
    });

    expect(result).toEqual(updatedLoop);
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/trial/test-exp-123/2`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ parentLoopId: "loop-1" }),
      }),
    );
  });

  it("updates nested loops, supports branch loop items, and logs parentLoopId patch fallback failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [1],
    });
    const updated = loop({
      id: "loop-child",
      name: "Child Loop Updated",
      parentLoopId: "loop-parent",
      trials: [2],
      branches: ["branch-loop"],
    });
    const newBranchLoop = loop({
      id: "branch-loop",
      name: "Branch Loop",
      trials: [99],
    });
    const view = await renderLoadedProvider([
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
      }),
    ]);

    queueFetchResponses(
      okJson({
        trialsMetadata: [
          timelineLoop({
            id: "loop-child",
            name: "Child Loop",
            trials: [1],
          }),
        ],
      }),
    );
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-parent");
    });
    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    fetchMock()
      .mockResolvedValueOnce(okJson({ loop: updated }))
      .mockRejectedValueOnce(new Error("clear trial failed"))
      .mockRejectedValueOnce(new Error("clear loop failed"))
      .mockRejectedValueOnce(new Error("set trial failed"))
      .mockRejectedValueOnce(new Error("set loop failed"));

    const result = await act(async () => {
      return view.getContext()?.updateLoop(
        "loop-child",
        {
          name: "Child Loop Updated",
          trials: [2],
          branches: ["branch-loop"],
        },
        newBranchLoop,
      );
    });

    expect(result).toEqual(updated);
    expect(view.getContext()?.selectedLoop).toEqual(updated);
    expect(view.getContext()?.loopTimeline).toEqual([
      timelineLoop({
        id: "loop-child",
        name: "Child Loop Updated",
        trials: [2],
        branches: ["branch-loop"],
      }),
      timelineLoop({
        id: "branch-loop",
        name: "Branch Loop",
        trials: [99],
      }),
    ]);
    expect(console.error).toHaveBeenCalledWith(
      "Error clearing parentLoopId for item 1:",
      expect.any(Error),
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "Error setting parentLoopId for item 2:",
      expect.any(Error),
      expect.any(Error),
    );
  });

  it("reloads the top-level timeline when a full loop update cannot load the current loop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Existing Loop", trials: [] }),
    ]);
    const reloaded = [timelineTrial({ id: 7, name: "Reloaded" })];

    queueFetchResponses(notOkJson(), okJson({ timeline: reloaded }));

    const result = await act(async () => {
      return view.getContext()?.updateLoop("missing-loop", { name: "Broken" });
    });

    expect(result).toBeNull();
    await waitFor(() => {
      expect(view.getContext()?.timeline).toEqual(reloaded);
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error updating loop:",
      expect.any(Error),
    );
  });
});
