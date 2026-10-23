import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import type { CanvasCubic } from "../services/expandedLayoutTypes";
import { getNavigationPath } from "../services/navigationCurve";

type NavigationEdge = Edge<{ curve?: CanvasCubic[] }, "navigation">;

export default function NavigationRoutingEdge(
  props: EdgeProps<NavigationEdge>,
) {
  const path = getNavigationPath(
    props.data?.curve ?? [],
    { x: props.sourceX, y: props.sourceY },
    { x: props.targetX, y: props.targetY },
  );
  return (
    <BaseEdge
      id={props.id}
      path={path}
      style={props.style}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
    />
  );
}
