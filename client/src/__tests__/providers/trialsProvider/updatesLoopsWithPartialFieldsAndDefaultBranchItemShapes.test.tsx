import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GraphScopeView } from "../../../pages/ExperimentBuilder/modules/experiment-graph/types";
import {
  graphJson,
  loop,
  mutationJson,
  okJson,
  timelineLoop,
  timelineTrial,
} from "../../helpers/trialFactories";
import {
  API_URL,
  fetchMock,
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

function loopScope(items: GraphScopeView["items"]) {
  return {
    "loop-1": {
      scopeId: "loop-1",
      parentScopeId: null,
      items,
    },
  };
}

describe("TrialsProvider canonical full-loop updates", () => {
  registerTrialsProviderLifecycle();

  it("applies one structural update without issuing child ownership patches", async () => {
    const initial = [timelineLoop({ id: "loop-1", trials: [1] })];
    const view = await renderLoadedProvider(initial);
    const updated = loop({ id: "loop-1", trials: [2], branches: [50] });
    const rootAfter = [
      timelineLoop({ id: "loop-1", trials: [2], branches: [50] }),
      timelineTrial({ id: 50, name: "Exit" }),
    ];
    const scopeAfter = [timelineTrial({ id: 2, parentLoopId: "loop-1" })];
    queueFetchResponses(
      mutationJson({ loop: updated }, rootAfter, loopScope(scopeAfter)),
    );

    const result = await act(async () =>
      view
        .getContext()
        ?.updateLoop("loop-1", { trials: [2], branches: [50] }),
    );

    expect(result).toEqual(updated);
    expect(view.getContext()?.timeline).toEqual(rootAfter);
    expect(view.getContext()?.loopTimelineCache["loop-1"]?.items).toEqual(
      scopeAfter,
    );
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    expect(fetchMock()).not.toHaveBeenCalledWith(
      `${API_URL}/api/trial/test-exp-123/2`,
      expect.anything(),
    );
  });

  it("does not synthesize placeholder branch items absent from the server graph", async () => {
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", branches: [] }),
      timelineTrial({ id: 99, name: "Bystander" }),
    ]);
    const updated = loop({ id: "loop-1", branches: [50] });
    const rootAfter = [
      timelineLoop({ id: "loop-1", branches: [50] }),
      timelineTrial({ id: 99, name: "Bystander" }),
    ];
    queueFetchResponses(mutationJson({ loop: updated }, rootAfter));

    await act(async () =>
      view.getContext()?.updateLoop("loop-1", { branches: [50] }),
    );

    expect(view.getContext()?.timeline).toEqual(rootAfter);
    expect(view.getContext()?.timeline).not.toContainEqual(
      expect.objectContaining({ id: 50, name: "Loading..." }),
    );
  });

  it("recovers from a malformed structural response through the graph endpoint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Before" }),
    ]);
    const reloaded = [timelineTrial({ id: 7, name: "Server state" })];
    queueFetchResponses(
      okJson({ loop: loop({ id: "loop-1", name: "After" }) }),
      graphJson(reloaded),
    );

    const result = await act(async () =>
      view.getContext()?.updateLoop("loop-1", { name: "After" }),
    );

    expect(result).toBeNull();
    await waitFor(() => expect(view.getContext()?.timeline).toEqual(reloaded));
    expect(fetchMock()).toHaveBeenCalledTimes(3);
  });
});
