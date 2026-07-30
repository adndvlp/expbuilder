export const CANVAS_NODE_WIDTH = 180;
export const CANVAS_NODE_HEIGHT = 50;
export const EXPANDED_LOOP_NODE_WIDTH = 140;

const regularNodeDimensions = {
  width: CANVAS_NODE_WIDTH,
  height: CANVAS_NODE_HEIGHT,
};

const expandedLoopDimensions = {
  width: EXPANDED_LOOP_NODE_WIDTH,
  height: CANVAS_NODE_HEIGHT,
};

export function getCanvasNodeDimensions(
  type: "trial" | "loop",
  expanded: boolean,
) {
  return type === "loop" && expanded
    ? expandedLoopDimensions
    : regularNodeDimensions;
}
