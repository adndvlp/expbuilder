import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout";
import { LAYOUT_CONSTANTS } from "../../../pages/ExperimentBuilder/components/Canvas/utils/layoutUtils";
import {
  loop,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";

describe("useFlowLayout", () => {
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

    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
      expect.arrayContaining([
        ["trial-2", "trial-3"],
        ["trial-2", "trial-4"],
        ["trial-3", "loop-loop_1"],
        ["trial-4", "loop-loop_1"],
        ["loop-loop_1", "trial-5"],
      ]),
    );

    const nodesById = new Map(
      result.current.nodes.map((node) => [node.id, node]),
    );
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
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toContainEqual(["trial-1", "trial-2"]);

    rerender({ timeline: afterMove });

    expect(result.current.nodes.map((node) => node.id)).toContain("trial-2");
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toContainEqual(["trial-3", "trial-2"]);
    expect(result.current.nodes.map((node) => node.id)).not.toContain(
      "trial-3-2",
    );
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
