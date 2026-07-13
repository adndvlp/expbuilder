import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { useParams } from "react-router-dom";
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

  it("logs timeline load failures and leaves loading state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queueFetchResponses(notOkJson());

    const view = renderTrialsProvider();

    await waitFor(() => {
      expect(view.getContext()?.isLoading).toBe(false);
    });
    expect(view.getContext()?.timeline).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Error loading trials timeline:",
      expect.any(Error),
    );
  });

  it("defaults omitted top-level and loop timelines to empty arrays", async () => {
    queueFetchResponses(okJson({}));
    const view = renderTrialsProvider();

    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledWith(
        `${API_URL}/api/trials-metadata/test-exp-123`,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.getContext()?.timeline).toEqual([]);

    queueFetchResponses(okJson({}));
    const loopResult = await act(async () =>
      view.getContext()?.getLoopTimeline("empty-loop", true, true),
    );
    expect(loopResult).toEqual([]);
    expect(view.getContext()?.loopTimeline).toEqual([]);
  });

  it("does not load a timeline without an experiment id", async () => {
    vi.mocked(useParams).mockReturnValueOnce({} as any);
    const view = renderTrialsProvider();

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock()).not.toHaveBeenCalled();
    expect(view.getContext()?.timeline).toEqual([]);
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

  it("returns cached loop timelines and handles loop timeline load failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider();
    const loopTimeline = [timelineTrial({ id: 10, name: "Loop trial A" })];

    queueFetchResponses(okJson({ trialsMetadata: loopTimeline }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });

    const callsBeforeCache = fetchMock().mock.calls.length;
    const cached = await act(async () => {
      return view.getContext()?.getLoopTimeline("loop-1");
    });

    expect(cached).toEqual(loopTimeline);
    expect(fetchMock()).toHaveBeenCalledTimes(callsBeforeCache);

    queueFetchResponses(notOkJson());
    const failed = await act(async () => {
      return view.getContext()?.getLoopTimeline("loop-fail", true, true);
    });

    expect(failed).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(
      "Error loading loop trials timeline:",
      expect.any(Error),
    );
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

  it("reports top-level timeline patch failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const initialTimeline = [timelineTrial({ id: 1, name: "Old Trial" })];
    const view = await renderLoadedProvider(initialTimeline);

    queueFetchResponses(notOkJson());

    const result = await act(async () => {
      return view.getContext()?.updateTimeline([
        timelineTrial({ id: 1, name: "New Trial" }),
      ]);
    });

    expect(result).toBe(false);
    expect(view.getContext()?.timeline).toEqual(initialTimeline);
    expect(console.error).toHaveBeenCalledWith(
      "Error updating timeline:",
      expect.any(Error),
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

  it("reloads timeline when trial creation fails and handles getTrial failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider();
    const reloadedTimeline = [timelineTrial({ id: 9, name: "Reloaded" })];

    queueFetchResponses(notOkJson(), okJson({ timeline: reloadedTimeline }));

    let caughtError: unknown;
    await act(async () => {
      try {
        await view.getContext()?.createTrial(trialDraft({ name: "Broken" }));
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toEqual(expect.any(Error));
    await waitFor(() => {
      expect(view.getContext()?.timeline).toEqual(reloadedTimeline);
    });

    queueFetchResponses(okJson({ trial: trial({ id: 9, name: "Fetched" }) }), notOkJson());
    await expect(view.getContext()?.getTrial(9)).resolves.toEqual(
      trial({ id: 9, name: "Fetched" }),
    );
    await expect(view.getContext()?.getTrial("missing")).resolves.toBeNull();

    fetchMock().mockRejectedValueOnce(new Error("offline"));
    await expect(view.getContext()?.getTrial("offline")).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Error getting trial:",
      expect.any(Error),
    );
  });

  it("updates trial metadata and appends a newly created branch to the visible timeline", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Question", branches: [] }),
    ]);
    const branchTrial = trial({
      id: 2,
      name: "Follow-up",
      branches: undefined as any,
    });
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

  it("updates a trial without branches and preserves unrelated timeline items", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Before", branches: [2] }),
      timelineTrial({ id: 99, name: "Unrelated" }),
    ]);
    const updated = trial({
      id: 1,
      name: "After",
      branches: undefined as any,
    });
    queueFetchResponses(okJson({ trial: updated }));

    const result = await act(async () => {
      return view.getContext()?.updateTrial(1, { name: "After" });
    });

    expect(result).toEqual(updated);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "After", branches: [] }),
      timelineTrial({ id: 99, name: "Unrelated" }),
    ]);
  });

  it("updates nested trials with placeholder branch items and selected trial sync", async () => {
    const selected = trial({
      id: 10,
      name: "Nested Question",
      parentLoopId: "loop-1",
    });
    const updated = trial({
      id: 10,
      name: "Nested Question Updated",
      parentLoopId: "loop-1",
      branches: [20],
    });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [10] }),
    ]);

    queueFetchResponses(
      okJson({
        trialsMetadata: [
          timelineTrial({ id: 10, name: "Nested Question", parentLoopId: "loop-1" }),
        ],
      }),
    );

    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    queueFetchResponses(okJson({ trial: updated }));

    const result = await act(async () => {
      return view
        .getContext()
        ?.updateTrial(10, { name: "Nested Question Updated", branches: [20] });
    });

    expect(result).toEqual(updated);
    expect(view.getContext()?.selectedTrial).toEqual(updated);
    expect(view.getContext()?.loopTimeline).toEqual([
      timelineTrial({
        id: 10,
        name: "Nested Question Updated",
        branches: [20],
        parentLoopId: "loop-1",
      }),
      timelineTrial({ id: 20, name: "Loading..." }),
    ]);
  });

  it("reloads timeline when trial update and delete operations fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = trial({ id: 1, name: "Selected", branches: [2] });
    const fresh = trial({ id: 1, name: "Fresh", branches: [] });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected", branches: [2] }),
      timelineTrial({ id: 2, name: "Child" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    queueFetchResponses(notOkJson(), okJson({ timeline: [] }));
    await expect(
      act(async () => view.getContext()?.updateTrial(1, { name: "Broken" })),
    ).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Error updating trial:",
      expect.any(Error),
    );

    queueFetchResponses(notOkJson(), okJson({ trial: fresh }));
    const fieldResult = await act(async () => {
      return view.getContext()?.updateTrialField(1, "name", "Broken");
    });
    expect(fieldResult).toBe(false);
    expect(view.getContext()?.selectedTrial).toEqual(fresh);

    queueFetchResponses(notOkJson(), okJson({ timeline: [] }));
    const deleteResult = await act(async () => {
      return view.getContext()?.deleteTrial(1);
    });
    expect(deleteResult).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting trial:",
      expect.any(Error),
    );
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

  it("updates branch and non-visual fields without replacing selectedTrial", async () => {
    const selected = trial({ id: 1, name: "Selected", branches: [2] });
    const branchesUpdated = trial({
      id: 1,
      name: "Selected",
      branches: undefined as any,
    });
    const customCodeUpdated = trial({
      id: 1,
      name: "Selected",
      customOnFinish: "return true;",
    });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected", branches: [2] }),
      timelineTrial({ id: 2, name: "Unrelated" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });
    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    queueFetchResponses(
      okJson({ trial: branchesUpdated }),
      okJson({ trial: customCodeUpdated }),
    );

    await expect(
      act(async () =>
        view.getContext()?.updateTrialField(1, "branches", undefined, false),
      ),
    ).resolves.toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Selected", branches: [] }),
      timelineTrial({ id: 2, name: "Unrelated" }),
    ]);
    expect(view.getContext()?.selectedTrial).toEqual(selected);

    await expect(
      act(async () =>
        view
          .getContext()
          ?.updateTrialField(1, "customOnFinish", "return true;", false),
      ),
    ).resolves.toBe(true);
    expect(view.getContext()?.selectedTrial).toEqual(selected);
  });

  it("does not refresh selection for unrelated field failures or missing fresh trials", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = trial({ id: 1, name: "Selected" });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected" }),
      timelineTrial({ id: 2, name: "Other" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });
    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    queueFetchResponses(notOkJson(), notOkJson(), notOkJson());

    await expect(
      act(async () =>
        view.getContext()?.updateTrialField(2, "name", "Broken"),
      ),
    ).resolves.toBe(false);
    await expect(
      act(async () =>
        view.getContext()?.updateTrialField(1, "name", "Still broken"),
      ),
    ).resolves.toBe(false);

    expect(view.getContext()?.selectedTrial).toEqual(selected);
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
      timelineTrial({ id: 1, name: "Parent", branches: [2, 3] }),
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

  it("falls back to loop parent patches while creating loops and reloads top-level create failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: [2, 3] }),
      timelineTrial({ id: 2, name: "Item A" }),
      timelineTrial({ id: 3, name: "Item B" }),
    ]);
    const createdLoop = loop({
      id: "loop-created",
      name: "Created Loop",
      trials: [2, 3],
    });

    fetchMock()
      .mockResolvedValueOnce(okJson({ loop: createdLoop }))
      .mockRejectedValueOnce(new Error("trial patch failed"))
      .mockResolvedValueOnce(okJson({ loop: loop({ id: 2, parentLoopId: "loop-created" }) }))
      .mockRejectedValueOnce(new Error("trial patch failed"))
      .mockRejectedValueOnce(new Error("loop patch failed"));

    const result = await act(async () => {
      return view.getContext()?.createLoop(
        loopDraft({
          name: "Created Loop",
          trials: [2, 3],
        }),
      );
    });

    expect(result).toEqual(createdLoop);
    expect(console.error).toHaveBeenCalledWith(
      "Error updating parentLoopId for item 3:",
      expect.any(Error),
      expect.any(Error),
    );

    queueFetchResponses(notOkJson(), okJson({ timeline: [] }));
    let caughtError: unknown;
    await act(async () => {
      try {
        await view.getContext()?.createLoop(loopDraft({ name: "Fails", trials: [] }));
      } catch (error) {
        caughtError = error;
      }
    });
    expect(caughtError).toEqual(expect.any(Error));
    expect(console.error).toHaveBeenCalledWith(
      "Error creating loop:",
      expect.any(Error),
    );
  });

  it("creates loops without duplicating existing temp branch references", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: [2, "temp-loop-123", 99] }),
      timelineTrial({ id: 2, name: "Loop item" }),
      timelineTrial({ id: 99, name: "Unrelated branch" }),
    ]);
    const createdLoop = loop({
      id: "loop-real",
      name: "Created Loop",
      trials: [2],
      branches: undefined as any,
    });

    queueFetchResponses(
      okJson({ loop: createdLoop }),
      okJson({ trial: trial({ id: 2, parentLoopId: "loop-real" }) }),
    );

    const result = await act(async () => {
      return view.getContext()?.createLoop(
        loopDraft({
          name: "Created Loop",
          trials: [2],
          branches: undefined as any,
        }),
      );
    });

    expect(result).toEqual(createdLoop);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-real", 99] }),
      timelineTrial({ id: 99, name: "Unrelated branch" }),
      timelineLoop({
        id: "loop-real",
        name: "Created Loop",
        trials: [2],
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

  it("creates nested loops in the loaded loop timeline and keeps unrelated loop items", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-parent", name: "Parent Loop", trials: [10, 11] }),
    ]);
    const existingLoopTimeline = [
      timelineTrial({ id: 10, name: "Inner A" }),
      timelineTrial({ id: 11, name: "Inner B" }),
      timelineTrial({ id: 12, name: "Bystander" }),
    ];
    const createdLoop = loop({
      id: "loop-child",
      name: "Nested Created",
      parentLoopId: "loop-parent",
      trials: [10, 11],
      branches: [],
    });

    queueFetchResponses(okJson({ trialsMetadata: existingLoopTimeline }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-parent");
    });

    queueFetchResponses(
      okJson({ loop: createdLoop }),
      okJson({ trial: trial({ id: 10, parentLoopId: "loop-child" }) }),
      okJson({ trial: trial({ id: 11, parentLoopId: "loop-child" }) }),
    );

    const result = await act(async () => {
      return view.getContext()?.createLoop(
        loopDraft({
          name: "Nested Created",
          parentLoopId: "loop-parent",
          trials: [10, 11],
          branches: [],
        }),
      );
    });

    expect(result).toEqual(createdLoop);
    expect(view.getContext()?.loopTimeline).toEqual([
      timelineTrial({ id: 12, name: "Bystander" }),
      timelineLoop({
        id: "loop-child",
        name: "Nested Created",
        trials: [10, 11],
        branches: [],
      }),
    ]);
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

  it("adds placeholder branch items when loop updates reference branches not yet loaded", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [1, 2], branches: [] }),
      timelineTrial({ id: 99, name: "Bystander" }),
    ]);
    const currentLoop = loop({
      id: "loop-1",
      name: "Loop",
      trials: [1, 2],
      branches: [],
    });
    const updatedLoop = loop({
      id: "loop-1",
      name: "Loop",
      trials: [1, 2],
      branches: [50],
    });

    queueFetchResponses(okJson({ loop: currentLoop }), okJson({ loop: updatedLoop }));

    const result = await act(async () => {
      return view.getContext()?.updateLoop("loop-1", { branches: [50] });
    });

    expect(result).toEqual(updatedLoop);
    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [1, 2], branches: [50] }),
      timelineTrial({ id: 99, name: "Bystander" }),
      timelineTrial({ id: 50, name: "Loading..." }),
    ]);
  });

  it("updates loops with partial fields and default branch item shapes", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Before", trials: [1], branches: [7] }),
    ]);

    queueFetchResponses(
      okJson({ loop: loop({ id: "loop-1", name: "Before", trials: [1], branches: [7] }) }),
      okJson({
        loop: loop({
          id: "loop-1",
          name: "After",
          branches: undefined as any,
          trials: undefined as any,
        }),
      }),
      okJson({ loop: loop({ id: "loop-1", name: "After", trials: [], branches: [] }) }),
      okJson({
        loop: loop({
          id: "loop-1",
          name: "After",
          trials: [],
          branches: [60],
        }),
      }),
      okJson({ loop: loop({ id: "loop-1", name: "After", trials: [], branches: [] }) }),
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
        { id: "branch-loop", name: "Branch Loop", branches: null, trials: null },
      );
    });

    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({ id: "loop-1", name: "After", branches: ["branch-loop"], trials: [] }),
      timelineTrial({ id: 60, name: "Mystery" }),
      timelineLoop({ id: "branch-loop", name: "Branch Loop", branches: [], trials: [] }),
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
      timelineLoop({ id: "loop-parent", name: "Parent Loop", trials: ["loop-child"] }),
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
        { name: "Child Loop Updated", trials: [2], branches: ["branch-loop"] },
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

  it("reloads parent loop timeline when nested loop update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [1],
    });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-parent", name: "Parent Loop", trials: ["loop-child"] }),
    ]);
    const reloaded = [timelineTrial({ id: 5, name: "Reloaded" })];

    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    queueFetchResponses(notOkJson(), okJson({ trialsMetadata: reloaded }));

    const result = await act(async () => {
      return view.getContext()?.updateLoop("loop-child", { name: "Broken" });
    });

    expect(result).toBeNull();
    await waitFor(() => {
      expect(view.getContext()?.loopTimeline).toEqual(reloaded);
    });
  });

  it("updates nested loop fields in loopTimeline without syncing selectedLoop when disabled", async () => {
    const selected = loop({
      id: "loop-child",
      name: "Child Before",
      parentLoopId: "loop-parent",
      trials: [1],
    });
    const updated = loop({
      id: "loop-child",
      name: "Child After",
      parentLoopId: "loop-parent",
      trials: [1, 2],
    });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-parent", name: "Parent Loop", trials: ["loop-child"] }),
    ]);

    queueFetchResponses(
      okJson({
        trialsMetadata: [
          timelineLoop({
            id: "loop-child",
            name: "Child Before",
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

    queueFetchResponses(okJson({ loop: updated }));

    const result = await act(async () => {
      return view
        .getContext()
        ?.updateLoopField("loop-child", "trials", [1, 2], false);
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedLoop).toEqual(selected);
    expect(view.getContext()?.loopTimeline).toEqual([
      timelineLoop({
        id: "loop-child",
        name: "Child After",
        trials: [1, 2],
      }),
    ]);
  });

  it("keeps unrelated timeline items while updating top-level loop fields", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Before", trials: [1] }),
      timelineTrial({ id: 99, name: "Bystander" }),
    ]);
    const updated = loop({ id: "loop-1", name: "After", trials: [1] });

    queueFetchResponses(okJson({ loop: updated }));

    const result = await act(async () => {
      return view.getContext()?.updateLoopField("loop-1", "name", "After");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({ id: "loop-1", name: "After", trials: [1] }),
      timelineTrial({ id: 99, name: "Bystander" }),
    ]);
  });

  it("updates non-structural loop fields and skips refresh for unrelated failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const initialTimeline = [
      timelineLoop({ id: "loop-1", name: "Before", trials: [1] }),
    ];
    const view = await renderLoadedProvider(initialTimeline);
    const updated = loop({ id: "loop-1", name: "Before", randomize: true });

    queueFetchResponses(okJson({ loop: updated }));
    const randomizeResult = await act(async () => {
      return view.getContext()?.updateLoopField("loop-1", "randomize", true);
    });

    expect(randomizeResult).toBe(true);
    expect(view.getContext()?.timeline).toEqual(initialTimeline);

    queueFetchResponses(notOkJson());
    const failedResult = await act(async () => {
      return view.getContext()?.updateLoopField("other-loop", "randomize", false);
    });

    expect(failedResult).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Error updating randomize:",
      expect.any(Error),
    );
  });

  it("handles loop field responses missing arrays and stale selected refresh misses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({ id: "loop-1", name: "Before", trials: [1], branches: [2] });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Before", trials: [1], branches: [2] }),
    ]);

    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });
    await waitFor(() => {
      expect(view.getContext()?.selectedLoop).toEqual(selected);
    });

    queueFetchResponses(
      okJson({
        loop: loop({
          id: "loop-1",
          name: "Server Missing Arrays",
          branches: undefined as any,
          trials: undefined as any,
        }),
      }),
    );

    const result = await act(async () => {
      return view.getContext()?.updateLoopField("loop-1", "name", "Optimistic");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({ id: "loop-1", name: "Server Missing Arrays", branches: [], trials: [] }),
    ]);

    queueFetchResponses(notOkJson(), notOkJson());
    const failed = await act(async () => {
      return view.getContext()?.updateLoopField("loop-1", "name", "Broken");
    });

    expect(failed).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Error updating name:",
      expect.any(Error),
    );
  });

  it("reloads the top-level timeline when deleting a missing loop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Existing Loop" }),
    ]);
    const reloaded = [timelineTrial({ id: 8, name: "Reloaded" })];

    queueFetchResponses(notOkJson(), okJson({ timeline: reloaded }));

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("missing-loop");
    });

    expect(result).toBe(false);
    await waitFor(() => {
      expect(view.getContext()?.timeline).toEqual(reloaded);
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting loop:",
      expect.any(Error),
    );
  });

  it("removes empty loops from parent branches even when loop metadata fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["empty-loop", 2] }),
      timelineLoop({ id: "empty-loop", name: "Empty Loop", trials: [] }),
      timelineTrial({ id: 2, name: "After empty loop" }),
    ]);
    const emptyLoop = loop({
      id: "empty-loop",
      name: "Empty Loop",
      trials: [],
      branches: [],
    });

    fetchMock()
      .mockResolvedValueOnce(okJson({ loop: emptyLoop }))
      .mockRejectedValueOnce(new Error("metadata unavailable"))
      .mockResolvedValueOnce(okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("empty-loop");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [2] }),
      timelineTrial({ id: 2, name: "After empty loop" }),
    ]);
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching loop trials:",
      expect.any(Error),
    );
  });

  it("deletes loops when metadata responds non-ok and loop branches are missing", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-no-meta", 2] }),
      timelineLoop({ id: "loop-no-meta", name: "Loop", trials: [10] }),
      timelineTrial({ id: 2, name: "Sibling" }),
    ]);
    const loopToDelete = loop({
      id: "loop-no-meta",
      name: "Loop",
      trials: [10],
      branches: undefined as any,
    });

    queueFetchResponses(okJson({ loop: loopToDelete }), notOkJson(), okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-no-meta");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10, 2] }),
      timelineTrial({ id: 2, name: "Sibling" }),
    ]);
  });

  it("deletes loops with incomplete internal metadata and restores nested loop defaults", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-edge"] }),
      timelineLoop({ id: "loop-edge", name: "Loop", trials: [10, "nested-loop"], branches: [99] }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
    const loopToDelete = loop({
      id: "loop-edge",
      name: "Loop",
      trials: [10, "nested-loop"],
      branches: [99],
    });

    queueFetchResponses(
      okJson({ loop: loopToDelete }),
      okJson({
        trialsMetadata: [
          timelineTrial({ id: 10, name: "Internal without branches", branches: undefined as any }),
          timelineLoop({
            id: "nested-loop",
            name: "Nested without trials",
            branches: [10],
            trials: null as any,
          }),
        ],
      }),
      okJson({}),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-edge");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10] }),
      timelineTrial({
        id: 10,
        name: "Internal without branches",
        branches: [99],
        parentLoopId: undefined,
      }),
      timelineLoop({
        id: "nested-loop",
        name: "Nested without trials",
        branches: [10],
        trials: [],
        parentLoopId: undefined,
      }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
  });

  it("deletes loops using empty metadata payloads and visible internal item defaults", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-visible"] }),
      timelineLoop({ id: "loop-visible", name: "Loop", trials: [10], branches: [99] }),
      timelineTrial({ id: 10, name: "Visible internal", branches: undefined as any }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
    const loopToDelete = loop({
      id: "loop-visible",
      name: "Loop",
      trials: [10],
      branches: [99],
    });

    queueFetchResponses(okJson({ loop: loopToDelete }), okJson({}), okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-visible");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10] }),
      timelineTrial({ id: 10, name: "Visible internal", branches: [99] }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
  });

  it("falls back to the first internal item when every internal item branches inside the loop", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-cycle", name: "Loop", trials: [10, 11], branches: [99] }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
    const loopToDelete = loop({
      id: "loop-cycle",
      name: "Loop",
      trials: [10, 11],
      branches: [99],
    });

    queueFetchResponses(
      okJson({ loop: loopToDelete }),
      okJson({
        trialsMetadata: [
          timelineTrial({ id: 10, name: "Internal A", branches: [11] }),
          timelineTrial({ id: 11, name: "Internal B", branches: [10] }),
        ],
      }),
      okJson({}),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-cycle");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 10, name: "Internal A", branches: [11, 99], parentLoopId: undefined }),
      timelineTrial({ id: 11, name: "Internal B", branches: [10], parentLoopId: undefined }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
  });

  it("deletes nested loops from a loaded parent loop timeline and reconnects terminal branches", async () => {
    const view = await renderLoadedProvider([]);
    const parentLoopTimeline = [
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
        branches: ["loop-child"],
      }),
      timelineLoop({
        id: "loop-child",
        name: "Child Loop",
        parentLoopId: "loop-parent",
        trials: [10, 11],
        branches: [99, 100],
      }),
      timelineTrial({
        id: 10,
        name: "Internal terminal",
        parentLoopId: "loop-child",
        branches: [99],
      }),
      timelineTrial({ id: 99, name: "Existing branch" }),
      timelineTrial({ id: 100, name: "New branch" }),
    ];
    const childLoop = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [10, 11],
      branches: [99, 100],
    });

    queueFetchResponses(okJson({ trialsMetadata: parentLoopTimeline }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-parent");
    });

    queueFetchResponses(
      okJson({ loop: childLoop }),
      okJson({
        trialsMetadata: [
          timelineTrial({
            id: 10,
            name: "Internal terminal",
            parentLoopId: "loop-child",
            branches: [99],
          }),
        ],
      }),
      okJson({}),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-child");
    });

    expect(result).toBe(true);
    const nextLoopTimeline = view.getContext()?.loopTimeline ?? [];
    expect(nextLoopTimeline.some((item) => item.id === "loop-child")).toBe(false);
    expect(nextLoopTimeline).toContainEqual(
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
        branches: [10],
      }),
    );
    expect(
      nextLoopTimeline.some(
        (item) =>
          item.id === 10 &&
          item.parentLoopId === undefined &&
          item.branches?.includes(99) &&
          item.branches?.includes(100),
      ),
    ).toBe(true);
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

  it("deletes selected loops using loaded loop timeline metadata and restores nested loops", async () => {
    const selected = loop({
      id: "loop-1",
      name: "Selected Loop",
      trials: [10, "nested-loop"],
      branches: [],
    });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-1"] }),
      timelineLoop({ id: "loop-1", name: "Selected Loop", trials: [10, "nested-loop"] }),
      timelineTrial({ id: 99, name: "After" }),
    ]);
    const loadedLoopTimeline = [
      timelineTrial({ id: 10, name: "Internal Trial", branches: ["nested-loop"] }),
      timelineLoop({ id: "nested-loop", name: "Nested Loop", trials: [20] }),
    ];

    queueFetchResponses(okJson({ trialsMetadata: loadedLoopTimeline }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });
    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    queueFetchResponses(okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-1");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedLoop).toBeNull();
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10] }),
      timelineTrial({
        id: 10,
        name: "Internal Trial",
        branches: ["nested-loop"],
        parentLoopId: undefined,
      }),
      timelineLoop({
        id: "nested-loop",
        name: "Nested Loop",
        trials: [20],
        parentLoopId: undefined,
      }),
      timelineTrial({ id: 99, name: "After" }),
    ]);
  });

  it("reloads parent loop timeline when deleting a nested loop fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [10],
    });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-parent", name: "Parent Loop", trials: ["loop-child"] }),
    ]);
    const reloaded = [timelineTrial({ id: 77, name: "Reloaded" })];

    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    queueFetchResponses(
      okJson({ trialsMetadata: [timelineTrial({ id: 10, name: "Internal" })] }),
      notOkJson(),
      okJson({ trialsMetadata: reloaded }),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-child");
    });

    expect(result).toBe(false);
    await waitFor(() => {
      expect(view.getContext()?.loopTimeline).toEqual(reloaded);
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting loop:",
      expect.any(Error),
    );
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

  it("reports delete-all failures without clearing state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selectedTrial = trial({ id: 1, name: "Selected Trial" });
    const selectedLoop = loop({ id: "loop-1", name: "Selected Loop" });
    const initialTimeline = [
      timelineTrial({ id: 1, name: "Selected Trial" }),
      timelineLoop({ id: "loop-1", name: "Selected Loop" }),
    ];
    const view = await renderLoadedProvider(initialTimeline);

    act(() => {
      view.getContext()?.setSelectedTrial(selectedTrial);
      view.getContext()?.setSelectedLoop(selectedLoop);
    });

    queueFetchResponses(notOkJson());

    const result = await act(async () => {
      return view.getContext()?.deleteAllTrials();
    });

    expect(result).toBe(false);
    expect(view.getContext()?.timeline).toEqual(initialTimeline);
    expect(view.getContext()?.selectedTrial).toEqual(selectedTrial);
    expect(view.getContext()?.selectedLoop).toEqual(selectedLoop);
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting all trials:",
      expect.any(Error),
    );
  });
});
