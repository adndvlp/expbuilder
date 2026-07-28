import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import { okJson, trial } from "../../helpers/trialFactories";
import {
  fetchMock,
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

const item = (id: string, name: string): TimelineItem => ({
  id,
  type: "trial",
  name,
  branches: [],
});

const deferredResponse = () => {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("TrialsProvider loop timeline cache", () => {
  registerTrialsProviderLifecycle();

  it("keeps independent loop caches and activates them without another fetch", async () => {
    const view = await renderLoadedProvider();
    const parentItems = [item("parent-trial", "Parent trial")];
    const childItems = [item("child-trial", "Child trial")];

    queueFetchResponses(
      okJson({ trialsMetadata: parentItems }),
      okJson({ trialsMetadata: childItems }),
    );

    await act(async () => {
      await view
        .getContext()
        ?.getLoopTimeline("parent", { mode: "cache" });
      await view.getContext()?.getLoopTimeline("child", { mode: "cache" });
    });

    expect(view.getContext()?.activeLoopId).toBeNull();
    expect(view.getContext()?.loopTimelineCache.parent?.items).toEqual(
      parentItems,
    );
    expect(view.getContext()?.loopTimelineCache.child?.items).toEqual(
      childItems,
    );

    const fetchCalls = fetchMock().mock.calls.length;
    act(() => {
      expect(view.getContext()?.activateLoopTimeline("parent")).toBe(true);
    });
    expect(view.getContext()?.activeLoopId).toBe("parent");
    expect(view.getContext()?.loopTimeline).toEqual(parentItems);

    act(() => {
      expect(view.getContext()?.activateLoopTimeline("child")).toBe(true);
    });
    expect(view.getContext()?.activeLoopId).toBe("child");
    expect(view.getContext()?.loopTimeline).toEqual(childItems);
    expect(fetchMock()).toHaveBeenCalledTimes(fetchCalls);

    act(() => view.getContext()?.clearLoopTimeline());
    expect(view.getContext()?.activeLoopId).toBeNull();
    expect(view.getContext()?.loopTimeline).toEqual([]);
    expect(view.getContext()?.loopTimelineCache.parent?.items).toEqual(
      parentItems,
    );
  });

  it("keeps query reads outside the cache and visual scope", async () => {
    const view = await renderLoadedProvider();
    const queriedItems = [item("query-trial", "Query trial")];
    queueFetchResponses(okJson({ trialsMetadata: queriedItems }));

    const result = await act(async () =>
      view
        .getContext()
        ?.getLoopTimeline("query-loop", { mode: "query" }),
    );

    expect(result).toEqual(queriedItems);
    expect(view.getContext()?.activeLoopId).toBeNull();
    expect(view.getContext()?.loopTimelineCache["query-loop"]).toBeUndefined();
  });

  it("does not let an older activation override a newer scope", async () => {
    const view = await renderLoadedProvider();
    const slow = deferredResponse();
    const fastItems = [item("fast-trial", "Fast trial")];

    fetchMock()
      .mockImplementationOnce(() => slow.promise)
      .mockResolvedValueOnce(okJson({ trialsMetadata: fastItems }));

    let slowLoad!: Promise<TimelineItem[]>;
    act(() => {
      slowLoad =
        view
          .getContext()
          ?.getLoopTimeline("slow", {
            mode: "activate",
            forceRefresh: true,
          }) ?? Promise.resolve([]);
    });

    await act(async () => {
      await view.getContext()?.getLoopTimeline("fast", {
        mode: "activate",
        forceRefresh: true,
      });
    });
    slow.resolve(
      okJson({ trialsMetadata: [item("slow-trial", "Slow trial")] }),
    );
    await act(async () => {
      await slowLoad;
    });

    await waitFor(() => {
      expect(view.getContext()?.activeLoopId).toBe("fast");
      expect(view.getContext()?.loopTimeline).toEqual(fastItems);
    });
  });

  it("updates only the cache identified by the saved trial parentLoopId", async () => {
    const view = await renderLoadedProvider();
    const parentItems = [item("parent-trial", "Parent trial")];
    const childItems = [item("child-trial", "Child trial")];
    queueFetchResponses(
      okJson({ trialsMetadata: parentItems }),
      okJson({ trialsMetadata: childItems }),
    );
    await act(async () => {
      await view.getContext()?.getLoopTimeline("parent", { mode: "cache" });
      await view.getContext()?.getLoopTimeline("child", { mode: "cache" });
    });
    act(() => {
      view.getContext()?.activateLoopTimeline("child");
    });

    const updated = trial({
      id: "parent-trial",
      name: "Parent saved",
      parentLoopId: "parent",
    });
    queueFetchResponses(okJson({ trial: updated }));
    await act(async () => {
      await view
        .getContext()
        ?.updateTrial("parent-trial", { name: "Parent saved" });
    });

    expect(view.getContext()?.activeLoopId).toBe("child");
    expect(view.getContext()?.loopTimelineCache.parent?.items).toEqual([
      item("parent-trial", "Parent saved"),
    ]);
    expect(view.getContext()?.loopTimelineCache.child?.items).toEqual(
      childItems,
    );
    expect(view.getContext()?.loopTimeline).toEqual(childItems);
  });

  it("does not let an older refresh overwrite a newer local save", async () => {
    const view = await renderLoadedProvider();
    const original = [item("parent-trial", "Original")];
    queueFetchResponses(okJson({ trialsMetadata: original }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("parent", { mode: "cache" });
    });

    const slowRefresh = deferredResponse();
    const savedTrial = trial({
      id: "parent-trial",
      name: "Saved while refreshing",
      parentLoopId: "parent",
    });
    fetchMock()
      .mockImplementationOnce(() => slowRefresh.promise)
      .mockResolvedValueOnce(okJson({ trial: savedTrial }));

    let refresh!: Promise<TimelineItem[]>;
    act(() => {
      refresh =
        view.getContext()?.getLoopTimeline("parent", {
          mode: "cache",
          forceRefresh: true,
        }) ?? Promise.resolve([]);
    });
    await act(async () => {
      await view
        .getContext()
        ?.updateTrial("parent-trial", { name: "Saved while refreshing" });
    });

    slowRefresh.resolve(okJson({ trialsMetadata: original }));
    await act(async () => {
      await refresh;
    });

    expect(view.getContext()?.loopTimelineCache.parent?.items).toEqual([
      item("parent-trial", "Saved while refreshing"),
    ]);
  });
});
