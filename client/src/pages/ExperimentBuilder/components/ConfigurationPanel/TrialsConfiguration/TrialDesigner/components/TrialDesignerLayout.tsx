import type { ComponentProps } from "react";
import Modal from "../../ParameterMapper/Modal";
import ExperimentPreview from "../../../../ExperimentPreview";
import ActionButtons from "../ActionButtons";
import CanvasContextMenu from "../CanvasContextMenu";
import CanvasStylesBar from "../CanvasStylesBar";
import ComponentSidebar from "../ComponentSidebar";
import KonvaCanvas from "../KonvaCanvas";
import KonvaParameterMapper from "../KonvaParameterMapper";

interface TrialDesignerLayoutProps {
  actionProps: ComponentProps<typeof ActionButtons>;
  canvasProps: ComponentProps<typeof KonvaCanvas>;
  contextMenuProps: ComponentProps<typeof CanvasContextMenu>;
  isDemoRunning: boolean;
  mapperProps: ComponentProps<typeof KonvaParameterMapper>;
  modalProps: Omit<ComponentProps<typeof Modal>, "children">;
  previewProps: ComponentProps<typeof ExperimentPreview>;
  setShowRightPanel: (show: boolean) => void;
  showRightPanel: boolean;
  sidebarProps: ComponentProps<typeof ComponentSidebar>;
  toolbarProps: ComponentProps<typeof CanvasStylesBar>;
}

export default function TrialDesignerLayout({
  actionProps,
  canvasProps,
  contextMenuProps,
  isDemoRunning,
  mapperProps,
  modalProps,
  previewProps,
  setShowRightPanel,
  showRightPanel,
  sidebarProps,
  toolbarProps,
}: TrialDesignerLayoutProps) {
  return (
    <Modal {...modalProps}>
      <div style={rootStyle}>
        <CanvasStylesBar {...toolbarProps} />
        {isDemoRunning && (
          <div style={previewOverlayStyle}>
            <ExperimentPreview {...previewProps} />
          </div>
        )}
        <div style={panelsStyle}>
          <ComponentSidebar {...sidebarProps} />
          <KonvaCanvas {...canvasProps} />
          {showRightPanel && <KonvaParameterMapper {...mapperProps} />}
          {!showRightPanel && (
            <button
              onClick={() => setShowRightPanel(true)}
              style={rightPanelToggleStyle}
            >
              ‹
            </button>
          )}
        </div>
        <CanvasContextMenu {...contextMenuProps} />
        <ActionButtons {...actionProps} />
      </div>
    </Modal>
  );
}

const rootStyle = {
  display: "flex",
  flexDirection: "column" as const,
  height: "100%",
  width: "100%",
};

const previewOverlayStyle = {
  position: "absolute" as const,
  top: 42,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  background: "var(--neutral-light)",
  display: "flex",
  flexDirection: "column" as const,
  overflow: "hidden",
};

const panelsStyle = {
  display: "flex",
  flex: 1,
  gap: 0,
  overflow: "hidden",
};

const rightPanelToggleStyle = {
  position: "absolute" as const,
  right: 0,
  top: "50%",
  transform: "translateY(-50%)",
  background: "var(--primary-blue)",
  color: "var(--text-light)",
  border: "none",
  borderRadius: "8px 0 0 8px",
  padding: "16px 8px",
  cursor: "pointer",
  zIndex: 20,
  fontSize: "18px",
  fontWeight: "bold",
};
