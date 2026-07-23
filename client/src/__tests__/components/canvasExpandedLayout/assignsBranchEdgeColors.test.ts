import { describe, expect, it } from "vitest";
import { assignBranchColorSlots } from "../../../pages/ExperimentBuilder/components/Canvas/services/assignBranchEdgeColors";
import {
  BRANCH_EDGE_PALETTES,
  getBranchEdgeStroke,
  getCanvasEdgeThemeVariables,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/branchEdgeTheme";
import type {
  ExpandedCanvasEdge,
  ExpandedCanvasEdgeKind,
} from "../../../pages/ExperimentBuilder/components/Canvas/services/expandedLayoutTypes";

const edge = (
  id: string,
  source: string,
  target: string,
  kind: ExpandedCanvasEdgeKind = "flow",
): ExpandedCanvasEdge => ({
  id,
  source,
  target,
  sourceHandle: "flow-source",
  targetHandle: "flow-target",
  type: kind === "flow" ? "default" : "smoothstep",
  data: { kind, scopeId: "root" },
});

const hexChannel = (hex: string, offset: number) =>
  Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;

const linearChannel = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const luminance = (hex: string) =>
  [1, 3, 5]
    .map((offset) => linearChannel(hexChannel(hex, offset)))
    .reduce(
      (result, channel, index) =>
        result + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

const contrast = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe("assignBranchColorSlots", () => {
  it("keeps sibling branches distinct until they converge", () => {
    const edges = [
      edge("start-question", "start", "question"),
      edge("question-left", "question", "left"),
      edge("question-right", "question", "right"),
      edge("left-step", "left", "left-step"),
      edge("right-step", "right", "right-step"),
      edge("left-merge", "left-step", "merge"),
      edge("right-merge", "right-step", "merge"),
      edge("merge-after", "merge", "after"),
    ];

    const slots = assignBranchColorSlots(edges);
    const leftSlot = slots.get("question-left");
    const rightSlot = slots.get("question-right");

    expect(leftSlot).toEqual(expect.any(Number));
    expect(rightSlot).toEqual(expect.any(Number));
    expect(leftSlot).not.toBe(rightSlot);
    expect(slots.get("left-step")).toBe(leftSlot);
    expect(slots.get("left-merge")).toBe(leftSlot);
    expect(slots.get("right-step")).toBe(rightSlot);
    expect(slots.get("right-merge")).toBe(rightSlot);
    expect(slots.has("start-question")).toBe(false);
    expect(slots.has("merge-after")).toBe(false);
  });

  it("starts a new color group at a nested split", () => {
    const edges = [
      edge("root-left", "root", "left"),
      edge("root-right", "root", "right"),
      edge("left-split", "left", "nested-split"),
      edge("nested-a", "nested-split", "nested-a"),
      edge("nested-b", "nested-split", "nested-b"),
    ];

    const slots = assignBranchColorSlots(edges);

    expect(slots.get("left-split")).toBe(slots.get("root-left"));
    expect(slots.get("nested-a")).not.toBe(slots.get("nested-b"));
  });

  it("does not color loop routing edges", () => {
    const slots = assignBranchColorSlots([
      edge("loop-control", "marker", "last", "loop-control"),
      edge("loop-return", "last", "first", "loop-return"),
    ]);

    expect(slots.size).toBe(0);
  });
});

describe("branch edge theme", () => {
  it("uses theme variables for neutral and colored flow edges", () => {
    expect(getBranchEdgeStroke()).toBe("var(--canvas-flow-edge)");
    expect(getBranchEdgeStroke(3)).toBe("var(--canvas-branch-edge-3)");
  });

  it("maps the charcoal light branch to white in dark mode", () => {
    const light = getCanvasEdgeThemeVariables(false);
    const dark = getCanvasEdgeThemeVariables(true);

    expect(light["--canvas-branch-edge-2"]).toBe("#101828");
    expect(dark["--canvas-branch-edge-2"]).toBe("#ffffff");
  });

  it("keeps every branch color visible against its canvas background", () => {
    BRANCH_EDGE_PALETTES.light.forEach((color) => {
      expect(contrast(color, "#f7f8fa")).toBeGreaterThanOrEqual(3);
    });
    BRANCH_EDGE_PALETTES.dark.forEach((color) => {
      expect(contrast(color, "#23272f")).toBeGreaterThanOrEqual(3);
    });
  });
});
