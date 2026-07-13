import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsContext from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsProvider from "../../../pages/ExperimentBuilder/providers/TrialsProvider";
import {
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
} from "../../helpers/trialFactories";

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
});
