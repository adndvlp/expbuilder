import { useState } from "react";

type Props = {
  onConfirm: (destinationId: number | string, addAsBranch: boolean) => void;
  onClose: () => void;
  itemName?: string;
  availableDestinations: {
    id: number | string;
    name: string;
    type: "trial" | "loop";
    hasBranches: boolean;
  }[];
};

function MoveItemModal({
  onConfirm,
  onClose,
  itemName,
  availableDestinations,
}: Props) {
  const [selectedDestination, setSelectedDestination] = useState<
    number | string | null
  >(null);
  const [moveAsBranch, setMoveAsBranch] = useState(true);

  const handleConfirm = () => {
    if (selectedDestination !== null) {
      // Si el destino no tiene branches, siempre es secuencial
      const destination = availableDestinations.find(
        (d) => d.id === selectedDestination,
      );
      const finalAddAsBranch = destination?.hasBranches ? moveAsBranch : false;
      onConfirm(selectedDestination, finalAddAsBranch);
    }
  };

  const selectedDest = availableDestinations.find(
    (d) => d.id === selectedDestination,
  );

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.32)",
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
          color: "var(--text-dark)",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Move Item
      </h5>

      <p
        style={{
          fontSize: 14,
          color: "var(--text-dark)",
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

      {/* Lista de destinos */}
      <div
        style={{
          width: "100%",
          maxHeight: "240px",
          overflowY: "auto",
          marginBottom: 16,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "8px",
          padding: "8px",
        }}
      >
        {availableDestinations.length === 0 ? (
          <p
            style={{
              color: "var(--text-dark)",
              opacity: 0.6,
              textAlign: "center",
              padding: "16px",
            }}
          >
            No available destinations
          </p>
        ) : (
          availableDestinations.map((dest) => (
            <div
              key={dest.id}
              onClick={() => setSelectedDestination(dest.id)}
              style={{
                padding: "12px 16px",
                marginBottom: "6px",
                borderRadius: "6px",
                cursor: "pointer",
                background:
                  selectedDestination === dest.id
                    ? "rgba(76, 175, 80, 0.25)"
                    : "rgba(255, 255, 255, 0.05)",
                border: `2px solid ${
                  selectedDestination === dest.id
                    ? "rgba(76, 175, 80, 0.6)"
                    : "rgba(255, 255, 255, 0.15)"
                }`,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (selectedDestination !== dest.id) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDestination !== dest.id) {
                  e.currentTarget.style.background =
                    "rgba(255, 255, 255, 0.05)";
                }
              }}
            >
              <div
                style={{
                  color: "var(--text-dark)",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {dest.name}
              </div>
              <div
                style={{
                  color: "var(--text-dark)",
                  fontSize: 12,
                  opacity: 0.7,
                  marginTop: "2px",
                }}
              >
                {dest.type === "trial" ? "Trial" : "Loop"}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Opciones: Branch (paralelo) o Sequential - solo si el destino tiene branches */}
      {selectedDest && selectedDest.id && selectedDest.hasBranches && (
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
              color: "var(--text-dark)",
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
                color: "var(--text-dark)",
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
                color: "var(--text-dark)",
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

      {/* Botones de acción */}
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
            color: "var(--text-dark)",
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
            if (selectedDestination !== null) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(76, 175, 80, 0.4)";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedDestination !== null) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(76, 175, 80, 0.3)";
            }
          }}
        >
          Move
        </button>
      </div>
    </div>
  );
}

export default MoveItemModal;
