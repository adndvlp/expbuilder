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
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: [10, 11],
      }),
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
      timelineLoop({
        id: "loop-1",
        name: "Loop",
        trials: [1, 2],
        branches: [],
      }),
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
        ?.updateLoop(
          "loop-1",
          { name: "Loop updated", trials: [2, 3], branches: [50] },
          newBranchTrial,
        );
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
      timelineLoop({
        id: "loop-1",
        name: "Loop",
        trials: [1, 2],
        branches: [],
      }),
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

    queueFetchResponses(
      okJson({ loop: currentLoop }),
      okJson({ loop: updatedLoop }),
    );

    const result = await act(async () => {
      return view.getContext()?.updateLoop("loop-1", { branches: [50] });
    });

    expect(result).toEqual(updatedLoop);
    expect(view.getContext()?.timeline).toEqual([
      timelineLoop({
        id: "loop-1",
        name: "Loop",
        trials: [1, 2],
        branches: [50],
      }),
      timelineTrial({ id: 99, name: "Bystander" }),
      timelineTrial({ id: 50, name: "Loading..." }),
    ]);
  });
});
