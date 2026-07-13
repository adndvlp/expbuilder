import { useState } from "react";
import MoveDestinationList from "./MoveDestinationList";
import { MoveItemModalProps } from "./MoveItemModal.types";

function MoveItemModal({
  onConfirm,
  onClose,
  itemName,
  availableDestinations,
}: MoveItemModalProps) {
  const [selectedDestination, setSelectedDestination] = useState<
    number | string | null
  >(null);
  const [moveAsBranch, setMoveAsBranch] = useState(true);

  const handleConfirm = () => {
    // The button is disabled until a destination is selected.
    const destination = availableDestinations.find(
      (d) => d.id === selectedDestination,
    );
    const finalAddAsBranch = destination?.hasBranches ? moveAsBranch : false;
    onConfirm(selectedDestination as number | string, finalAddAsBranch);
  };

  const selectedDest = availableDestinations.find(
    (d) => d.id === selectedDestination,
  );

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.75)",
        padding: "24px 20px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
        width: "480px",
        maxWidth: "95vw",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1px solid var(--text-dark)",
        maxHeight: "80vh",
        overflow: "auto",
      }}
    >
      <h5
        style={{
          margin: "0 0 12px 0",
          color: "#fff",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Move Item
      </h5>

      <p
        style={{
          fontSize: 14,
          color: "#fff",
          marginBottom: 20,
          textAlign: "center",
          opacity: 0.8,
          lineHeight: "1.5",
        }}
      >
        Moving <strong>{itemName || "the selected item"}</strong>
        <br />
        Select a destination:
      </p>

      <MoveDestinationList
        destinations={availableDestinations}
        selectedDestination={selectedDestination}
        setSelectedDestination={setSelectedDestination}
      />

      {/* Options: Branch (parallel) or Sequential - only if the destination has branches */}
      {selectedDest && selectedDest.hasBranches && (
        <div
          style={{
            width: "100%",
            marginBottom: 16,
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "#fff",
              marginBottom: 12,
              opacity: 0.9,
            }}
          >
            How to add to <strong>{selectedDest.name}</strong>?
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setMoveAsBranch(false)}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: "6px",
                border: `2px solid ${
                  !moveAsBranch
                    ? "rgba(76, 175, 80, 0.6)"
                    : "rgba(255, 255, 255, 0.3)"
                }`,
                background: !moveAsBranch
                  ? "rgba(76, 175, 80, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              Sequential
            </button>

            <button
              onClick={() => setMoveAsBranch(true)}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: "6px",
                border: `2px solid ${
                  moveAsBranch
                    ? "rgba(76, 175, 80, 0.6)"
                    : "rgba(255, 255, 255, 0.3)"
                }`,
                background: moveAsBranch
                  ? "rgba(76, 175, 80, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              Branch (Parallel)
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
        }}
      >
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: "12px 20px",
            borderRadius: "8px",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          }}
        >
          Cancel
        </button>

        <button
          onClick={handleConfirm}
          disabled={selectedDestination === null}
          style={{
            flex: 1,
            padding: "12px 20px",
            borderRadius: "8px",
            border: "none",
            background:
              selectedDestination !== null
                ? "linear-gradient(135deg, #4caf50, #45a049)"
                : "rgba(76, 175, 80, 0.3)",
            color:
              selectedDestination !== null
                ? "#fff"
                : "rgba(255, 255, 255, 0.5)",
            cursor: selectedDestination !== null ? "pointer" : "not-allowed",
            fontSize: 15,
            fontWeight: 600,
            transition: "all 0.2s",
            boxShadow:
              selectedDestination !== null
                ? "0 2px 8px rgba(76, 175, 80, 0.3)"
                : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(76, 175, 80, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 2px 8px rgba(76, 175, 80, 0.3)";
          }}
        >
          Move
        </button>
      </div>
    </div>
  );
}

export default MoveItemModal;
