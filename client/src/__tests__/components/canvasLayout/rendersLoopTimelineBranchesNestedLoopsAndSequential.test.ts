import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GenerateNodesAndEdges from "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges";
import { LAYOUT_CONSTANTS } from "../../../pages/ExperimentBuilder/components/Canvas/utils/layoutUtils";
import {
  loop,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";

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
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual([
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

    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
      expect.arrayContaining([
        ["trial-10", "trial-11"],
        ["trial-10", "trial-12"],
        ["trial-11", "trial-13"],
        ["trial-12", "trial-13"],
        ["trial-13", "trial-14"],
      ]),
    );
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).not.toContainEqual(["trial-10", "trial-14"]);

    const nodesById = new Map(
      result.current.nodes.map((node) => [node.id, node]),
    );
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
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
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

    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
      expect.arrayContaining([
        ["trial-10", "trial-12"],
        ["trial-11", "trial-12"],
      ]),
    );
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).not.toContainEqual(["trial-12", expect.any(String)]);
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
});
