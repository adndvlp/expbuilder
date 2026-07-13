import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LAYOUT_CONSTANTS } from "../../../pages/ExperimentBuilder/components/Canvas/utils/layoutUtils";
import {
  loop,
  timelineLoop,
  timelineTrial,
  trial,
} from "../../helpers/trialFactories";
import { renderFlowLayout } from "./testHarness";

describe("useFlowLayout", () => {
  it("renders top-level sequence nodes while excluding branch children and trials inside loops", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Start", branches: [2] }),
      timelineTrial({ id: 2, name: "Branch child" }),
      timelineLoop({ id: "loop_1", name: "Practice Loop", trials: [3] }),
      timelineTrial({ id: 3, name: "Inside Loop" }),
      timelineTrial({ id: 4, name: "End" }),
    ];

    const { result } = renderFlowLayout(timeline);

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-1",
      "trial-2",
      "loop-loop_1",
      "trial-4",
    ]);
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual([
      ["trial-1", "trial-2"],
      ["loop-loop_1", "trial-4"],
    ]);
  });

  it("marks selected trials and wires selection plus add-branch callbacks", () => {
    const onSelectTrial = vi.fn();
    const onAddBranch = vi.fn();
    const selectedTrial = trial({ id: 1, name: "Selected" });

    const { result } = renderFlowLayout(
      [timelineTrial({ id: 1, name: "Selected" })],
      { selectedTrial, onSelectTrial, onAddBranch },
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

    const { result } = renderFlowLayout(
      [timelineLoop({ id: "loop_1", name: "Practice Loop" })],
      { selectedLoop, onSelectLoop, onAddBranch, onOpenLoop },
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
      timelineLoop({
        id: "loop_nested",
        name: "Nested Branch Loop",
        branches: [4],
      }),
      timelineTrial({ id: 4, name: "Nested terminal" }),
    ];

    const { result } = renderFlowLayout(timeline);

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-1",
      "trial-2",
      "trial-3",
      "loop-loop_branch",
      "loop-loop_nested",
      "trial-4",
    ]);
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
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

    const { result } = renderFlowLayout(timeline, {
      onOpenLoop: undefined,
    });

    expect(result.current.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "trial-1",
        "trial-2",
        "loop-loop_branch",
        "trial-10",
        "loop-loop_11",
      ]),
    );
    expect(result.current.nodes.map((node) => node.id)).not.toContain(
      "trial-999",
    );
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toContainEqual(["trial-10", "loop-loop_11"]);
  });

  it("continues from a shared terminal branch target to the next top-level item", () => {
    const timeline = [
      timelineTrial({ id: 1, name: "Randomizer", branches: [2, 3] }),
      timelineTrial({ id: 2, name: "Control", branches: [4] }),
      timelineTrial({ id: 3, name: "Intervention", branches: [4] }),
      timelineTrial({ id: 4, name: "Post-test" }),
      timelineTrial({ id: 5, name: "End" }),
    ];

    const { result } = renderFlowLayout(timeline);

    expect(result.current.nodes.map((node) => node.id)).toEqual([
      "trial-1",
      "trial-2",
      "trial-4",
      "trial-3",
      "trial-5",
    ]);
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toEqual(
      expect.arrayContaining([
        ["trial-1", "trial-2"],
        ["trial-1", "trial-3"],
        ["trial-2", "trial-4"],
        ["trial-3", "trial-4"],
        ["trial-4", "trial-5"],
      ]),
    );
    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).not.toContainEqual(["trial-1", "trial-5"]);

    const nodesById = new Map(
      result.current.nodes.map((node) => [node.id, node]),
    );
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

    const { result } = renderFlowLayout(timeline);

    expect(
      result.current.edges.map((edge) => [edge.source, edge.target]),
    ).toContainEqual(["trial-4", "loop-loop_after"]);
  });
});
