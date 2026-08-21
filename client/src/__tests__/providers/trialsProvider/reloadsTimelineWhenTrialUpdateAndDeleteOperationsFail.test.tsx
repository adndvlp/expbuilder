import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  graphJson,
  mutationJson,
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";
import {
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

describe("TrialsProvider", () => {
  registerTrialsProviderLifecycle();

  it("reloads timeline when trial update and delete operations fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = trial({ id: 1, name: "Selected", branches: [2] });
    const fresh = trial({ id: 1, name: "Fresh", branches: [] });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected", branches: [2] }),
      timelineTrial({ id: 2, name: "Child" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    queueFetchResponses(notOkJson(), graphJson([]));
    await expect(
      act(async () => view.getContext()?.updateTrial(1, { name: "Broken" })),
    ).resolves.toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "Error updating trial:",
      expect.any(Error),
    );

    queueFetchResponses(notOkJson(), okJson({ trial: fresh }), graphJson([]));
    const fieldResult = await act(async () => {
      return view.getContext()?.updateTrialField(1, "name", "Broken");
    });
    expect(fieldResult).toBe(false);
    expect(view.getContext()?.selectedTrial).toEqual(fresh);

    queueFetchResponses(notOkJson(), graphJson([]));
    const deleteResult = await act(async () => {
      return view.getContext()?.deleteTrial(1);
    });
    expect(deleteResult).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting trial:",
      expect.any(Error),
    );
  });

  it("keeps selectedTrial synchronized after granular trial updates", async () => {
    const selected = trial({ id: 1, name: "Before" });
    const updated = trial({ id: 1, name: "After" });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Before" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    const nextTimeline = [timelineTrial({ id: 1, name: "After" })];
    queueFetchResponses(mutationJson({ trial: updated }, nextTimeline));

    const result = await act(async () => {
      return view.getContext()?.updateTrialField(1, "name", "After");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedTrial).toEqual(updated);
    expect(view.getContext()?.timeline).toEqual(nextTimeline);
  });

  it("updates branch and non-visual fields without replacing selectedTrial", async () => {
    const selected = trial({ id: 1, name: "Selected", branches: [2] });
    const branchesUpdated = trial({
      id: 1,
      name: "Selected",
      branches: [],
    });
    const customCodeUpdated = trial({
      id: 1,
      name: "Selected",
      customOnFinish: "return true;",
    });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected", branches: [2] }),
      timelineTrial({ id: 2, name: "Unrelated" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });
    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    queueFetchResponses(
      mutationJson({ trial: branchesUpdated }, [
        timelineTrial({ id: 1, name: "Selected", branches: [] }),
        timelineTrial({ id: 2, name: "Unrelated" }),
      ]),
      okJson({ trial: customCodeUpdated }),
    );

    await expect(
      act(async () =>
        view.getContext()?.updateTrialField(1, "branches", [], false),
      ),
    ).resolves.toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Selected", branches: [] }),
      timelineTrial({ id: 2, name: "Unrelated" }),
    ]);
    expect(view.getContext()?.selectedTrial).toEqual(selected);

    await expect(
      act(async () =>
        view
          .getContext()
          ?.updateTrialField(1, "customOnFinish", "return true;", false),
      ),
    ).resolves.toBe(true);
    expect(view.getContext()?.selectedTrial).toEqual(selected);
  });

  it("does not refresh selection for unrelated field failures or missing fresh trials", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = trial({ id: 1, name: "Selected" });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Selected" }),
      timelineTrial({ id: 2, name: "Other" }),
    ]);

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });
    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    queueFetchResponses(
      notOkJson(),
      notOkJson(),
      graphJson(),
      notOkJson(),
      notOkJson(),
      graphJson(),
    );

    await expect(
      act(async () => view.getContext()?.updateTrialField(2, "name", "Broken")),
    ).resolves.toBe(false);
    await expect(
      act(async () =>
        view.getContext()?.updateTrialField(1, "name", "Still broken"),
      ),
    ).resolves.toBe(false);

    expect(view.getContext()?.selectedTrial).toEqual(selected);
  });

  it("updates active loop timeline when a nested trial field changes", async () => {
    const selected = trial({
      id: 10,
      name: "Nested Before",
      parentLoopId: "loop-1",
    });
    const updated = trial({
      id: 10,
      name: "Nested After",
      parentLoopId: "loop-1",
    });
    const view = await renderLoadedProvider([
      timelineLoop({ id: "loop-1", name: "Loop", trials: [10] }),
    ]);

    queueFetchResponses(
      okJson({
        trialsMetadata: [
          timelineTrial({
            id: 10,
            name: "Nested Before",
            parentLoopId: "loop-1",
          }),
        ],
      }),
    );

    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });

    act(() => {
      view.getContext()?.setSelectedTrial(selected);
    });

    await waitFor(() => {
      expect(view.getContext()?.selectedTrial).toEqual(selected);
    });

    const rootItems = [
      timelineLoop({ id: "loop-1", name: "Loop", trials: [10] }),
    ];
    const nestedItems = [
      timelineTrial({ id: 10, name: "Nested After", parentLoopId: "loop-1" }),
    ];
    queueFetchResponses(
      mutationJson({ trial: updated }, rootItems, {
        "loop-1": {
          scopeId: "loop-1",
          parentScopeId: null,
          items: nestedItems,
        },
      }),
    );

    const result = await act(async () => {
      return view.getContext()?.updateTrialField(10, "name", "Nested After");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedTrial).toEqual(updated);
    expect(view.getContext()?.loopTimeline).toEqual(nestedItems);
  });

  it("reconnects parent branches to deleted trial children", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: [2, 3] }),
      timelineTrial({ id: 2, name: "Deleted", branches: [3, 4] }),
      timelineTrial({ id: 3, name: "Child A" }),
      timelineTrial({ id: 4, name: "Child B" }),
    ]);

    const nextTimeline = [
      timelineTrial({ id: 1, name: "Parent", branches: [3, 4] }),
      timelineTrial({ id: 3, name: "Child A" }),
      timelineTrial({ id: 4, name: "Child B" }),
    ];
    queueFetchResponses(mutationJson({}, nextTimeline));

    const result = await act(async () => {
      return view.getContext()?.deleteTrial(2);
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual(nextTimeline);
  });
});
