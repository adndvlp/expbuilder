import React, { useEffect, useRef, useState } from "react";
import juice from "juice";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./grapesjs-theme.css";
import Modal from "../../ParameterMapper/Modal";
import { makeGrapesHtmlPortable } from "./portableHtml";
import {
  BUTTON_EDITOR_STYLE_MANAGER,
  DEFAULT_BUTTON_TEMPLATE,
} from "./GrapesButtonEditor/editorConfig";
import { registerButtonBlocks } from "./GrapesButtonEditor/registerBlocks";
import { applyRuntimeCanvasContext } from "./GrapesHtmlEditor/runtimeCanvas";

interface GrapesButtonEditorProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string;
  onChange: (html: string) => void;
  onAutoSave?: (html: string) => void;
  title?: string;
}

const GrapesButtonEditor: React.FC<GrapesButtonEditorProps> = ({
  isOpen,
  onClose,
  value = "",
  onChange,
  onAutoSave,
  title = "Button Editor (GrapesJS)",
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
    }, 1000);
  };

  const initGrapes = () => {
    // Initialize GrapesJS with button-only configuration
    grapesInstance.current = grapesjs.init({
      container: editorRef.current!,
      fromElement: false,
      height: "100%",
      width: "100%",
      storageManager: false,
      plugins: [],
      components: value || DEFAULT_BUTTON_TEMPLATE,
      styleManager: BUTTON_EDITOR_STYLE_MANAGER,
    });

    const applyCanvasContext = () =>
      applyRuntimeCanvasContext(grapesInstance.current);
    grapesInstance.current.on("load", applyCanvasContext);
    applyCanvasContext();
    registerButtonBlocks(grapesInstance.current.BlockManager);

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
          style={{
            marginBottom: "12px",
            padding: "12px",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "6px",
            fontSize: "14px",
            color: "#856404",
          }}
        >
          <strong>Button Template Mode:</strong> Design your button template
          here. Use{" "}
          <code
            style={{
              background: "#fff",
              padding: "2px 6px",
              borderRadius: "3px",
            }}
          >
            {"{{choice}}"}
          </code>{" "}
          as a placeholder where the button text should appear. The system will
          replace it with the actual choice text.
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
              color: "var(--text-dark)",
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
                "var(--text-dark)";
            }}
          >
            Save Button
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GrapesButtonEditor;
