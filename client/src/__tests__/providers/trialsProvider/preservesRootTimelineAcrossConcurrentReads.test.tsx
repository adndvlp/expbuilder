import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import { graphJson, loop, okJson, trial } from "../../helpers/trialFactories";
import {
  fetchMock,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
  renderTrialsProvider,
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

describe("TrialsProvider root timeline concurrency", () => {
  registerTrialsProviderLifecycle();

  it("ignores an older empty initial response after a newer read succeeds", async () => {
    const slowInitialLoad = deferredResponse();
    const populatedTimeline = [item("welcome", "Welcome")];
    fetchMock()
      .mockImplementationOnce(() => slowInitialLoad.promise)
      .mockResolvedValueOnce(graphJson(populatedTimeline));

    const view = renderTrialsProvider();
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await view.getContext()?.getTimeline();
    });
    expect(view.getContext()?.timeline).toEqual(populatedTimeline);

    await act(async () => {
      slowInitialLoad.resolve(graphJson([]));
      await slowInitialLoad.promise;
    });

    expect(view.getContext()?.timeline).toEqual(populatedTimeline);
    expect(view.getContext()?.isLoading).toBe(false);
  });

  it("does not let a pending read overwrite a newer local timeline save", async () => {
    const originalTimeline = [item("welcome", "Original")];
    const savedTimeline = [item("welcome", "Saved")];
    const view = await renderLoadedProvider(originalTimeline);
    const slowRefresh = deferredResponse();
    fetchMock()
      .mockImplementationOnce(() => slowRefresh.promise)
      .mockResolvedValueOnce(graphJson(savedTimeline));

    act(() => {
      void view.getContext()?.getTimeline();
    });
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      await view.getContext()?.updateTimeline(savedTimeline);
    });
    expect(view.getContext()?.timeline).toEqual(savedTimeline);

    await act(async () => {
      slowRefresh.resolve(graphJson(originalTimeline));
      await slowRefresh.promise;
    });

    expect(view.getContext()?.timeline).toEqual(savedTimeline);
    expect(view.getContext()?.isLoading).toBe(false);
  });

  it("does not cancel a cold timeline load for nonvisual saves", async () => {
    const slowInitialLoad = deferredResponse();
    const populatedTimeline = [item("trial-1", "Loaded Trial")];
    const selectedTrial = trial({
      id: "trial-1",
      name: "Loaded Trial",
      parameters: { stimulus: "updated" },
    });
    const selectedLoop = loop({
      id: "loop-1",
      name: "Loop",
      repetitions: 2,
    });
    fetchMock()
      .mockImplementationOnce(() => slowInitialLoad.promise)
      .mockResolvedValueOnce(okJson({ trial: selectedTrial }))
      .mockResolvedValueOnce(okJson({ loop: selectedLoop }));

    const view = renderTrialsProvider();
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    });
    act(() => view.getContext()?.setSelectedTrial(selectedTrial));
    act(() => view.getContext()?.setSelectedLoop(selectedLoop));

    await act(async () => {
      await view
        .getContext()
        ?.updateTrial("trial-1", { parameters: { stimulus: "updated" } });
      await view.getContext()?.updateLoop("loop-1", { repetitions: 2 });
    });
    await act(async () => {
      slowInitialLoad.resolve(graphJson(populatedTimeline));
      await slowInitialLoad.promise;
    });

    expect(view.getContext()?.timeline).toEqual(populatedTimeline);
    expect(view.getContext()?.isLoading).toBe(false);
  });
});
