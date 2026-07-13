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

    queueFetchResponses(
      okJson({ loop: loopToDelete }),
      notOkJson(),
      okJson({}),
    );

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
      timelineLoop({
        id: "loop-edge",
        name: "Loop",
        trials: [10, "nested-loop"],
        branches: [99],
      }),
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
          timelineTrial({
            id: 10,
            name: "Internal without branches",
            branches: undefined as any,
          }),
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
      timelineLoop({
        id: "loop-visible",
        name: "Loop",
        trials: [10],
        branches: [99],
      }),
      timelineTrial({
        id: 10,
        name: "Visible internal",
        branches: undefined as any,
      }),
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
      timelineLoop({
        id: "loop-cycle",
        name: "Loop",
        trials: [10, 11],
        branches: [99],
      }),
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
      timelineTrial({
        id: 10,
        name: "Internal A",
        branches: [11, 99],
        parentLoopId: undefined,
      }),
      timelineTrial({
        id: 11,
        name: "Internal B",
        branches: [10],
        parentLoopId: undefined,
      }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
  });
});
