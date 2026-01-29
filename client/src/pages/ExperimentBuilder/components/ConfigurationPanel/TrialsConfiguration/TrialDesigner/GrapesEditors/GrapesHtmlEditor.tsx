import React, { useEffect, useRef, useState } from "react";
import juice from "juice";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./grapesjs-theme.css";
import Modal from "../../ParameterMapper/Modal";

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
      if (grapesInstance.current) {
        grapesInstance.current.destroy();
        grapesInstance.current = null;
      }
    };
    // eslint-disable-next-line
  }, [isOpen]);

  const getProcessedHtml = () => {
    if (!grapesInstance.current) return "";
    let html = grapesInstance.current.getHtml({});
    html = html.replace(/<\/?body[^>]*>/gi, "");
    const css = grapesInstance.current.getCss({});
    return juice.inlineContent(html, css);
  };

  const triggerAutoSave = () => {
    if (onAutoSave && grapesInstance.current) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        const inlinedHtml = getProcessedHtml();
        onAutoSave(inlinedHtml);
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1500);
      }, 1000); // Debounce 1s to avoid heavy processing too often
    }
  };

  const initGrapes = () => {
    if (!editorRef.current) return;
    if (grapesInstance.current) {
      grapesInstance.current.destroy();
      grapesInstance.current = null;
    }
    // Usar grapesjs importado por npm
    grapesInstance.current = grapesjs.init({
      container: editorRef.current,
      fromElement: false,
      height: "500px",
      width: "100%",
      storageManager: false,
      plugins: [], // Si tienes plugins npm, impórtalos arriba y agrégalos aquí
      components: value || "<div>Type or design here</div>",
      styleManager: {
        sectors: [
          {
            name: "Text",
            open: true,
            buildProps: ["text-align"],
            properties: [
              {
                property: "text-align",
                type: "radio",
                defaults: "left",
                list: [
                  {
                    id: "left",
                    value: "left",
                    className: "fa fa-align-left",
                    title: "Left",
                  },
                  {
                    id: "center",
                    value: "center",
                    className: "fa fa-align-center",
                    title: "Center",
                  },
                  {
                    id: "right",
                    value: "right",
                    className: "fa fa-align-right",
                    title: "Right",
                  },
                  {
                    id: "justify",
                    value: "justify",
                    className: "fa fa-align-justify",
                    title: "Justify",
                  },
                ],
              },
            ],
          },
          {
            name: "Typography",
            open: false,
            buildProps: [
              "font-family",
              "font-size",
              "font-weight",
              "color",
              "letter-spacing",
              "line-height",
              "text-shadow",
            ],
          },
          {
            name: "Background",
            open: false,
            buildProps: [
              "background",
              "background-color",
              "background-image",
              "background-repeat",
              "background-position",
              "background-size",
            ],
          },
          {
            name: "Border",
            open: false,
            buildProps: ["border", "border-radius", "box-shadow"],
          },
          {
            name: "Spacing",
            open: false,
            buildProps: ["margin", "padding"],
          },
        ],
      },
    });

    // Add Canva/Word-like blocks
    const bm = grapesInstance.current.BlockManager;
    bm.add("title", {
      label: "Title",
      category: "Text",
      attributes: { class: "fa fa-header" },
      content:
        '<h1 style="font-size:2.5em;font-weight:bold;margin:0 0 10px;">Title</h1>',
    });
    bm.add("subtitle", {
      label: "Subtitle",
      category: "Text",
      attributes: { class: "fa fa-header" },
      content:
        '<h2 style="font-size:1.5em;font-weight:600;margin:0 0 8px;">Subtitle</h2>',
    });
    bm.add("paragraph", {
      label: "Paragraph",
      category: "Text",
      attributes: { class: "fa fa-paragraph" },
      content:
        '<p style="font-size:1em;line-height:1.6;">Write your paragraph here...</p>',
    });
    bm.add("text", {
      label: "Text",
      category: "Text",
      attributes: { class: "fa fa-text-width" },
      content: '<div style="padding:10px;">Insert your text</div>',
    });
    bm.add("list-ul", {
      label: "Bulleted List",
      category: "Text",
      attributes: { class: "fa fa-list-ul" },
      content:
        '<ul style="padding-left:20px;"><li>Item 1</li><li>Item 2</li></ul>',
    });
    bm.add("list-ol", {
      label: "Numbered List",
      category: "Text",
      attributes: { class: "fa fa-list-ol" },
      content:
        '<ol style="padding-left:20px;"><li>Item 1</li><li>Item 2</li></ol>',
    });
    bm.add("table", {
      label: "Table",
      category: "Layout",
      attributes: { class: "fa fa-table" },
      content:
        '<table style="width:100%;border-collapse:collapse;"><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell 1</td><td>Cell 2</td></tr></table>',
    });
    bm.add("image", {
      label: "Image",
      category: "Media",
      attributes: { class: "fa fa-image" },
      content: {
        type: "image",
        src: "https://via.placeholder.com/350x150",
        style: { width: "100%" },
      },
    });
    bm.add("icon", {
      label: "Icon",
      category: "Media",
      attributes: { class: "fa fa-star" },
      content:
        '<i class="fa fa-star" style="font-size:2em;color:var(--primary-blue);"></i>',
    });
    bm.add("button", {
      label: "Button",
      category: "Controls",
      attributes: { class: "fa fa-hand-pointer-o" },
      content:
        '<button style="padding:10px 20px;border-radius:6px;background:var(--gold);color:var(--text-dark);border:none;font-weight:600;">Click me</button>',
    });
    bm.add("card", {
      label: "Card",
      category: "Layout",
      attributes: { class: "fa fa-id-card" },
      content:
        '<div style="padding:20px;background:var(--neutral-light);border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><h3>Card Title</h3><p>Card content...</p></div>',
    });
    bm.add("section", {
      label: "Section",
      category: "Layout",
      attributes: { class: "fa fa-square-o" },
      content:
        '<section style="padding:20px;background:var(--neutral-light);border-radius:8px;"><h2>Section Title</h2><p>Section content...</p></section>',
    });
    bm.add("column", {
      label: "2 Columns",
      category: "Layout",
      attributes: { class: "fa fa-columns" },
      content:
        '<div style="display:flex;gap:16px;"><div style="flex:1;padding:10px;background:var(--neutral-mid);border-radius:6px;">Column 1</div><div style="flex:1;padding:10px;background:var(--neutral-mid);border-radius:6px;">Column 2</div></div>',
    });
    bm.add("background", {
      label: "Background",
      category: "Decor",
      attributes: { class: "fa fa-paint-brush" },
      content:
        '<div style="width:100%;height:100px;background:linear-gradient(90deg,var(--primary-blue),var(--gold));border-radius:8px;"></div>',
    });
    bm.add("rectangle", {
      label: "Rectangle",
      category: "Shapes",
      attributes: { class: "fa fa-square" },
      content:
        '<div style="width:100px;height:60px;background:var(--primary-blue);border-radius:8px;"></div>',
    });
    bm.add("circle", {
      label: "Circle",
      category: "Shapes",
      attributes: { class: "fa fa-circle" },
      content:
        '<div style="width:60px;height:60px;background:var(--gold);border-radius:50%;"></div>',
    });

    // Hook events for autosave
    grapesInstance.current.on("update", triggerAutoSave);
  };

  const handleSave = () => {
    if (grapesInstance.current) {
      let html = grapesInstance.current.getHtml({});
      html = html.replace(/<\/?body[^>]*>/gi, "");
      const css = grapesInstance.current.getCss({});
      const inlinedHtml = juice.inlineContent(html, css);
      onChange(inlinedHtml);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div
        style={{ minWidth: "90vw", minHeight: "85vh", position: "relative" }}
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
          style={{ border: "1px solid #ccc", borderRadius: 8 }}
        />
        <div style={{ marginTop: 16, textAlign: "right" }}>
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
