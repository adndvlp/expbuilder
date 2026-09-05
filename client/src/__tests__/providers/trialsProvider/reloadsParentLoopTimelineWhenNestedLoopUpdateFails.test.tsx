import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  graphJson,
  loop,
  mutationJson,
  notOkJson,
  timelineLoop,
  timelineTrial,
} from "../../helpers/trialFactories";
import {
  fetchMock,
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderTrialsProvider,
} from "./testHarness";

const parentScope = (items: ReturnType<typeof timelineTrial>[]) => ({
  "loop-parent": {
    scopeId: "loop-parent",
    parentScopeId: null,
    items,
  },
});

async function renderGraph(
  root: ReturnType<typeof timelineLoop>[],
  scopes: ReturnType<typeof parentScope>,
) {
  queueFetchResponses(graphJson(root, scopes));
  const view = renderTrialsProvider();
  await waitFor(() => {
    expect(view.getContext()?.timeline).toEqual(root);
    expect(view.getContext()?.loopTimelineCache["loop-parent"]?.items).toEqual(
      scopes["loop-parent"].items,
    );
  });
  return view;
}

describe("TrialsProvider canonical loop updates", () => {
  registerTrialsProviderLifecycle();

  it("reloads the complete graph after a structural nested-loop update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const root = [
      timelineLoop({ id: "loop-parent", name: "Parent", trials: [1] }),
    ];
    const reloaded = [timelineTrial({ id: 2, name: "Server state" })];
    const view = await renderGraph(
      root,
      parentScope([timelineTrial({ id: 1 })]),
    );

    queueFetchResponses(notOkJson(), graphJson(root, parentScope(reloaded)));
    const result = await act(async () =>
      view.getContext()?.updateLoop("loop-child", { trials: [2] }),
    );

    expect(result).toBeNull();
    await waitFor(() => {
      expect(
        view.getContext()?.loopTimelineCache["loop-parent"]?.items,
      ).toEqual(reloaded);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(3);
  });

  it("applies a nested-loop field response without mutating selected-loop state", async () => {
    const before = [timelineTrial({ id: 1, name: "Before" })];
    const after = [timelineTrial({ id: 2, name: "After" })];
    const root = [
      timelineLoop({ id: "loop-parent", trials: ["loop-child"] }),
    ];
    const view = await renderGraph(root, parentScope(before));
    const selected = loop({
      id: "loop-child",
      parentLoopId: "loop-parent",
      trials: [1],
    });
    const updated = loop({
      id: "loop-child",
      parentLoopId: "loop-parent",
      trials: [2],
    });
    act(() => view.getContext()?.setSelectedLoop(selected));

    queueFetchResponses(
      mutationJson({ loop: updated }, root, parentScope(after)),
    );
    const result = await act(async () =>
      view
        .getContext()
        ?.updateLoopField("loop-child", "trials", [2], false),
    );

    expect(result).toBe(true);
    expect(view.getContext()?.selectedLoop).toEqual(selected);
    expect(view.getContext()?.loopTimelineCache["loop-parent"]?.items).toEqual(
      after,
    );
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });
});
