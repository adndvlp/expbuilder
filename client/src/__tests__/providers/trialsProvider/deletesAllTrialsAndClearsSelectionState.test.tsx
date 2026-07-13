import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsContext from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsProvider from "../../../pages/ExperimentBuilder/providers/TrialsProvider";
import {
  loop,
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";

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
