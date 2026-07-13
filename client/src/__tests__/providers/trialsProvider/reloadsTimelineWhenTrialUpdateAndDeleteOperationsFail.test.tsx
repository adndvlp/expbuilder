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
      act(async () => view.getContext()?.updateTrialField(2, "name", "Broken")),
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
          timelineTrial({
            id: 10,
            name: "Nested Before",
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
});
