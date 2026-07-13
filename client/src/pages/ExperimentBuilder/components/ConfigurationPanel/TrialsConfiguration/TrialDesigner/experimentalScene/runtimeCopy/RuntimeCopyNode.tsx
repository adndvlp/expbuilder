import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { mapFileToUrl } from "../../../../../../utils/mapFileToUrl";
import type { HtmlSceneNode, HtmlSceneNodeMetric } from "../sceneModel";
import { renderRuntimeCopy } from "../runtimePreviewDom";

const API_URL = import.meta.env.VITE_API_URL;

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renderSignature = useMemo(
    () => getRuntimeRenderSignature(node),
    [node],
  );

  useLayoutEffect(() => {
    const host = hostRef.current!;
    host.innerHTML = "";
    const rendered = renderRuntimeCopy(
      host,
      node.component,
      node.canvasStyles,
      (value) => resolveAssetUrl(value, uploadedFiles),
    );
    return () => rendered.destroy();
  }, [node.id, node.canvasStyles, renderSignature, uploadedFiles]);

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

function resolveAssetUrl(value: string, uploadedFiles: any[]) {
  if (!value) return "";
  let url =
    uploadedFiles.length > 0 ? mapFileToUrl(value, uploadedFiles) : value;
  if (url && !/^(?:https?:|data:|blob:|file:)/i.test(url) && API_URL) {
    url = `${API_URL}/${url.replace(/^\/+/, "")}`;
  }
  return url;
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
