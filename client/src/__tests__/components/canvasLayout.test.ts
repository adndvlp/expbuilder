import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GenerateNodesAndEdges from "../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges";
import { useFlowLayout } from "../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout";
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
      "1",
      "1-2",
      "loop-loop_1",
      "4",
    ]);
    expect(result.current.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ["1", "1-2"],
      ["1", "loop-loop_1"],
      ["loop-loop_1", "4"],
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
      ["trial-10", "trial-12"],
    ]);
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
        onAddBranch: vi.fn(),
      }),
    );

    const node = result.current.nodes[0];

    expect(node.id).toBe("loop-loop_2");
    expect(node.data.selected).toBe(true);
    expect(typeof node.data.onOpenLoop).toBe("function");

    await act(async () => {
      await node.data.onClick();
      node.data.onOpenLoop();
    });

    expect(getLoop).toHaveBeenCalledWith("loop_2");
    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_2", name: "Full Nested Loop" }),
    );
    expect(onOpenNestedLoop).toHaveBeenCalledWith("loop_2");
  });
});
