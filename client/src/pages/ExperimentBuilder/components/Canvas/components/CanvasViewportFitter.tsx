import { useEffect } from "react";
import {
  getViewportForBounds,
  useNodesInitialized,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import type { CanvasBounds } from "../services/canvasLayoutBounds";

type CanvasViewportFitterProps = {
  layoutSignature: string;
  bounds?: CanvasBounds;
};

export default function CanvasViewportFitter({
  layoutSignature,
  bounds,
}: CanvasViewportFitterProps) {
  const nodesInitialized = useNodesInitialized();
  const { setViewport } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const {
    x = 0,
    y = 0,
    width: boundsWidth = 0,
    height: boundsHeight = 0,
  } = bounds ?? {};

  useEffect(() => {
    if (!nodesInitialized || !width || !height || !boundsWidth || !boundsHeight)
      return;
    const frame = window.requestAnimationFrame(() => {
      void setViewport(
        getViewportForBounds(
          { x, y, width: boundsWidth, height: boundsHeight },
          width,
          height,
          0.1,
          1.15,
          0.2,
        ),
        { duration: 250 },
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    setViewport,
    layoutSignature,
    nodesInitialized,
    width,
    height,
    x,
    y,
    boundsWidth,
    boundsHeight,
  ]);

  return null;
}
