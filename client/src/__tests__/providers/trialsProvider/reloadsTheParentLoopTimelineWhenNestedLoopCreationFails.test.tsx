import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GraphScopeView } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";
import {
  graphJson,
  loop,
  loopDraft,
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

const root = [timelineLoop({ id: "loop-parent", trials: [10, 11] })];

function scopes(
  parentItems: GraphScopeView["items"],
  childItems: GraphScopeView["items"] = [],
): Record<string, GraphScopeView> {
  return {
    "loop-parent": {
      scopeId: "loop-parent",
      parentScopeId: null,
      items: parentItems,
    },
    ...(childItems.length > 0
      ? {
          "loop-child": {
            scopeId: "loop-child",
            parentScopeId: "loop-parent",
            items: childItems,
          },
        }
      : {}),
  };
}

async function renderGraph(parentItems: GraphScopeView["items"]) {
  queueFetchResponses(graphJson(root, scopes(parentItems)));
  const view = renderTrialsProvider();
  await waitFor(() => {
    expect(view.getContext()?.timeline).toEqual(root);
    expect(view.getContext()?.loopTimelineCache["loop-parent"]?.items).toEqual(
      parentItems,
    );
  });
  return view;
}

describe("TrialsProvider canonical nested-loop creation", () => {
  registerTrialsProviderLifecycle();

  it("reloads the graph when nested-loop creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderGraph([timelineTrial({ id: 10 })]);
    const reloaded = [timelineTrial({ id: 11, name: "Server state" })];
    queueFetchResponses(notOkJson(), graphJson(root, scopes(reloaded)));

    let caught: unknown;
    await act(async () => {
      try {
        await view.getContext()?.createLoop(
          loopDraft({ parentLoopId: "loop-parent", trials: [10] }),
        );
      } catch (error: unknown) {
        caught = error;
      }
    });

    expect(caught).toEqual(expect.any(Error));
    expect((caught as Error).message).toBe("Failed to create loop");
    expect(fetchMock()).toHaveBeenCalledTimes(3);
    await waitFor(() => {
      expect(
        view.getContext()?.loopTimelineCache["loop-parent"]?.items,
      ).toEqual(reloaded);
    });
  });

  it("replaces parent and child scopes from one successful response", async () => {
    const view = await renderGraph([
      timelineTrial({ id: 10 }),
      timelineTrial({ id: 11 }),
      timelineTrial({ id: 12, name: "Bystander" }),
    ]);
    const created = loop({
      id: "loop-child",
      name: "Nested Created",
      parentLoopId: "loop-parent",
      trials: [10, 11],
    });
    const parentAfter = [
      timelineLoop({
        id: "loop-child",
        name: "Nested Created",
        parentLoopId: "loop-parent",
        trials: [10, 11],
      }),
      timelineTrial({ id: 12, name: "Bystander" }),
    ];
    const childAfter = [timelineTrial({ id: 10 }), timelineTrial({ id: 11 })];
    queueFetchResponses(
      mutationJson({ loop: created }, root, scopes(parentAfter, childAfter)),
    );

    const result = await act(async () =>
      view.getContext()?.createLoop(
        loopDraft({
          name: "Nested Created",
          parentLoopId: "loop-parent",
          trials: [10, 11],
        }),
      ),
    );

    expect(result).toEqual(created);
    expect(view.getContext()?.loopTimelineCache["loop-parent"]?.items).toEqual(
      parentAfter,
    );
    expect(view.getContext()?.loopTimelineCache["loop-child"]?.items).toEqual(
      childAfter,
    );
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });
});
