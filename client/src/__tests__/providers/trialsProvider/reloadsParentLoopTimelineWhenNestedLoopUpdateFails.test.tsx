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

  it("reloads parent loop timeline when nested loop update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [1],
    });
    const view = await renderLoadedProvider([
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
      }),
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
      return view
        .getContext()
        ?.updateLoopField("other-loop", "randomize", false);
    });

    expect(failedResult).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Error updating randomize:",
      expect.any(Error),
    );
  });

  it("handles loop field responses missing arrays and stale selected refresh misses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({
      id: "loop-1",
      name: "Before",
      trials: [1],
      branches: [2],
    });
    const view = await renderLoadedProvider([
      timelineLoop({
        id: "loop-1",
        name: "Before",
        trials: [1],
        branches: [2],
      }),
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
      timelineLoop({
        id: "loop-1",
        name: "Server Missing Arrays",
        branches: [],
        trials: [],
      }),
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
});
