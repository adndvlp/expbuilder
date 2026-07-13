import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CanvasStyles, TrialComponent } from "../types";
import {
  getHtmlSceneNodes,
  type HtmlSceneMetrics,
  type HtmlSceneNodeMetric,
} from "./sceneModel";
import RuntimeCopyNode from "./runtimeCopy/RuntimeCopyNode";
import { RUNTIME_COPY_STYLES } from "./runtimeCopy/styles";

type Props = {
  components: TrialComponent[];
  canvasStyles: CanvasStyles;
  stageScale: number;
  metrics: HtmlSceneMetrics;
  uploadedFiles?: any[];
  onMetricsChange: (metrics: HtmlSceneMetrics) => void;
  selectedId?: string | null;
  activeDomId?: string | null;
  editingTextId?: string | null;
};

export default function ExperimentalHtmlSceneLayer({
  components,
  canvasStyles,
  stageScale,
  metrics,
  uploadedFiles = [],
  onMetricsChange,
  selectedId,
  activeDomId,
  editingTextId,
}: Props) {
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const nodes = useMemo(
    () => getHtmlSceneNodes(components, canvasStyles, metrics),
    [components, canvasStyles, metrics],
  );
  const handleMeasure = useCallback(
    (id: string, metric: HtmlSceneNodeMetric) => {
      const current = metricsRef.current;
      const previous = current[id];
      if (
        previous &&
        Math.abs(previous.width - metric.width) <= 0.5 &&
        Math.abs(previous.height - metric.height) <= 0.5
      ) {
        return;
      }
      const next = { ...current, [id]: metric };
      metricsRef.current = next;
      onMetricsChange(next);
    },
    [onMetricsChange],
  );

  useEffect(() => {
    const ids = new Set(nodes.map((node) => node.id));
    const staleIds = Object.keys(metricsRef.current).filter(
      (id) => !ids.has(id),
    );
    if (staleIds.length === 0) return;
    const next = { ...metricsRef.current };
    staleIds.forEach((id) => delete next[id]);
    metricsRef.current = next;
    onMetricsChange(next);
  }, [nodes, onMetricsChange]);

  if (nodes.length === 0) return null;
  return (
    <div
      data-html-scene-overlay="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: canvasStyles.width,
        height: canvasStyles.height,
        transform: `scale(${stageScale})`,
        transformOrigin: "top left",
        pointerEvents: "none",
        zIndex: activeDomId ? 5 : 3,
        overflow: "hidden",
        borderRadius: 8,
        textAlign: "left",
      }}
    >
      <style>{RUNTIME_COPY_STYLES}</style>
      {nodes.map((node) => (
        <RuntimeCopyNode
          key={node.id}
          node={node}
          uploadedFiles={uploadedFiles}
          isSelected={selectedId === node.id}
          isDomActive={activeDomId === node.id}
          isTextEditing={editingTextId === node.id}
          onMeasure={handleMeasure}
        />
      ))}
    </div>
  );
}
