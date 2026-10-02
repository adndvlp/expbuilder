import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { useExperimentID } from "../../../../../../hooks/useExperimentID";
import { resolveMediaPreviewUrl } from "../../../../../../utils/resolveMediaPreviewUrl";
import type { HtmlSceneNode, HtmlSceneNodeMetric } from "../sceneModel";
import { renderRuntimeCopy } from "../runtimePreviewDom";
import { getApiBaseUrl } from "../../../../../../../../lib/apiBaseUrl";

const API_URL = getApiBaseUrl();

interface Props {
  isDomActive: boolean;
  isSelected: boolean;
  isTextEditing: boolean;
  node: HtmlSceneNode;
  onMeasure: (id: string, metric: HtmlSceneNodeMetric) => void;
  uploadedFiles: any[];
}

export default function RuntimeCopyNode({
  node,
  uploadedFiles,
  isSelected,
  isDomActive,
  isTextEditing,
  onMeasure,
}: Props) {
  const experimentID = useExperimentID();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renderSignature = useMemo(
    () => getRuntimeRenderSignature(node),
    [node],
  );

  useLayoutEffect(() => {
    const host = hostRef.current!;
    host.innerHTML = "";
    let rendered: ReturnType<typeof renderRuntimeCopy> | null = null;
    try {
      rendered = renderRuntimeCopy(
        host,
        node.component,
        node.canvasStyles,
        (value) =>
          resolveMediaPreviewUrl(value, {
            apiUrl: API_URL,
            experimentID,
            uploadedFiles,
          }),
      );
    } catch (error) {
      // User-authored component configs must never take the editor down: a
      // broken component is shown as a local fallback instead of throwing
      // during the layout effect (which would hit the app ErrorBoundary).
      console.error(
        "[TrialDesigner] Runtime copy failed to render:",
        node.component.type,
        error,
      );
      host.appendChild(createRuntimeCopyErrorMessage(node.component.type));
    }
    return () => {
      rendered?.destroy();
    };
  }, [
    experimentID,
    node.id,
    node.canvasStyles,
    renderSignature,
    uploadedFiles,
  ]);

  useEffect(() => {
    const host = hostRef.current!;
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
      if (width > 0 && height > 0) onMeasure(node.id, { width, height });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    if (host.firstElementChild) observer.observe(host.firstElementChild);
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [node.id, onMeasure, renderSignature]);

  const hideRuntimeText =
    node.type === "TextComponent" && (isSelected || isTextEditing);
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
        opacity: hideRuntimeText ? 0 : 1,
        outline: isDomActive
          ? "2px solid rgba(14, 165, 233, 0.55)"
          : isSelected
            ? "2px solid rgba(29, 78, 216, 0.45)"
            : "none",
      }}
    >
      <div
        ref={hostRef}
        data-scene-node-content="true"
        className="dynamic-runtime-copy"
        style={
          {
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
          } as CSSProperties
        }
      />
    </div>
  );
}

function createRuntimeCopyErrorMessage(componentType: string): HTMLElement {
  const message = document.createElement("div");
  message.dataset.runtimeCopyError = "true";
  message.textContent = `${componentType} could not be rendered. Check its configuration.`;
  message.style.cssText = [
    "border: 2px dashed #dc2626",
    "border-radius: 6px",
    "padding: 12px 16px",
    "color: #dc2626",
    "font-family: Arial, sans-serif",
    "font-size: 13px",
    "line-height: 1.4",
    "max-width: 260px",
    "text-align: center",
  ].join(";");
  return message;
}

function getRuntimeRenderSignature(node: HtmlSceneNode) {
  const { component } = node;
  const contentConfig = { ...(component.config || {}) };
  delete contentConfig.coordinates;
  delete contentConfig.rotation;
  delete contentConfig.zIndex;
  return JSON.stringify({
    id: component.id,
    type: component.type,
    config: contentConfig,
    width: component.width,
    height: component.height,
    inputWidth: component.inputWidth,
    inputFontSize: component.inputFontSize,
    textFontSize: component.textFontSize,
    buttonFontSize: component.buttonFontSize,
  });
}
