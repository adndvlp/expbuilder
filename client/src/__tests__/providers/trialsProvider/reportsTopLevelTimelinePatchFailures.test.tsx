import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsContext from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsProvider from "../../../pages/ExperimentBuilder/providers/TrialsProvider";
import {
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
  trial,
  trialDraft,
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

  it("reports top-level timeline patch failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const initialTimeline = [timelineTrial({ id: 1, name: "Old Trial" })];
    const view = await renderLoadedProvider(initialTimeline);

    queueFetchResponses(notOkJson());

    const result = await act(async () => {
      return view
        .getContext()
        ?.updateTimeline([timelineTrial({ id: 1, name: "New Trial" })]);
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
      return view
        .getContext()
        ?.createTrial(trialDraft({ name: "Created Trial" }));
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

    queueFetchResponses(
      okJson({ trial: trial({ id: 9, name: "Fetched" }) }),
      notOkJson(),
    );
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
        ?.updateTrial(
          1,
          { name: "Question Updated", branches: [2] },
          branchTrial,
        );
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
          timelineTrial({
            id: 10,
            name: "Nested Question",
            parentLoopId: "loop-1",
          }),
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
});
