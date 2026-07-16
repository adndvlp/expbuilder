import { useEffect } from "react";
import { useNodesInitialized, useReactFlow } from "reactflow";

type CanvasViewportFitterProps = {
  layoutSignature: string;
};

export default function CanvasViewportFitter({
  layoutSignature,
}: CanvasViewportFitterProps) {
  const nodesInitialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!nodesInitialized) return;
    const frame = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2, maxZoom: 1.15, duration: 250 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, layoutSignature, nodesInitialized]);

  return null;
}
