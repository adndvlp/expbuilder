import React, { useEffect, useRef } from "react";
import juice from "juice";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./grapesjs-theme.css";
import Modal from "../Modal";

interface GrapesButtonEditorProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string;
  onChange: (html: string) => void;
  title?: string;
}

const GrapesButtonEditor: React.FC<GrapesButtonEditorProps> = ({
  isOpen,
  onClose,
  value = "",
  onChange,
  title = "Button Editor (GrapesJS)",
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const grapesInstance = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    initGrapes();
    // Cleanup on close
    return () => {
      if (grapesInstance.current) {
        grapesInstance.current.destroy();
        grapesInstance.current = null;
      }
    };
    // eslint-disable-next-line
  }, [isOpen]);

  const initGrapes = () => {
    if (!editorRef.current) return;
    if (grapesInstance.current) {
      grapesInstance.current.destroy();
      grapesInstance.current = null;
    }

    // Initialize GrapesJS with button-only configuration
    grapesInstance.current = grapesjs.init({
      container: editorRef.current,
      fromElement: false,
      height: "500px",
      width: "100%",
      storageManager: false,
      plugins: [],
      components:
        value ||
        '<button style="padding:10px 20px;border-radius:6px;background:var(--gold);color:var(--text-dark);border:none;font-weight:600;cursor:pointer;">{{choice}}</button>',
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
                defaults: "center",
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
                ],
              },
            ],
          },
          {
            name: "Typography",
            open: true,
            buildProps: [
              "font-family",
              "font-size",
              "font-weight",
              "color",
              "letter-spacing",
            ],
          },
          {
            name: "Button Styling",
            open: true,
            buildProps: [
              "background",
              "background-color",
              "border",
              "border-radius",
              "box-shadow",
            ],
          },
          {
            name: "Spacing",
            open: true,
            buildProps: ["margin", "padding", "width", "height"],
          },
        ],
      },
    });

    // Only add button block - restrict to button component only
    const bm = grapesInstance.current.BlockManager;

    // Clear default blocks
    bm.getAll().forEach((block: any) => bm.remove(block.id));

    // Add button block
    bm.add("button", {
      label: "Button",
      category: "Controls",
      attributes: { class: "fa fa-hand-pointer-o" },
      content:
        '<button style="padding:10px 20px;border-radius:6px;background:#3b82f6;color:white;border:none;font-weight:600;cursor:pointer;">New Button</button>',
    });

    // Add container blocks for layout
    bm.add("flex-container", {
      label: "Flex Container",
      category: "Layout",
      attributes: { class: "fa fa-square-o" },
      content:
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;padding:10px;border:1px dashed #ccc;">Drop buttons here</div>',
    });

    bm.add("grid-container", {
      label: "Grid Container",
      category: "Layout",
      attributes: { class: "fa fa-th" },
      content:
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:10px;padding:10px;border:1px dashed #ccc;">Drop buttons here</div>',
    });

    bm.add("text", {
      label: "Text",
      category: "Basic",
      attributes: { class: "fa fa-text-width" },
      content:
        '<span style="display:inline-block;padding:5px;">Add text</span>',
    });

    bm.add("divider", {
      label: "Divider",
      category: "Basic",
      attributes: { class: "fa fa-minus" },
      content:
        '<hr style="border:none;border-top:1px solid #ccc;margin:10px 0;">',
    });

    // Remove all default blocks except button
    const defaultBlocks = [
      "column1",
      "column2",
      "column3",
      "column3-7",
      "link",
      "image",
      "video",
      "map",
    ];
    defaultBlocks.forEach((blockId) => {
      if (bm.get(blockId)) {
        bm.remove(blockId);
      }
    });
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
      <div style={{ minWidth: "70vw", minHeight: "520px" }}>
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
          <strong>⚠️ Button Template Mode:</strong> Design your button template
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
          style={{ border: "1px solid #ccc", borderRadius: 8 }}
        />
        <div style={{ marginTop: 16, textAlign: "right" }}>
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
