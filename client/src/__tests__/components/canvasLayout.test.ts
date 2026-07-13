import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GenerateNodesAndEdges from "../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges";
import { useFlowLayout } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout";
import { LAYOUT_CONSTANTS } from "../../pages/ExperimentBuilder/components/Canvas/utils/layoutUtils";
import { loop, timelineLoop, timelineTrial, trial } from "../helpers/trialFactories";

describe("useFlowLayout", () => {
  it("renders top-level sequence nodes while excluding branch children and trials inside loops", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Start", branches: [2] }),
      timelineTrial({ id: 2, name: "Branch child" }),
      timelineLoop({ id: "loop_1", name: "Practice Loop", trials: [3] }),
      timelineTrial({ id: 3, name: "Inside Loop" }),
      timelineTrial({ id: 4, name: "End" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onAddBranch: vi.fn(),
        onOpenLoop: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-1",
      "trial-2",
      "loop-loop_1",
      "trial-4",
    ]);
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["trial-1", "trial-2"],
      ["loop-loop_1", "trial-4"],
    ]);
  });

  it("marks selected trials and wires selection plus add-branch callbacks", () => {
    const onSelectTrial = vi.fn();
    const onAddBranch = vi.fn();
    const selectedTrial = trial({ id: 1, name: "Selected" });

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline: [timelineTrial({ id: 1, name: "Selected" })],
        selectedTrial,
        selectedLoop: null,
        onSelectTrial,
        onSelectLoop: vi.fn(),
        onAddBranch,
        onOpenLoop: vi.fn(),
      }),
    );

    const node = result.current.nodes[0];

    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");

    act(() => {
      node.data.onClick();
      node.data.onAddBranch();
    });

    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Selected" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith(1);
  });

  it("marks selected loops and wires open-loop callbacks", () => {
    const onSelectLoop = vi.fn();
    const onAddBranch = vi.fn();
    const onOpenLoop = vi.fn();
    const selectedLoop = loop({ id: "loop_1", name: "Practice Loop" });

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline: [timelineLoop({ id: "loop_1", name: "Practice Loop" })],
        selectedTrial: null,
        selectedLoop,
        onSelectTrial: vi.fn(),
        onSelectLoop,
        onAddBranch,
        onOpenLoop,
      }),
    );

    const node = result.current.nodes[0];

    expect(node.id).toBe("loop-loop_1");
    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");
    expect(typeof node.data.onOpenLoop).toBe("function");

    act(() => {
      node.data.onClick();
      node.data.onAddBranch();
      node.data.onOpenLoop();
    });

    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_1", name: "Practice Loop" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith("loop_1");
    expect(onOpenLoop).toHaveBeenCalledWith("loop_1");
  });

  it("renders recursive trial and loop branches without duplicating shared nodes", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Start", branches: [2, "loop_branch"] }),
      timelineTrial({ id: 2, name: "Branch A", branches: [3] }),
      timelineTrial({ id: 3, name: "Shared terminal" }),
      timelineLoop({
        id: "loop_branch",
        name: "Loop Branch",
        branches: [3, "loop_nested"],
      }),
      timelineLoop({ id: "loop_nested", name: "Nested Branch Loop", branches: [4] }),
      timelineTrial({ id: 4, name: "Nested terminal" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onAddBranch: vi.fn(),
        onOpenLoop: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-1",
      "trial-2",
      "trial-3",
      "loop-loop_branch",
      "loop-loop_nested",
      "trial-4",
    ]);
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-1", "trial-2"],
        ["trial-2", "trial-3"],
        ["trial-1", "loop-loop_branch"],
        ["loop-loop_branch", "trial-3"],
        ["loop-loop_branch", "loop-loop_nested"],
        ["loop-loop_nested", "trial-4"],
      ]),
    );
  });

  it("skips missing and legacy branch references", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Root", branches: [999, 2, "loop_branch"] }),
      timelineTrial({ id: 2, name: "Nested Trial", branches: [998, 3] }),
      { id: 3, name: "Legacy Child", branches: [] },
      timelineLoop({
        id: "loop_branch",
        name: "Loop Branch",
        branches: [997, "legacy_loop_child"],
      }),
      {
        id: "legacy_loop_child",
        name: "Legacy Loop Child",
        trials: [],
        branches: [],
      },
      timelineTrial({ id: 10, name: "Sequential Trial" }),
      timelineLoop({ id: "loop_11", name: "Sequential Loop" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "trial-1",
        "trial-2",
        "loop-loop_branch",
        "trial-10",
        "loop-loop_11",
      ]),
    );
    expect(result.current.nodes.map((node) => node.id)).not.toContain("trial-999");
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toContainEqual([
      "trial-10",
      "loop-loop_11",
    ]);
  });

  it("continues from a shared terminal branch target to the next top-level item", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Randomizer", branches: [2, 3] }),
      timelineTrial({ id: 2, name: "Control", branches: [4] }),
      timelineTrial({ id: 3, name: "Intervention", branches: [4] }),
      timelineTrial({ id: 4, name: "Post-test" }),
      timelineTrial({ id: 5, name: "End" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onAddBranch: vi.fn(),
        onOpenLoop: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-1",
      "trial-2",
      "trial-4",
      "trial-3",
      "trial-5",
    ]);
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-1", "trial-2"],
        ["trial-1", "trial-3"],
        ["trial-2", "trial-4"],
        ["trial-3", "trial-4"],
        ["trial-4", "trial-5"],
      ]),
    );
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).not.toContainEqual([
      "trial-1",
      "trial-5",
    ]);

    const nodesById = new Map(result.current.nodes.map((node) => [node.id, node]));
    const control = nodesById.get("trial-2")!;
    const intervention = nodesById.get("trial-3")!;
    const postTest = nodesById.get("trial-4")!;

    expect(postTest.position.x).toBeCloseTo(
      (control.position.x + intervention.position.x) / 2,
    );
    expect(postTest.position.y).toBe(
      Math.max(control.position.y, intervention.position.y) +
        LAYOUT_CONSTANTS.branchVerticalOffset,
    );
  });

  it("continues from a shared trial merge target to a following loop", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Split", branches: [2, 3] }),
      timelineTrial({ id: 2, name: "Path A", branches: [4] }),
      timelineTrial({ id: 3, name: "Path B", branches: [4] }),
      timelineTrial({ id: 4, name: "Shared Trial" }),
      timelineLoop({ id: "loop_after", name: "Loop After Merge" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onAddBranch: vi.fn(),
        onOpenLoop: vi.fn(),
      }),
    );

    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toContainEqual([
      "trial-4",
      "loop-loop_after",
    ]);
  });

  it("centers a shared loop merge target under branch parents", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Welcome" }),
      timelineTrial({ id: 2, name: "Consent", branches: [3, 4] }),
      timelineTrial({ id: 3, name: "Instructions", branches: ["loop_1"] }),
      timelineTrial({ id: 4, name: "Final1", branches: ["loop_1"] }),
      timelineLoop({ id: "loop_1", name: "Loop 1" }),
      timelineTrial({ id: 5, name: "Final2" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onAddBranch: vi.fn(),
        onOpenLoop: vi.fn(),
      }),
    );

    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-2", "trial-3"],
        ["trial-2", "trial-4"],
        ["trial-3", "loop-loop_1"],
        ["trial-4", "loop-loop_1"],
        ["loop-loop_1", "trial-5"],
      ]),
    );

    const nodesById = new Map(result.current.nodes.map((node) => [node.id, node]));
    const instructions = nodesById.get("trial-3")!;
    const final1 = nodesById.get("trial-4")!;
    const mergeLoop = nodesById.get("loop-loop_1")!;
    const final2 = nodesById.get("trial-5")!;

    expect(mergeLoop.position.x).toBeCloseTo(
      (instructions.position.x + final1.position.x) / 2,
    );
    expect(mergeLoop.position.y).toBe(
      Math.max(instructions.position.y, final1.position.y) +
        LAYOUT_CONSTANTS.branchVerticalOffset,
    );
    expect(final2.position.x).toBeCloseTo(mergeLoop.position.x);
  });

  it("keeps branch node identity stable when the branch moves to a different parent", () => {
    const beforeMove = [
      timelineTrial({ id: 1, name: "Old Parent", branches: [2] }),
      timelineTrial({ id: 2, name: "Moved Branch" }),
      timelineTrial({ id: 3, name: "New Parent" }),
    ];
    const afterMove = [
      timelineTrial({ id: 1, name: "Old Parent" }),
      timelineTrial({ id: 3, name: "New Parent", branches: [2] }),
      timelineTrial({ id: 2, name: "Moved Branch" }),
    ];

    const { result, rerender } = renderHook(
      ({ timeline }) =>
        useFlowLayout({
          timeline,
          selectedTrial: null,
          selectedLoop: null,
          onSelectTrial: vi.fn(),
          onSelectLoop: vi.fn(),
          onAddBranch: vi.fn(),
          onOpenLoop: vi.fn(),
        }),
      { initialProps: { timeline: beforeMove } },
    );

    expect(result.current.nodes.map((node) => node.id)).toContain("trial-2");
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toContainEqual([
      "trial-1",
      "trial-2",
    ]);

    rerender({ timeline: afterMove });

    expect(result.current.nodes.map((node) => node.id)).toContain("trial-2");
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toContainEqual([
      "trial-3",
      "trial-2",
    ]);
    expect(result.current.nodes.map((node) => node.id)).not.toContain("trial-3-2");
  });

  it("marks an open loop as selected even without an explicit open-loop handler", () => {
    const onSelectLoop = vi.fn();
    const onAddBranch = vi.fn();

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline: [timelineLoop({ id: "loop_open", name: "Open Loop" })],
        selectedTrial: null,
        selectedLoop: null,
        openLoop: loop({ id: "loop_open", name: "Open Loop" }),
        onSelectTrial: vi.fn(),
        onSelectLoop,
        onAddBranch,
      }),
    );

    const node = result.current.nodes[0];

    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");
    expect(node.data.onOpenLoop).toBeUndefined();

    act(() => {
      node.data.onClick();
      node.data.onAddBranch();
    });

    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_open", name: "Open Loop" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith("loop_open");
  });

  it("wires callbacks for selected trial branch nodes", () => {
    const onSelectTrial = vi.fn();
    const onAddBranch = vi.fn();
    const selectedTrial = trial({ id: 2, name: "Branch Trial" });

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline: [
          timelineTrial({ id: 1, name: "Parent", branches: [2] }),
          timelineTrial({ id: 2, name: "Branch Trial" }),
        ],
        selectedTrial,
        selectedLoop: null,
        onSelectTrial,
        onSelectLoop: vi.fn(),
        onAddBranch,
        onOpenLoop: vi.fn(),
      }),
    );

    const node = result.current.nodes.find((item) => item.id === "trial-2")!;

    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");

    act(() => {
      node.data.onClick();
      node.data.onAddBranch();
    });

    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, name: "Branch Trial" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith(2);
  });

  it("wires callbacks for selected loop branch nodes", () => {
    const onSelectLoop = vi.fn();
    const onAddBranch = vi.fn();
    const onOpenLoop = vi.fn();
    const selectedLoop = loop({ id: "loop_branch", name: "Branch Loop" });

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline: [
          timelineTrial({ id: 1, name: "Parent", branches: ["loop_branch"] }),
          timelineLoop({ id: "loop_branch", name: "Branch Loop" }),
        ],
        selectedTrial: null,
        selectedLoop,
        onSelectTrial: vi.fn(),
        onSelectLoop,
        onAddBranch,
        onOpenLoop,
      }),
    );

    const node = result.current.nodes.find(
      (item) => item.id === "loop-loop_branch",
    )!;

    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");
    expect(typeof node.data.onOpenLoop).toBe("function");

    act(() => {
      node.data.onClick();
      node.data.onAddBranch();
      node.data.onOpenLoop();
    });

    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_branch", name: "Branch Loop" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith("loop_branch");
    expect(onOpenLoop).toHaveBeenCalledWith("loop_branch");
  });
});

