import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsContext from "../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsProvider from "../../pages/ExperimentBuilder/providers/TrialsProvider";
import {
  loop,
  loopDraft,
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
  trial,
  trialDraft,
} from "../helpers/trialFactories";

const API_URL = "http://localhost:3000";

function renderTrialsProvider() {
  let contextValue: React.ContextType<typeof TrialsContext> | null = null;

  function TestConsumer() {
    const ctx = React.useContext(TrialsContext);

    React.useEffect(() => {
      contextValue = ctx;
    }, [ctx]);

    return null;
  }

  render(
    <TrialsProvider>
      <TestConsumer />
    </TrialsProvider>,
  );

  return {
    getContext: () => contextValue,
  };
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

function queueFetchResponses(...responses: Response[]) {
  responses.forEach((response) => {
    fetchMock().mockResolvedValueOnce(response);
  });
}

async function renderLoadedProvider(initialTimeline: TimelineItem[] = []) {
  queueFetchResponses(okJson({ timeline: initialTimeline }));

  const view = renderTrialsProvider();

  await waitFor(() => {
    expect(view.getContext()?.timeline).toEqual(initialTimeline);
    expect(view.getContext()?.isLoading).toBe(false);
  });

  return view;
}

describe("TrialsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the experiment timeline on mount", async () => {
    const initialTimeline = [
      timelineTrial({ id: 1, name: "Intro" }),
      timelineTrial({ id: 2, name: "Choice", branches: [3] }),
      timelineTrial({ id: 3, name: "Branch" }),
    ];

    const view = await renderLoadedProvider(initialTimeline);

    expect(view.getContext()?.timeline).toEqual(initialTimeline);
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/trials-metadata/test-exp-123`,
    );
  });

  it("provides the full provider surface used by canvas and configuration panels", async () => {
    const view = await renderLoadedProvider();
    const ctx = view.getContext();

    expect(ctx?.selectedTrial).toBeNull();
    expect(ctx?.selectedLoop).toBeNull();
    expect(ctx?.activeLoopId).toBeNull();
    expect(typeof ctx?.setSelectedTrial).toBe("function");
    expect(typeof ctx?.setSelectedLoop).toBe("function");
    expect(typeof ctx?.createTrial).toBe("function");
    expect(typeof ctx?.getTrial).toBe("function");
    expect(typeof ctx?.updateTrial).toBe("function");
    expect(typeof ctx?.updateTrialField).toBe("function");
    expect(typeof ctx?.deleteTrial).toBe("function");
    expect(typeof ctx?.createLoop).toBe("function");
    expect(typeof ctx?.getLoop).toBe("function");
    expect(typeof ctx?.updateLoop).toBe("function");
    expect(typeof ctx?.updateLoopField).toBe("function");
    expect(typeof ctx?.deleteLoop).toBe("function");
    expect(typeof ctx?.updateTimeline).toBe("function");
    expect(typeof ctx?.getTimeline).toBe("function");
    expect(typeof ctx?.getLoopTimeline).toBe("function");
    expect(typeof ctx?.clearLoopTimeline).toBe("function");
    expect(typeof ctx?.deleteAllTrials).toBe("function");
  });

  it("loads loop timelines without mutating visual state when updateState is false", async () => {
    const view = await renderLoadedProvider();
    const loopTimeline = [
      timelineTrial({ id: 10, name: "Loop trial A" }),
      timelineTrial({ id: 11, name: "Loop trial B" }),
    ];

    queueFetchResponses(okJson({ trialsMetadata: loopTimeline }));

    const result = await act(async () => {
      return view.getContext()?.getLoopTimeline("loop-1", false);
    });

    expect(result).toEqual(loopTimeline);
    expect(view.getContext()?.loopTimeline).toEqual([]);
    expect(view.getContext()?.activeLoopId).toBeNull();
  });

  it("loads loop timelines into visual state when updateState is true", async () => {
    const view = await renderLoadedProvider();
    const loopTimeline = [
      timelineTrial({ id: 10, name: "Loop trial A" }),
      timelineLoop({ id: "nested-loop", name: "Nested Loop", trials: [11] }),
    ];

    queueFetchResponses(okJson({ trialsMetadata: loopTimeline }));

    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });

    await waitFor(() => {
      expect(view.getContext()?.loopTimeline).toEqual(loopTimeline);
      expect(view.getContext()?.activeLoopId).toBe("loop-1");
    });
  });

  it("clears the active loop timeline", async () => {
    const view = await renderLoadedProvider();
    const loopTimeline = [timelineTrial({ id: 10, name: "Loop trial A" })];

    queueFetchResponses(okJson({ trialsMetadata: loopTimeline }));

    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });

    await waitFor(() => {
      expect(view.getContext()?.activeLoopId).toBe("loop-1");
    });

    act(() => {
      view.getContext()?.clearLoopTimeline();
    });

    expect(view.getContext()?.loopTimeline).toEqual([]);
    expect(view.getContext()?.activeLoopId).toBeNull();
  });

  it("patches and replaces the top-level timeline", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Old Trial" }),
    ]);
    const nextTimeline = [
      timelineTrial({ id: 1, name: "Renamed Trial" }),
      timelineTrial({ id: 2, name: "New Trial" }),
    ];

    queueFetchResponses(okJson({ timeline: nextTimeline }));

    const result = await act(async () => {
      return view.getContext()?.updateTimeline(nextTimeline);
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual(nextTimeline);
    expect(fetchMock()).toHaveBeenLastCalledWith(
      `${API_URL}/api/timeline/test-exp-123`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline: nextTimeline }),
      },
    );
  });

  it("creates trials through the API without mutating timeline optimistically", async () => {
    const initialTimeline = [timelineTrial({ id: 1, name: "Existing Trial" })];
    const view = await renderLoadedProvider(initialTimeline);
    const createdTrial = trial({ id: 2, name: "Created Trial" });

    queueFetchResponses(okJson({ trial: createdTrial }));

    const result = await act(async () => {
      return view.getContext()?.createTrial(trialDraft({ name: "Created Trial" }));
    });

    expect(result).toEqual(createdTrial);
    expect(view.getContext()?.timeline).toEqual(initialTimeline);
    expect(fetchMock()).toHaveBeenLastCalledWith(
      `${API_URL}/api/trial/test-exp-123`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trialDraft({ name: "Created Trial" })),
      },
    );
  });

  it("updates trial metadata and appends a newly created branch to the visible timeline", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Question", branches: [] }),
    ]);
    const branchTrial = trial({ id: 2, name: "Follow-up" });
    const updatedTrial = trial({
      id: 1,
      name: "Question Updated",
      branches: [2],
    });

    queueFetchResponses(okJson({ trial: updatedTrial }));

    const result = await act(async () => {
      return view
        .getContext()
        ?.updateTrial(1, { name: "Question Updated", branches: [2] }, branchTrial);
    });

    expect(result).toEqual(updatedTrial);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Question Updated", branches: [2] }),
      timelineTrial({ id: 2, name: "Follow-up" }),
    ]);
  });

  it("keeps selectedTrial synchronized after granular trial updates", async () => {
    const selected = trial({ id: 1, name: "Before" });
    const updated = trial({ id: 1, name: "After" });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Before" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    queueFetchResponses(okJson({ trial: updated }));

    const result = await act(async () => {
      return view.getContext()?.updateTrialField(1, "name", "After");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedTrial).toEqual(updated);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "After" }),
    ]);
  });

  it("updates active loop timeline when a nested trial field changes", async () => {
    const selected = trial({
      id: 10,
      name: "Nested Before",
      parentLoopId: "loop-1",
    });
    const updated = trial({
      id: 10,
      name: "Nested After",
      parentLoopId: "loop-1",
    });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [10] }),
    ]);

    queueFetchResponses(
      okJson({
        trialsMetadata: [
          timelineTrial({ id: 10, name: "Nested Before", parentLoopId: "loop-1" }),
        ],
      }),
    );

    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    queueFetchResponses(okJson({ trial: updated }));

    const result = await act(async () => {
      return view.getContext()?.updateTrialField(10, "name", "Nested After");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedTrial).toEqual(updated);
    expect(view.getContext()?.loopTimeline).toEqual([
      timelineTrial({ id: 10, name: "Nested After", parentLoopId: "loop-1" }),
    ]);
  });

  it("reconnects parent branches to deleted trial children", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: [2] }),
      timelineTrial({ id: 2, name: "Deleted", branches: [3, 4] }),
      timelineTrial({ id: 3, name: "Child A" }),
      timelineTrial({ id: 4, name: "Child B" }),
    ]);

    queueFetchResponses(okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteTrial(2);
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [3, 4] }),
      timelineTrial({ id: 3, name: "Child A" }),
      timelineTrial({ id: 4, name: "Child B" }),
    ]);
  });

  it("creates a top-level loop and replaces branch references with the real loop id", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: [2] }),
      timelineTrial({ id: 2, name: "Loop item A" }),
      timelineTrial({ id: 3, name: "Loop item B" }),
    ]);
    const createdLoop = loop({
      id: "loop-1",
      name: "Created Loop",
      trials: [2, 3],
      branches: [],
    });
    const draft = loopDraft({
      name: "Created Loop",
      trials: [2, 3],
      branches: [],
    });

    queueFetchResponses(
      okJson({ loop: createdLoop }),
      okJson({ trial: trial({ id: 2, parentLoopId: "loop-1" }) }),
      okJson({ trial: trial({ id: 3, parentLoopId: "loop-1" }) }),
    );

    const result = await act(async () => {
      return view.getContext()?.createLoop(draft);
    });

    expect(result).toEqual(createdLoop);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-1"] }),
      timelineLoop({
        id: "loop-1",
        name: "Created Loop",
        trials: [2, 3],
        branches: [],
      }),
    ]);
  });

  it("updates selectedLoop and visible loop metadata", async () => {
    const selected = loop({ id: "loop-1", name: "Before", trials: [1] });
    const updated = loop({ id: "loop-1", name: "After", trials: [1] });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Before", trials: [1] }),
    ]);

    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedLoop).toEqual(selected);
    });

    queueFetchResponses(okJson({ loop: updated }));

    const result = await act(async () => {
      return view.getContext()?.updateLoopField("loop-1", "name", "After");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedLoop).toEqual(updated);
    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({ id: "loop-1", name: "After", trials: [1] }),
    ]);
  });

  it("returns null when getLoop receives non-ok responses or network errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider();

    queueFetchResponses(notOkJson());

    await expect(view.getContext()?.getLoop("loop-missing")).resolves.toBeNull();

    fetchMock().mockRejectedValueOnce(new Error("offline"));

    await expect(view.getContext()?.getLoop("loop-error")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Error getting loop:",
      expect.any(Error),
    );
  });

  it("refreshes selected loop state when a granular loop update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({ id: "loop-1", name: "Before", trials: [1] });
    const fresh = loop({ id: "loop-1", name: "Fresh from server", trials: [1] });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Before", trials: [1] }),
    ]);

    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedLoop).toEqual(selected);
    });

    queueFetchResponses(notOkJson(), okJson({ loop: fresh }));

    const result = await act(async () => {
      return view.getContext()?.updateLoopField("loop-1", "name", "Broken");
    });

    expect(result).toBe(false);
    expect(view.getContext()?.selectedLoop).toEqual(fresh);
    expect(console.error).toHaveBeenCalledWith(
      "Error updating name:",
      expect.any(Error),
    );
  });

  it("reloads the parent loop timeline when nested loop creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const existingLoopTimeline = [
      timelineTrial({ id: 10, name: "Existing inner" }),
    ];
    const reloadedLoopTimeline = [
      timelineTrial({ id: 11, name: "Reloaded inner" }),
    ];
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-parent", name: "Parent Loop", trials: [10] }),
    ]);

    queueFetchResponses(okJson({ trialsMetadata: existingLoopTimeline }));

    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-parent");
    });

    await waitFor(() => {
      expect(view.getContext()?.loopTimeline).toEqual(existingLoopTimeline);
    });

    queueFetchResponses(
      notOkJson(),
      okJson({ trialsMetadata: reloadedLoopTimeline }),
    );

    let caughtError: unknown;
    await act(async () => {
      try {
        await view.getContext()?.createLoop(
          loopDraft({
            name: "Nested draft",
            parentLoopId: "loop-parent",
            trials: [10],
          }),
        );
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toEqual(expect.any(Error));
    expect((caughtError as Error).message).toBe("Failed to create loop");

    await waitFor(() => {
      expect(view.getContext()?.loopTimeline).toEqual(reloadedLoopTimeline);
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error creating loop:",
      expect.any(Error),
    );
  });

  it("updates loop branches with newly created branch items and syncs trial parentLoopId changes", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [1, 2], branches: [] }),
    ]);
    const currentLoop = loop({ id: "loop-1", name: "Loop", trials: [1, 2] });
    const updatedLoop = loop({
      id: "loop-1",
      name: "Loop updated",
      trials: [2, 3],
      branches: [50],
    });
    const newBranchTrial = trial({ id: 50, name: "Loop branch" });

    queueFetchResponses(
      okJson({ loop: currentLoop }),
      okJson({ loop: updatedLoop }),
      okJson({ trial: trial({ id: 1, parentLoopId: null }) }),
      okJson({ trial: trial({ id: 3, parentLoopId: "loop-1" }) }),
    );

    const result = await act(async () => {
      return view
        .getContext()
        ?.updateLoop("loop-1", { name: "Loop updated", trials: [2, 3], branches: [50] }, newBranchTrial);
    });

    expect(result).toEqual(updatedLoop);
    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({
        id: "loop-1",
        name: "Loop updated",
        trials: [2, 3],
        branches: [50],
      }),
      timelineTrial({ id: 50, name: "Loop branch" }),
    ]);
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/trial/test-exp-123/1`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ parentLoopId: null }),
      }),
    );
    expect(fetchMock()).toHaveBeenCalledWith(
      `${API_URL}/api/trial/test-exp-123/3`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ parentLoopId: "loop-1" }),
      }),
    );
  });

  it("deletes a loop by restoring internal trials and reconnecting loop branches to the terminal internal item", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-1"] }),
      timelineLoop({ id: "loop-1", name: "Loop", trials: [10, 11], branches: [99] }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
    const loopToDelete = loop({
      id: "loop-1",
      name: "Loop",
      trials: [10, 11],
      branches: [99],
    });

    queueFetchResponses(
      okJson({ loop: loopToDelete }),
      okJson({
        trialsMetadata: [
          timelineTrial({ id: 10, name: "Internal A", branches: [11] }),
          timelineTrial({ id: 11, name: "Internal B", branches: [] }),
        ],
      }),
      okJson({}),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-1");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10] }),
      timelineTrial({ id: 10, name: "Internal A", branches: [11], parentLoopId: undefined }),
      timelineTrial({ id: 11, name: "Internal B", branches: [99], parentLoopId: undefined }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
  });

  it("deletes all trials and clears selection state", async () => {
    const selectedTrial = trial({ id: 1, name: "Selected Trial" });
    const selectedLoop = loop({ id: "loop-1", name: "Selected Loop" });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected Trial" }),
      timelineLoop({ id: "loop-1", name: "Selected Loop" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selectedTrial);
      view.getContext()?.setSelectedLoop(selectedLoop);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selectedTrial);
      expect(view.getContext()?.selectedLoop).toEqual(selectedLoop);
    });

    queueFetchResponses(okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteAllTrials();
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([]);
    expect(view.getContext()?.selectedTrial).toBeNull();
    expect(view.getContext()?.selectedLoop).toBeNull();
  });
});
