import React, { useEffect, useRef, useState } from "react";
import juice from "juice";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./grapesjs-theme.css";
import Modal from "../../ParameterMapper/Modal";
import { makeGrapesHtmlPortable } from "./portableHtml";
import { HTML_EDITOR_STYLE_MANAGER } from "./GrapesHtmlEditor/editorConfig";
import { registerHtmlBlocks } from "./GrapesHtmlEditor/registerBlocks";
import { applyRuntimeCanvasContext } from "./GrapesHtmlEditor/runtimeCanvas";

interface GrapesHtmlEditorProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string;
  onChange: (html: string) => void;
  onAutoSave?: (html: string) => void;
  title?: string;
}

const GrapesHtmlEditor: React.FC<GrapesHtmlEditorProps> = ({
  isOpen,
  onClose,
  value = "",
  onChange,
  onAutoSave,
  title = "Visual HTML Editor (GrapesJS)",
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const grapesInstance = useRef<any>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    initGrapes();
    // Cleanup on close
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      grapesInstance.current.destroy();
      grapesInstance.current = null;
    };
    // eslint-disable-next-line
  }, [isOpen]);

  const getProcessedHtml = () => {
    const editor = grapesInstance.current;
    let html = editor.getHtml({});
    html = html.replace(/<\/?body[^>]*>/gi, "");
    const css = editor.getCss({});
    return makeGrapesHtmlPortable(juice.inlineContent(html, css));
  };

  const triggerAutoSave = () => {
    if (!onAutoSave) return;
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      const inlinedHtml = getProcessedHtml();
      onAutoSave(inlinedHtml);
      setSaveIndicator(true);
      setTimeout(() => setSaveIndicator(false), 1500);
    }, 1000); // Debounce 1s to avoid heavy processing too often
  };

  const initGrapes = () => {
    // Usar grapesjs importado por npm
    grapesInstance.current = grapesjs.init({
      container: editorRef.current!,
      fromElement: false,
      height: "100%",
      width: "100%",
      storageManager: false,
      plugins: [], // Si tienes plugins npm, impórtalos arriba y agrégalos aquí
      components: value || "<div>Type or design here</div>",
      styleManager: HTML_EDITOR_STYLE_MANAGER,
    });

    const applyCanvasContext = () =>
      applyRuntimeCanvasContext(grapesInstance.current);
    grapesInstance.current.on("load", applyCanvasContext);
    applyCanvasContext();
    registerHtmlBlocks(grapesInstance.current.BlockManager);

    // Hook events for autosave
    grapesInstance.current.on("update", triggerAutoSave);
  };

  const handleSave = () => {
    onChange(getProcessedHtml());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Save Indicator */}
        <div
          style={{
            opacity: saveIndicator ? 1 : 0,
            transition: "opacity 0.3s",
            color: "white",
            fontWeight: "600",
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 10000,
            backgroundColor: "rgba(34, 197, 94, 0.95)",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            border: "1px solid white",
            pointerEvents: "none",
          }}
        >
          ✓ Saved
        </div>
        <div
          ref={editorRef}
          style={{
            flex: 1,
            minHeight: 0,
            border: "1px solid #ccc",
            borderRadius: 8,
            overflow: "hidden",
          }}
        />
        <div
          style={{
            flexShrink: 0,
            padding: "12px 16px",
            textAlign: "right",
          }}
        >
          <button
            onClick={handleSave}
            style={{
              background: "var(--gold)",
              color: "var(--text-light)",
              padding: "8px 20px",
              borderRadius: 6,
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 16,
              transition: "background 0.2s, color 0.2s",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--dark-gold)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-light)";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--gold)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-light)";
            }}
          >
            Save HTML
          </button>
        </div>
      </div>
      {/* GrapesJS CSS already imported locally */}
    </Modal>
  );
};

export default GrapesHtmlEditor;
