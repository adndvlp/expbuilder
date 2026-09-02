import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GraphScopeView } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";
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

const root = [timelineLoop({ id: "loop-parent", trials: ["loop-child"] })];

function parentScope(items: GraphScopeView["items"]) {
  return {
    "loop-parent": {
      scopeId: "loop-parent",
      parentScopeId: null,
      items,
    },
  };
}

async function renderNestedGraph(items: GraphScopeView["items"]) {
  queueFetchResponses(graphJson(root, parentScope(items)));
  const view = renderTrialsProvider();
  await waitFor(() => {
    expect(view.getContext()?.timeline).toEqual(root);
    expect(view.getContext()?.loopTimelineCache["loop-parent"]?.items).toEqual(
      items,
    );
  });
  return view;
}

describe("TrialsProvider canonical nested-loop deletion", () => {
  registerTrialsProviderLifecycle();

  it("atomically replaces the parent scope and clears the deleted selection", async () => {
    const view = await renderNestedGraph([
      timelineLoop({
        id: "loop-child",
        parentLoopId: "loop-parent",
        trials: [10, 11],
      }),
      timelineTrial({ id: 99 }),
    ]);
    const selected = loop({
      id: "loop-child",
      parentLoopId: "loop-parent",
      trials: [10, 11],
    });
    act(() => view.getContext()?.setSelectedLoop(selected));
    const after = [
      timelineTrial({ id: 10, name: "Internal A", branches: [11] }),
      timelineTrial({ id: 11, name: "Internal B", branches: [99] }),
      timelineTrial({ id: 99 }),
    ];
    queueFetchResponses(mutationJson({}, root, parentScope(after)));

    const result = await act(async () =>
      view.getContext()?.deleteLoop("loop-child"),
    );

    expect(result).toBe(true);
    expect(view.getContext()?.selectedLoop).toBeNull();
    expect(view.getContext()?.loopTimelineCache["loop-parent"]?.items).toEqual(
      after,
    );
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it("reloads every scope from the canonical endpoint after deletion fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderNestedGraph([
      timelineLoop({ id: "loop-child", parentLoopId: "loop-parent" }),
    ]);
    const serverState = [timelineTrial({ id: 77, name: "Server state" })];
    queueFetchResponses(
      notOkJson(),
      graphJson(root, parentScope(serverState)),
    );

    const result = await act(async () =>
      view.getContext()?.deleteLoop("loop-child"),
    );

    expect(result).toBe(false);
    await waitFor(() => {
      expect(
        view.getContext()?.loopTimelineCache["loop-parent"]?.items,
      ).toEqual(serverState);
    });
    expect(fetchMock()).toHaveBeenCalledTimes(3);
  });
});
