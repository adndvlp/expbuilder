import { createPortal } from "react-dom";
import { EditorArea } from "./CodeEditorModal/components/EditorArea";
import { ModalHeader } from "./CodeEditorModal/components/ModalHeader";
import { ModalHint } from "./CodeEditorModal/components/ModalHint";
import { ModalTabStrip } from "./CodeEditorModal/components/ModalTabStrip";
import { useCodeEditorModalState } from "./CodeEditorModal/hooks/useCodeEditorModalState";
import { CodeEditorModalProps } from "./CodeEditorModal/types";
import { useModalEscape } from "./CodeEditorModal/useModalEscape";

export type { ModalTabDef } from "./CodeEditorModal/types";

export default function CodeEditorModal({
  isOpen,
  onClose,
  title,
  language = "javascript",
  initialValue,
  onChange,
  readOnly = false,
  hint,
  tabs,
}: CodeEditorModalProps) {
  const state = useCodeEditorModalState({
    isOpen,
    initialValue,
    onChange,
    readOnly,
    tabs,
  });

  useModalEscape(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "82vw",
          height: "82vh",
          background: state.isLightMode ? "#fff" : "#1e1e1e",
          borderRadius: 6,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${state.isLightMode ? "#ddd" : "#3c3c3c"}`,
          boxShadow: "0 16px 56px rgba(0,0,0,0.7)",
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ModalHeader
          hint={hint}
          isLightMode={state.isLightMode}
          isMultiTab={state.isMultiTab}
          onClose={onClose}
          title={title}
        />
        {state.isMultiTab && tabs && (
          <ModalTabStrip
            activeTabKey={state.activeTabKey}
            isLightMode={state.isLightMode}
            onSelect={state.setActiveTabKey}
            tabs={tabs}
          />
        )}
        <EditorArea
          activeTabKey={state.activeTabKey}
          handleSingleMount={state.handleSingleMount}
          handleTabMount={state.handleTabMount}
          initialValue={initialValue}
          isLightMode={state.isLightMode}
          language={language}
          readOnly={readOnly}
          rightPanelValues={state.rightPanelValues}
          tabs={state.isMultiTab ? tabs : undefined}
        />
        {state.isMultiTab && tabs && (
          <ModalHint
            activeTabKey={state.activeTabKey}
            isLightMode={state.isLightMode}
            tabs={tabs}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
