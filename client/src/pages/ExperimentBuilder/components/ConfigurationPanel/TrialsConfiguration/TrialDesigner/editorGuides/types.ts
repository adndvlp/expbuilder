export type GuideOrientation = "vertical" | "horizontal";
export type GuideSource = "grid" | "viewport" | "component";
export type AnchorKey = "start" | "center" | "end";
export type SnapBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type CanvasGuide = {
  orientation: GuideOrientation;
  position: number;
  from: number;
  to: number;
  key: string;
  source?: GuideSource;
  anchor?: AnchorKey;
};
export type SnapBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  bounds?: SnapBounds;
};
export type SnapResult = { x: number; y: number; guides: CanvasGuide[] };
export type Anchor = {
  value: number;
  key: string;
  source: GuideSource;
  box?: SnapBox;
};
export type MovingAnchor = { value: number; key: AnchorKey };
export type SnapMatch = {
  delta: number;
  distance: number;
  target: Anchor;
  moving: MovingAnchor;
};
