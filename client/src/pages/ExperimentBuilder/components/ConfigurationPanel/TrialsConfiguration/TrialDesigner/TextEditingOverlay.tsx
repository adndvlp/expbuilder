import { useEffect, useRef, useState } from "react";
import { TrialComponent } from "./types";
import { getTextComponentModel } from "./textComponentModel";

type Props = {
  component: TrialComponent | null;
  stageScale: number;
  canvasWidth: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
};

export default function TextEditingOverlay({
  component,
  stageScale,
  canvasWidth,
  onCommit,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    setDraft(component ? getTextComponentModel(component, canvasWidth).text : "");
  }, [component, canvasWidth]);

  useEffect(() => {
    if (!component) return;
    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const caretPosition = textarea.value.length;
      textarea.setSelectionRange(caretPosition, caretPosition);
    });
    return () => cancelAnimationFrame(frame);
  }, [component?.id]);

  if (!component || component.type !== "TextComponent") return null;

  const model = getTextComponentModel(component, canvasWidth);
  const editWidth = component.width > 0 ? component.width : model.drawWidth;
  const editHeight = component.height > 0 ? component.height : model.drawHeight;
  const left = (component.x - editWidth / 2) * stageScale;
  const top = (component.y - editHeight / 2) * stageScale;

  const commit = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCommit(draft);
  };

  const cancel = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCancel();
  };

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }

        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();
          commit();
        }
      }}
      style={{
        position: "absolute",
        left,
        top,
        width: editWidth * stageScale,
        height: editHeight * stageScale,
        transform: `rotate(${component.rotation || 0}deg)`,
        transformOrigin: "center center",
        zIndex: 9,
        resize: "none",
        boxSizing: "border-box",
        margin: 0,
        padding: `${4 * stageScale}px`,
        border: `${Math.max(2, 2 * stageScale)}px solid #0ea5e9`,
        outline: "none",
        borderRadius: Math.max(2, model.borderRadius * stageScale),
        background:
          model.backgroundColor === "transparent"
            ? "rgba(255,255,255,0.92)"
            : model.backgroundColor,
        color: model.fontColor,
        fontSize: model.fontSize * stageScale,
        fontFamily: model.fontFamily,
        fontWeight: model.fontWeight,
        fontStyle: model.fontStyle,
        lineHeight: String(model.lineHeight),
        textAlign: model.textAlign,
        overflow: "hidden",
        whiteSpace: "pre-wrap",
      }}
    />
  );
}
