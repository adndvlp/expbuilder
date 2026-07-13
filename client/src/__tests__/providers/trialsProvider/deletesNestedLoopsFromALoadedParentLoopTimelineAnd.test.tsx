import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  loop,
  notOkJson,
  okJson,
  timelineLoop,
  timelineTrial,
} from "../../helpers/trialFactories";
import {
  queueFetchResponses,
  registerTrialsProviderLifecycle,
  renderLoadedProvider,
} from "./testHarness";

describe("TrialsProvider", () => {
  registerTrialsProviderLifecycle();

  it("deletes nested loops from a loaded parent loop timeline and reconnects terminal branches", async () => {
    const view = await renderLoadedProvider([]);
    const parentLoopTimeline = [
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
        branches: ["loop-child"],
      }),
      timelineLoop({
        id: "loop-child",
        name: "Child Loop",
        parentLoopId: "loop-parent",
        trials: [10, 11],
        branches: [99, 100],
      }),
      timelineTrial({
        id: 10,
        name: "Internal terminal",
        parentLoopId: "loop-child",
        branches: [99],
      }),
      timelineTrial({ id: 99, name: "Existing branch" }),
      timelineTrial({ id: 100, name: "New branch" }),
    ];
    const childLoop = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [10, 11],
      branches: [99, 100],
    });

    queueFetchResponses(okJson({ trialsMetadata: parentLoopTimeline }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-parent");
    });

    queueFetchResponses(
      okJson({ loop: childLoop }),
      okJson({
        trialsMetadata: [
          timelineTrial({
            id: 10,
            name: "Internal terminal",
            parentLoopId: "loop-child",
            branches: [99],
          }),
        ],
      }),
      okJson({}),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-child");
    });

    expect(result).toBe(true);
    const nextLoopTimeline = view.getContext()?.loopTimeline ?? [];
    expect(nextLoopTimeline.some((item) => item.id === "loop-child")).toBe(
      false,
    );
    expect(nextLoopTimeline).toContainEqual(
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
        branches: [10],
      }),
    );
    expect(
      nextLoopTimeline.some(
        (item) =>
          item.id === 10 &&
          item.parentLoopId === undefined &&
          item.branches?.includes(99) &&
          item.branches?.includes(100),
      ),
    ).toBe(true);
  });

  it("deletes a loop by restoring internal trials and reconnecting loop branches to the terminal internal item", async () => {
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-1"] }),
      timelineLoop({
        id: "loop-1",
        name: "Loop",
        trials: [10, 11],
        branches: [99],
      }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
    const loopToDelete = loop({
      id: "loop-1",
      name: "Loop",
      trials: [10, 11],
      branches: [99],
    });

    queueFetchResponses(
      okJson({ loop: loopToDelete }),
      okJson({
        trialsMetadata: [
          timelineTrial({ id: 10, name: "Internal A", branches: [11] }),
          timelineTrial({ id: 11, name: "Internal B", branches: [] }),
        ],
      }),
      okJson({}),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-1");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10] }),
      timelineTrial({
        id: 10,
        name: "Internal A",
        branches: [11],
        parentLoopId: undefined,
      }),
      timelineTrial({
        id: 11,
        name: "Internal B",
        branches: [99],
        parentLoopId: undefined,
      }),
      timelineTrial({ id: 99, name: "After loop" }),
    ]);
  });

  it("deletes selected loops using loaded loop timeline metadata and restores nested loops", async () => {
    const selected = loop({
      id: "loop-1",
      name: "Selected Loop",
      trials: [10, "nested-loop"],
      branches: [],
    });
    const view = await renderLoadedProvider([
      timelineTrial({ id: 1, name: "Parent", branches: ["loop-1"] }),
      timelineLoop({
        id: "loop-1",
        name: "Selected Loop",
        trials: [10, "nested-loop"],
      }),
      timelineTrial({ id: 99, name: "After" }),
    ]);
    const loadedLoopTimeline = [
      timelineTrial({
        id: 10,
        name: "Internal Trial",
        branches: ["nested-loop"],
      }),
      timelineLoop({ id: "nested-loop", name: "Nested Loop", trials: [20] }),
    ];

    queueFetchResponses(okJson({ trialsMetadata: loadedLoopTimeline }));
    await act(async () => {
      await view.getContext()?.getLoopTimeline("loop-1");
    });
    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    queueFetchResponses(okJson({}));

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-1");
    });

    expect(result).toBe(true);
    expect(view.getContext()?.selectedLoop).toBeNull();
    expect(view.getContext()?.timeline).toEqual([
      timelineTrial({ id: 1, name: "Parent", branches: [10] }),
      timelineTrial({
        id: 10,
        name: "Internal Trial",
        branches: ["nested-loop"],
        parentLoopId: undefined,
      }),
      timelineLoop({
        id: "nested-loop",
        name: "Nested Loop",
        trials: [20],
        parentLoopId: undefined,
      }),
      timelineTrial({ id: 99, name: "After" }),
    ]);
  });

  it("reloads parent loop timeline when deleting a nested loop fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const selected = loop({
      id: "loop-child",
      name: "Child Loop",
      parentLoopId: "loop-parent",
      trials: [10],
    });
    const view = await renderLoadedProvider([
      timelineLoop({
        id: "loop-parent",
        name: "Parent Loop",
        trials: ["loop-child"],
      }),
    ]);
    const reloaded = [timelineTrial({ id: 77, name: "Reloaded" })];

    act(() => {
      view.getContext()?.setSelectedLoop(selected);
    });

    queueFetchResponses(
      okJson({ trialsMetadata: [timelineTrial({ id: 10, name: "Internal" })] }),
      notOkJson(),
      okJson({ trialsMetadata: reloaded }),
    );

    const result = await act(async () => {
      return view.getContext()?.deleteLoop("loop-child");
    });

    expect(result).toBe(false);
    await waitFor(() => {
      expect(view.getContext()?.loopTimeline).toEqual(reloaded);
    });
    expect(console.error).toHaveBeenCalledWith(
      "Error deleting loop:",
      expect.any(Error),
    );
  });
});
