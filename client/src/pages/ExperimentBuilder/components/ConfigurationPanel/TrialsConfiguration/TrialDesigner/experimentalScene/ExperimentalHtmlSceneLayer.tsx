import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { CSSProperties } from "react";
import { mapFileToUrl } from "../../../../../utils/mapFileToUrl";
import { CanvasStyles, TrialComponent } from "../types";
import {
  getHtmlSceneNodes,
  HtmlSceneMetrics,
  HtmlSceneNode,
  HtmlSceneNodeMetric,
} from "./sceneModel";
import { renderRuntimeCopy } from "./runtimePreviewDom";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  components: TrialComponent[];
  canvasStyles: CanvasStyles;
  stageScale: number;
  metrics: HtmlSceneMetrics;
  uploadedFiles?: any[];
  onMetricsChange: (metrics: HtmlSceneMetrics) => void;
  selectedId?: string | null;
  activeDomId?: string | null;
};

function resolveAssetUrl(value: string, uploadedFiles: any[]) {
  if (!value) return "";

  let url = uploadedFiles.length > 0
    ? mapFileToUrl(value, uploadedFiles)
    : value;

  if (
    url &&
    !/^(?:https?:|data:|blob:|file:)/i.test(url) &&
    API_URL
  ) {
    url = `${API_URL}/${url.replace(/^\/+/, "")}`;
  }

  return url;
}

function RuntimeCopyNode({
  node,
  uploadedFiles,
  isSelected,
  isDomActive,
  onMeasure,
}: {
  node: HtmlSceneNode;
  uploadedFiles: any[];
  isSelected: boolean;
  isDomActive: boolean;
  onMeasure: (id: string, metric: HtmlSceneNodeMetric) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const serializedComponent = useMemo(
    () => JSON.stringify(node.component),
    [node.component],
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = "";
    const rendered = renderRuntimeCopy(
      host,
      node.component,
      node.canvasStyles,
      (value) => resolveAssetUrl(value, uploadedFiles),
    );

    return () => rendered.destroy();
  }, [
    node.id,
    node.canvasStyles,
    serializedComponent,
    uploadedFiles,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const content = host.firstElementChild as HTMLElement | null;
      if (!content) return;

      const rect = content.getBoundingClientRect();
      const width = Math.ceil(
        content.offsetWidth || content.scrollWidth || rect.width,
      );
      const height = Math.ceil(
        content.offsetHeight || content.scrollHeight || rect.height,
      );

      if (width > 0 && height > 0) {
        onMeasure(node.id, { width, height });
      }
    };

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (host.firstElementChild) observer.observe(host.firstElementChild);
    const frame = requestAnimationFrame(measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [node.id, onMeasure, serializedComponent]);

  return (
    <div
      data-scene-node-id={node.id}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: "max-content",
        height: "max-content",
        transform: `translate(-50%, -50%) rotate(${node.rotation}deg)`,
        transformOrigin: "50% 50%",
        pointerEvents: isDomActive ? "auto" : "none",
        boxSizing: "border-box",
        overflow: "visible",
        zIndex: node.zIndex,
        outline: isDomActive
          ? "2px solid rgba(147, 51, 234, 0.55)"
          : isSelected
            ? "2px solid rgba(29, 78, 216, 0.45)"
            : "none",
      }}
    >
      <div
        ref={hostRef}
        data-scene-node-content="true"
        className="dynamic-runtime-copy"
        style={{
          width: "max-content",
          height: "max-content",
          overflow: "visible",
          pointerEvents: isDomActive ? "auto" : "none",
          textAlign: "left",
          color: "#000000",
          fontFamily: '"Open Sans", Arial, sans-serif',
          fontSize: node.type === "HtmlComponent" ? "18px" : undefined,
          lineHeight: node.type === "HtmlComponent" ? "1.6em" : undefined,
          "--neutral-mid": "transparent",
          "--neutral-light": "transparent",
        } as CSSProperties}
      />
    </div>
  );
}

export default function ExperimentalHtmlSceneLayer({
  components,
  canvasStyles,
  stageScale,
  metrics,
  uploadedFiles = [],
  onMetricsChange,
  selectedId,
  activeDomId,
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
      <style>{`
        [data-html-scene-overlay] .dynamic-html-component-stimulus * {
          all: revert;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-btn {
          display: inline-block;
          padding: 8px 12px;
          margin: .75em;
          font-size: 14px;
          font-weight: 400;
          font-family: "Open Sans", Arial, sans-serif;
          cursor: pointer;
          line-height: 1.4;
          text-align: center;
          white-space: nowrap;
          vertical-align: middle;
          background-image: none;
          border: 1px solid #ccc;
          border-radius: 4px;
          color: #333;
          background-color: #fff;
          letter-spacing: 0;
          transition: none;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-btn:disabled {
          background-color: #eee;
          color: #aaa;
          border-color: #ccc;
          cursor: not-allowed;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
          color: initial;
          accent-color: auto;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider:focus {
          outline: none;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-webkit-slider-runnable-track {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #eee;
          border-radius: 2px;
          border: 1px solid #aaa;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-webkit-slider-thumb {
          border: 1px solid #666;
          height: 24px;
          width: 15px;
          border-radius: 5px;
          background: #fff;
          cursor: pointer;
          -webkit-appearance: none;
          margin-top: -9px;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-moz-range-track {
          appearance: none;
          width: 100%;
          height: 8px;
          cursor: pointer;
          background: #eee;
          border-radius: 2px;
          border: 1px solid #aaa;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-slider::-moz-range-thumb {
          border: 1px solid #666;
          height: 24px;
          width: 15px;
          border-radius: 5px;
          background: #fff;
          cursor: pointer;
        }

        [data-html-scene-overlay] .dynamic-runtime-copy .jspsych-input-response {
          color: #000;
          background-color: #fff;
          letter-spacing: 0;
        }
      `}</style>
      {nodes.map((node) => (
        <RuntimeCopyNode
          key={node.id}
          node={node}
          uploadedFiles={uploadedFiles}
          isSelected={selectedId === node.id}
          isDomActive={activeDomId === node.id}
          onMeasure={handleMeasure}
        />
      ))}
    </div>
  );
}