describe("GenerateNodesAndEdges", () => {
  it("renders loop timeline branches, nested loops, and sequential edges for SubCanvas", () => {
    const loopTimeline = [
      timelineTrial({ id: 10, name: "Loop Start", branches: [11, "loop_2"] }),
      timelineTrial({ id: 11, name: "Branch Trial" }),
      timelineLoop({ id: "loop_2", name: "Nested Loop", trials: [12] }),
      timelineTrial({ id: 12, name: "Loop End" }),
    ];

    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline,
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-10",
      "trial-11",
      "loop-loop_2",
      "trial-12",
    ]);
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["trial-10", "trial-11"],
      ["trial-10", "loop-loop_2"],
    ]);
  });

  it("continues from a shared terminal branch target inside SubCanvas", () => {
    const loopTimeline = [
      timelineTrial({ id: 10, name: "Randomizer", branches: [11, 12] }),
      timelineTrial({ id: 11, name: "Loop Control", branches: [13] }),
      timelineTrial({ id: 12, name: "Loop Intervention", branches: [13] }),
      timelineTrial({ id: 13, name: "Loop Post-test" }),
      timelineTrial({ id: 14, name: "Loop End" }),
    ];

    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline,
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-10", "trial-11"],
        ["trial-10", "trial-12"],
        ["trial-11", "trial-13"],
        ["trial-12", "trial-13"],
        ["trial-13", "trial-14"],
      ]),
    );
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).not.toContainEqual([
      "trial-10",
      "trial-14",
    ]);

    const nodesById = new Map(result.current.nodes.map((node) => [node.id, node]));
    const control = nodesById.get("trial-11")!;
    const intervention = nodesById.get("trial-12")!;
    const postTest = nodesById.get("trial-13")!;

    expect(postTest.position.x).toBeCloseTo(
      (control.position.x + intervention.position.x) / 2,
    );
    expect(postTest.position.y).toBe(
      Math.max(control.position.y, intervention.position.y) +
        LAYOUT_CONSTANTS.branchVerticalOffset,
    );
  });

  it("fetches full trial data before selecting SubCanvas trial nodes", async () => {
    const onSelectTrial = vi.fn();
    const onAddBranch = vi.fn();
    const getTrial = vi.fn(async () => trial({ id: 10, name: "Full Trial" }));

    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [timelineTrial({ id: 10, name: "Metadata Trial" })],
        size: { width: 620, height: 320 },
        selectedTrial: trial({ id: 10, name: "Full Trial" }),
        selectedLoop: null,
        onSelectTrial,
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial,
        getLoop: vi.fn(),
        onAddBranch,
      }),
    );

    const node = result.current.nodes[0];

    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");

    await act(async () => {
      await node.data.onClick();
      node.data.onAddBranch();
    });

    expect(getTrial).toHaveBeenCalledWith(10);
    expect(onSelectTrial).toHaveBeenCalledWith(
      expect.objectContaining({ id: 10, name: "Full Trial" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith(10);
  });

  it("fetches full loop data and opens nested loops from SubCanvas loop nodes", async () => {
    const onSelectLoop = vi.fn();
    const onOpenNestedLoop = vi.fn();
    const onAddBranch = vi.fn();
    const getLoop = vi.fn(async () =>
      loop({ id: "loop_2", name: "Full Nested Loop" }),
    );

    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [timelineLoop({ id: "loop_2", name: "Nested Metadata" })],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: loop({ id: "loop_2", name: "Full Nested Loop" }),
        onSelectTrial: vi.fn(),
        onSelectLoop,
        onOpenNestedLoop,
        getTrial: vi.fn(),
        getLoop,
        onAddBranch,
      }),
    );

    const node = result.current.nodes[0];

    expect(node.id).toBe("loop-loop_2");
    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onAddBranch).toBe("function");
    expect(typeof node.data.onOpenLoop).toBe("function");

    await act(async () => {
      await node.data.onClick();
      node.data.onAddBranch();
      node.data.onOpenLoop();
    });

    expect(getLoop).toHaveBeenCalledWith("loop_2");
    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_2", name: "Full Nested Loop" }),
    );
    expect(onAddBranch).toHaveBeenCalledWith("loop_2");
    expect(onOpenNestedLoop).toHaveBeenCalledWith("loop_2");
  });

  it("connects sequential top-level trial and loop combinations inside SubCanvas timelines", () => {
    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [
          timelineTrial({ id: 9, name: "Intro" }),
          timelineTrial({ id: 10, name: "Practice" }),
          timelineLoop({ id: "loop_a", name: "Loop A" }),
          timelineLoop({ id: "loop_b", name: "Loop B" }),
        ],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: undefined,
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-9",
      "trial-10",
      "loop-loop_a",
      "loop-loop_b",
    ]);
    expect(result.current.nodes.at(-1)?.data.onOpenLoop).toBeUndefined();
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-9", "trial-10"],
        ["trial-10", "loop-loop_a"],
        ["loop-loop_a", "loop-loop_b"],
      ]),
    );
  });

  it("keeps terminal SubCanvas merge points without adding a continuation edge", () => {
    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [
          timelineTrial({ id: 10, name: "Branch A", branches: [12] }),
          timelineTrial({ id: 11, name: "Branch B", branches: [12] }),
          timelineTrial({ id: 12, name: "Terminal Merge" }),
        ],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-10", "trial-12"],
        ["trial-11", "trial-12"],
      ]),
    );
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).not.toContainEqual([
      "trial-12",
      expect.any(String),
    ]);
  });

  it("does not select SubCanvas nodes when full trial or loop lookup misses", async () => {
    const onSelectTrial = vi.fn();
    const onSelectLoop = vi.fn();

    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [
          timelineTrial({ id: 10, name: "Missing Trial" }),
          timelineLoop({ id: "missing_loop", name: "Missing Loop" }),
        ],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial,
        onSelectLoop,
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(async () => null),
        getLoop: vi.fn(async () => null),
        onAddBranch: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.nodes[0].data.onClick();
      await result.current.nodes[1].data.onClick();
    });

    expect(onSelectTrial).not.toHaveBeenCalled();
    expect(onSelectLoop).not.toHaveBeenCalled();
  });

  it("ignores missing SubCanvas branch targets", () => {
    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [
          timelineTrial({ id: 10, name: "Parent", branches: [999] }),
          timelineTrial({ id: 11, name: "After Missing Branch" }),
        ],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-10",
      "trial-11",
    ]);
    expect(result.current.edges).toHaveLength(0);
  });

  it("continues from shared SubCanvas loop merge targets to following loops", () => {
    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [
          timelineTrial({ id: 10, name: "Branch A", branches: ["merge_loop"] }),
          timelineTrial({ id: 11, name: "Branch B", branches: ["merge_loop"] }),
          timelineLoop({ id: "merge_loop", name: "Shared Loop" }),
          timelineLoop({ id: "after_loop", name: "After Loop" }),
        ],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual(
      expect.arrayContaining([
        ["trial-10", "loop-merge_loop"],
        ["trial-11", "loop-merge_loop"],
        ["loop-merge_loop", "loop-after_loop"],
      ]),
    );
  });

  it("deduplicates repeated top-level SubCanvas item ids without adding parent edges", () => {
    const { result } = renderHook(() =>
      GenerateNodesAndEdges({
        loopTimeline: [
          timelineTrial({ id: 10, name: "Repeated" }),
          timelineTrial({ id: 10, name: "Repeated Again" }),
        ],
        size: { width: 620, height: 320 },
        selectedTrial: null,
        selectedLoop: null,
        onSelectTrial: vi.fn(),
        onSelectLoop: vi.fn(),
        onOpenNestedLoop: vi.fn(),
        getTrial: vi.fn(),
        getLoop: vi.fn(),
        onAddBranch: vi.fn(),
      }),
    );

    expect(result.current.nodes.map((node) => node.id)).toEqual(["trial-10"]);
  });
});
