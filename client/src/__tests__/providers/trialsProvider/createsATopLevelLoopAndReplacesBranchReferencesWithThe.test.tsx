import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsContext from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import TrialsProvider from "../../../pages/ExperimentBuilder/providers/TrialsProvider";
import {
  loop,
  loopDraft,
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
      .mockResolvedValueOnce(
        okJson({ loop: loop({ id: 2, parentLoopId: "loop-created" }) }),
      )
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
        await view
          .getContext()
          ?.createLoop(loopDraft({ name: "Fails", trials: [] }));
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
      timelineTrial({
        id: 1,
        name: "Parent",
        branches: [2, "temp-loop-123", 99],
      }),
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

    await expect(
      view.getContext()?.getLoop("loop-missing"),
    ).resolves.toBeNull();

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
    const fresh = loop({
      id: "loop-1",
      name: "Fresh from server",
      trials: [1],
    });
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
});
