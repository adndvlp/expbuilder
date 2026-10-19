import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFlowLayout } from "../../../pages/ExperimentBuilder/components/Canvas/hooks/useFlowLayout";
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
      timelineTrial({ id: 3, name: "Instructions", branches: ["entry"] }),
      timelineTrial({ id: 4, name: "Final1", branches: ["entry"] }),
      timelineLoop({ id: "loop_1", name: "Loop 1" }),
      timelineTrial({ id: 5, name: "Final2" }),
    ];

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline,
        expandedPath: [],
        selectedItemId: null,
        selectedScopeId: null,
        branchEdges: [3, 4].map((sourceId) => ({
          sourceId,
          targetId: "entry",
          sourceOwnerId: null,
          targetOwnerId: "loop_1",
          exitedLoopIds: [],
        })),
        onToggleLoop: vi.fn(),
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
        ["root::trial::2", "root::trial::3"],
        ["root::trial::2", "root::trial::4"],
        ["root::trial::3", "root::loop::loop_1"],
        ["root::trial::4", "root::loop::loop_1"],
        ["root::loop::loop_1", "root::trial::5"],
      ]),
    );

    const nodesById = new Map(
      result.current.nodes.map((node) => [node.id, node]),
    );
    const instructions = nodesById.get("root::trial::3")!;
    const final1 = nodesById.get("root::trial::4")!;
    const mergeLoop = nodesById.get("root::loop::loop_1")!;
    const final2 = nodesById.get("root::trial::5")!;

    expect(mergeLoop.position.x).toBeCloseTo(
      (instructions.position.x + final1.position.x) / 2,
    );
    expect(mergeLoop.position.y).toBe(
      Math.max(instructions.position.y, final1.position.y) + 120,
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
    expect(node.data.onAddBranch).toBeUndefined();
    expect(node.data.onOpenLoop).toBeUndefined();

    act(() => {
      node.data.onClick();
    });

    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_open", name: "Open Loop" }),
    );
    expect(onAddBranch).not.toHaveBeenCalled();
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

  it("wires callbacks for selected collapsed loop nodes", () => {
    const onSelectLoop = vi.fn();
    const onAddBranch = vi.fn();
    const onOpenLoop = vi.fn();
    const selectedLoop = loop({ id: "loop_branch", name: "Branch Loop" });

    const { result } = renderHook(() =>
      useFlowLayout({
        timeline: [
          timelineTrial({ id: 1, name: "Parent" }),
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
    expect(node.data.onAddBranch).toBeUndefined();
    expect(typeof node.data.onOpenLoop).toBe("function");

    act(() => {
      node.data.onClick();
      node.data.onOpenLoop();
    });

    expect(onSelectLoop).toHaveBeenCalledWith(
      expect.objectContaining({ id: "loop_branch", name: "Branch Loop" }),
    );
    expect(onAddBranch).not.toHaveBeenCalled();
    expect(onOpenLoop).toHaveBeenCalledWith("loop_branch");
  });
});
