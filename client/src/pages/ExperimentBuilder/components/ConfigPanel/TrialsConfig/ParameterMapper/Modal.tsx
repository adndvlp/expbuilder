import React from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
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
