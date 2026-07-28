import { BaseEdge, type EdgeProps } from "reactflow";
import { getLoopCircuitPath } from "../services/loopRoutingPath";

type LoopRoutingEdgeData = {
  routeX?: number;
  routeTopY?: number;
  routeBottomY?: number;
};

export default function LoopRoutingEdge(
  props: EdgeProps<LoopRoutingEdgeData>,
) {
  const path = getLoopCircuitPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    routeX: props.data?.routeX,
    routeTopY: props.data?.routeTopY,
    routeBottomY: props.data?.routeBottomY,
  });

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
