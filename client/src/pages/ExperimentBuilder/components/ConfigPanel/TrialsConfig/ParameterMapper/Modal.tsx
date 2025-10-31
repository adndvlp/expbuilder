import React from "react";
import { createPortal } from "react-dom";
import { IoMdClose } from "react-icons/io";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
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
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(2px)",
        }}
        onClick={onClose}
      />

      <div
        className="relative bg-white rounded-lg shadow-2xl w-full mx-4 overflow-hidden"
        style={{
          maxWidth: "90vw",
          maxHeight: "100vh",
          zIndex: 1000000,
          position: "relative",
        }}
      >
        {/* Header del modal */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h4 className="text-lg font-semibold text-gray-900">
            {title || "HTML Editor"}
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-200"
          >
            <IoMdClose size={24} />
          </button>
        </div>

        {/* Cuerpo del modal con scroll */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: "100vh" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
