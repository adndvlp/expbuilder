import type { GridLine } from "../editorGrid";
import { movingAnchors } from "./geometry";
import type {
  Anchor,
  CanvasGuide,
  GuideOrientation,
  MovingAnchor,
  SnapBox,
  SnapMatch,
} from "./types";

export function targetAnchors(
  targets: SnapBox[],
  length: number,
  axis: "x" | "y",
  gridLines: GridLine[] = [],
): Anchor[] {
  const keys =
    axis === "x"
      ? ["canvas-left", "canvas-center-x", "canvas-right"]
      : ["canvas-top", "canvas-center-y", "canvas-bottom"];
  const boundaries = [0, length / 2, length];
  return [
    ...boundaries.map(
      (value, index): Anchor => ({
        value,
        key: keys[index],
        source: "viewport",
      }),
    ),
    ...targets.flatMap((box) =>
      movingAnchors(box, axis).map(
        (anchor): Anchor => ({
          value: anchor.value,
          key: `${box.id}-${axis}-${anchor.key}`,
          source: "component",
          box,
        }),
      ),
    ),
    ...gridLines
      .filter((line) => !boundaries.includes(line.position))
      .map(
        (line): Anchor => ({
          value: line.position,
          key: line.key,
          source: "grid",
        }),
      ),
  ];
}

const sourceRank = { viewport: 0, component: 1, grid: 2 };
const anchorRank = { center: 0, start: 1, end: 2 };
function compare(left: SnapMatch, right: SnapMatch) {
  const distance = left.distance - right.distance;
  if (Math.abs(distance) > 1e-9) return distance;
  return (
    sourceRank[left.target.source] - sourceRank[right.target.source] ||
    anchorRank[left.moving.key] - anchorRank[right.moving.key] ||
    left.target.key.localeCompare(right.target.key)
  );
}

export function pickSnap({
  moving,
  targets,
  stageScale,
  threshold,
  gridSpacing,
  previous,
  orientation,
}: {
  moving: MovingAnchor[];
  targets: Anchor[];
  stageScale: number;
  threshold: number;
  gridSpacing?: number;
  previous: CanvasGuide[];
  orientation: GuideOrientation;
}): SnapMatch | null {
  const matches = moving.flatMap((anchor) =>
    targets.map(
      (target): SnapMatch => ({
        delta: target.value - anchor.value,
        distance: Math.abs(target.value - anchor.value) * stageScale,
        target,
        moving: anchor,
      }),
    ),
  );
  const limit = (match: SnapMatch, release: boolean) => {
    const base = threshold + (release ? 2 : 0);
    return match.target.source === "grid" && gridSpacing !== undefined
      ? Math.min(base, (release ? 0.4 : 0.3) * gridSpacing * stageScale)
      : base;
  };
  const retained = previous.find((guide) => guide.orientation === orientation);
  if (retained) {
    const match = matches.find(
      (candidate) =>
        candidate.target.key === retained.key &&
        candidate.moving.key === retained.anchor &&
        Math.abs(candidate.target.value - retained.position) < 1e-9,
    );
    if (match && match.distance <= limit(match, true)) return match;
  }
  return (
    matches
      .filter((match) => match.distance <= limit(match, false))
      .sort(compare)[0] ?? null
  );
}
