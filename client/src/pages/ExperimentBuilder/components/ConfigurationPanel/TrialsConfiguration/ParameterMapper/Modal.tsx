import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  isTopmostEditorModal,
  registerEditorModal,
  unregisterEditorModal,
} from "./modalMarker";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * Content editors (HTML, button, survey) set this so the designer canvas
   * shortcuts stay inert while the modal is open: Delete/Backspace must edit
   * the modal content, and Escape must close the modal instead of the designer.
   */
  suppressDesignerShortcuts?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  suppressDesignerShortcuts = false,
}) => {
  const tokenRef = useRef(Symbol("editor-modal"));

  useEffect(() => {
    if (!isOpen || !suppressDesignerShortcuts) return;
    const token = tokenRef.current;
    registerEditorModal(token);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!isTopmostEditorModal(token)) return;
      onClose();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      unregisterEditorModal(token);
    };
  }, [isOpen, onClose, suppressDesignerShortcuts]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 999999,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
      }}
    >
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      <div
        className="relative w-full h-full overflow-hidden"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: "100vw",
          maxHeight: "100vh",
          zIndex: 1000000,
          position: "relative",
          backgroundColor: "var(--background)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
