import { CanvasStyles, TrialComponent } from "./types";
import { getComponentSnapBox } from "./editorGuides/getComponentSnapBox";
export { getComponentSnapBox } from "./editorGuides/getComponentSnapBox";

export type GuideOrientation = "vertical" | "horizontal";

export type CanvasGuide = {
  orientation: GuideOrientation;
  position: number;
  from: number;
  to: number;
  key: string;
};

export type SnapBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: CanvasGuide[];
};

type Anchor = {
  value: number;
  box?: SnapBox;
  key: string;
};

const DEFAULT_SNAP_THRESHOLD = 6;

function edges(box: SnapBox) {
  const halfW = box.width / 2;
  const halfH = box.height / 2;
  return {
    left: box.x - halfW,
    centerX: box.x,
    right: box.x + halfW,
    top: box.y - halfH,
    centerY: box.y,
    bottom: box.y + halfH,
  };
}

function xAnchors(box: SnapBox): Anchor[] {
  const e = edges(box);
  return [
    { value: e.left, box, key: "left" },
    { value: e.centerX, box, key: "center-x" },
    { value: e.right, box, key: "right" },
  ];
}

function yAnchors(box: SnapBox): Anchor[] {
  const e = edges(box);
  return [
    { value: e.top, box, key: "top" },
    { value: e.centerY, box, key: "center-y" },
    { value: e.bottom, box, key: "bottom" },
  ];
}

function targetXAnchors(targets: SnapBox[], canvasWidth: number): Anchor[] {
  return [
    { value: 0, key: "canvas-left" },
    { value: canvasWidth / 2, key: "canvas-center-x" },
    { value: canvasWidth, key: "canvas-right" },
    ...targets.flatMap(xAnchors),
  ];
}

function targetYAnchors(targets: SnapBox[], canvasHeight: number): Anchor[] {
  return [
    { value: 0, key: "canvas-top" },
    { value: canvasHeight / 2, key: "canvas-center-y" },
    { value: canvasHeight, key: "canvas-bottom" },
    ...targets.flatMap(yAnchors),
  ];
}

function pickSnap(
  movingAnchors: Anchor[],
  targetAnchors: Anchor[],
  threshold: number,
) {
  let best: {
    delta: number;
    distance: number;
    target: Anchor;
    moving: Anchor;
  } | null = null;

  for (const moving of movingAnchors) {
    for (const target of targetAnchors) {
      const delta = target.value - moving.value;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;
      if (!best || distance < best.distance) {
        best = { delta, distance, target, moving };
      }
    }
  }

  return best;
}

function verticalGuide(
  position: number,
  snappedBox: SnapBox,
  target: Anchor,
  canvasHeight: number,
): CanvasGuide {
  if (!target.box) {
    return {
      orientation: "vertical",
      position,
      from: 0,
      to: canvasHeight,
      key: target.key,
    };
  }

  const movingEdges = edges(snappedBox);
  const targetEdges = edges(target.box);
  return {
    orientation: "vertical",
    position,
    from: Math.min(movingEdges.top, targetEdges.top),
    to: Math.max(movingEdges.bottom, targetEdges.bottom),
    key: `${target.box.id}-${target.key}`,
  };
}

function horizontalGuide(
  position: number,
  snappedBox: SnapBox,
  target: Anchor,
  canvasWidth: number,
): CanvasGuide {
  if (!target.box) {
    return {
      orientation: "horizontal",
      position,
      from: 0,
      to: canvasWidth,
      key: target.key,
    };
  }

  const movingEdges = edges(snappedBox);
  const targetEdges = edges(target.box);
  return {
    orientation: "horizontal",
    position,
    from: Math.min(movingEdges.left, targetEdges.left),
    to: Math.max(movingEdges.right, targetEdges.right),
    key: `${target.box.id}-${target.key}`,
  };
}

export function snapBoxToGuides({
  box,
  targets,
  canvasWidth,
  canvasHeight,
  threshold = DEFAULT_SNAP_THRESHOLD,
}: {
  box: SnapBox;
  targets: SnapBox[];
  canvasWidth: number;
  canvasHeight: number;
  threshold?: number;
}): SnapResult {
  const xSnap = pickSnap(
    xAnchors(box),
    targetXAnchors(targets, canvasWidth),
    threshold,
  );
  const ySnap = pickSnap(
    yAnchors(box),
    targetYAnchors(targets, canvasHeight),
    threshold,
  );

  const snappedBox = {
    ...box,
    x: xSnap ? box.x + xSnap.delta : box.x,
    y: ySnap ? box.y + ySnap.delta : box.y,
  };

  const guides: CanvasGuide[] = [];
  if (xSnap) {
    guides.push(
      verticalGuide(xSnap.target.value, snappedBox, xSnap.target, canvasHeight),
    );
  }
  if (ySnap) {
    guides.push(
      horizontalGuide(
        ySnap.target.value,
        snappedBox,
        ySnap.target,
        canvasWidth,
      ),
    );
  }

  return {
    x: snappedBox.x,
    y: snappedBox.y,
    guides,
  };
}

export function snapComponentBox(
  box: SnapBox,
  components: TrialComponent[],
  canvasStyles: CanvasStyles,
): SnapResult {
  const targets = components
    .filter((component) => component.id !== box.id)
    .map((component) => getComponentSnapBox(component, canvasStyles));

  return snapBoxToGuides({
    box,
    targets,
    canvasWidth: canvasStyles.width,
    canvasHeight: canvasStyles.height,
  });
}
