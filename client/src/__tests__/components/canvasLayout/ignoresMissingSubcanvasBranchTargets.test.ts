import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GenerateNodesAndEdges from "../../../pages/ExperimentBuilder/components/Canvas/SubCanvas/GenerateNodesAndEdges";
import { timelineLoop, timelineTrial } from "../../helpers/trialFactories";

describe("GenerateNodesAndEdges", () => {
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

    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
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
