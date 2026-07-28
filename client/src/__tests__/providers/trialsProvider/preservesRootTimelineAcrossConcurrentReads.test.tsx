import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../../pages/ExperimentBuilder/contexts/TrialsContext";
import { okJson } from "../../helpers/trialFactories";
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
      .mockResolvedValueOnce(okJson({ timeline: populatedTimeline }));

    const view = renderTrialsProvider();
    await waitFor(() => {
      expect(fetchMock()).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await view.getContext()?.getTimeline();
    });
    expect(view.getContext()?.timeline).toEqual(populatedTimeline);

    await act(async () => {
      slowInitialLoad.resolve(okJson({ timeline: [] }));
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
      .mockResolvedValueOnce(okJson({ timeline: savedTimeline }));

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
      slowRefresh.resolve(okJson({ timeline: originalTimeline }));
      await slowRefresh.promise;
    });

    expect(view.getContext()?.timeline).toEqual(savedTimeline);
    expect(view.getContext()?.isLoading).toBe(false);
  });
});
