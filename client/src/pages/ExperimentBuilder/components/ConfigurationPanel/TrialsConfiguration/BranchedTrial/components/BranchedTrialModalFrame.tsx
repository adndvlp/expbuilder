import type { ReactNode } from "react";
import { FaTimes } from "react-icons/fa";
import Modal from "../../ParameterMapper/Modal";

interface Props {
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  saveIndicator: boolean;
}

export default function BranchedTrialModalFrame({
  children,
  isOpen,
  onClose,
  saveIndicator,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            minWidth: "900px",
            maxWidth: "1100px",
            minHeight: "60vh",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            backgroundColor: "var(--background)",
            borderRadius: "12px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
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
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "2px solid var(--neutral-mid)",
              backgroundColor: "var(--background)",
              color: "var(--text-dark)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = "var(--primary-blue)";
              event.currentTarget.style.color = "white";
              event.currentTarget.style.borderColor = "var(--primary-blue)";
              event.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "var(--background)";
              event.currentTarget.style.color = "var(--text-dark)";
              event.currentTarget.style.borderColor = "var(--neutral-mid)";
              event.currentTarget.style.transform = "scale(1)";
            }}
          >
            <FaTimes size={18} />
          </button>
          {children}
        </div>
      </div>
    </Modal>
  );
}
