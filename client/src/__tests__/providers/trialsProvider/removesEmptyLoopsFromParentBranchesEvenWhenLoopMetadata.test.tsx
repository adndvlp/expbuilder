import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  mutationJson,
  timelineLoop,
  timelineTrial,
} from "../../helpers/trialFactories";
import {
  fetchMock,
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

describe("TrialsProvider canonical loop deletion", () => {
  registerTrialsProviderLifecycle();

  it("accepts the server snapshot when deleting an empty loop", async () => {
    const initial = [
      timelineTrial({ id: 1, name: "Parent", branches: ["empty-loop", 2] }),
      timelineLoop({ id: "empty-loop", name: "Empty Loop" }),
      timelineTrial({ id: 2, name: "Sibling" }),
    ];
    const after = [
      timelineTrial({ id: 1, name: "Parent", branches: [2] }),
      timelineTrial({ id: 2, name: "Sibling" }),
    ];
    const view = await renderLoadedProvider(initial);
    queueFetchResponses(mutationJson({}, after));

    const result = await act(async () =>
      view.getContext()?.deleteLoop("empty-loop"),
    );

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual(after);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("uses server-owned unwrapping instead of reconstructing incomplete metadata", async () => {
    const initial = [
      timelineTrial({ id: 1, branches: ["loop-edge"] }),
      timelineLoop({
        id: "loop-edge",
        trials: [10, "nested-loop"],
        branches: [99],
      }),
      timelineTrial({ id: 99 }),
    ];
    const after = [
      timelineTrial({ id: 1, branches: [10] }),
      timelineTrial({ id: 10, name: "Internal", branches: [99] }),
      timelineLoop({ id: "nested-loop", trials: [20] }),
      timelineTrial({ id: 99 }),
    ];
    const view = await renderLoadedProvider(initial);
    queueFetchResponses(mutationJson({}, after));

    const result = await act(async () =>
      view.getContext()?.deleteLoop("loop-edge"),
    );

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual(after);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });
});
