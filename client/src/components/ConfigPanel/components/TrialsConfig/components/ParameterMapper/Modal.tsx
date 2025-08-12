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

  // Usar createPortal para renderizar el modal directamente en document.body
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
      {/* Overlay oscuro que cubre toda la pantalla */}
      <div
        className="fixed inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          backdropFilter: "blur(2px)",
        }}
        onClick={onClose}
      />

      {/* Contenedor del modal centrado */}
      <div
        className="relative bg-white rounded-lg shadow-2xl w-full mx-4 overflow-hidden"
        style={{
          maxWidth: "80vw",
          maxHeight: "90vh",
          zIndex: 1000000,
          position: "relative",
        }}
      >
        {/* Header del modal */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            {title || "HTML Editor"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-200"
          >
            <IoMdClose size={24} />
          </button>
        </div>

        {/* Cuerpo del modal con scroll */}
        <div
          className="p-6 overflow-y-auto"
          style={{ maxHeight: "calc(90vh - 140px)" }}
        >
          {children}
        </div>

        {/* Footer del modal */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
