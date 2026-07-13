import { Dispatch, SetStateAction } from "react";
import { MoveDestination } from "./MoveItemModal.types";

type Props = {
  destinations: MoveDestination[];
  selectedDestination: string | number | null;
  setSelectedDestination: Dispatch<SetStateAction<string | number | null>>;
};

export default function MoveDestinationList({
  destinations,
  selectedDestination,
  setSelectedDestination,
}: Props) {
  return (
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
      {destinations.length === 0 ? (
        <p
          style={{
            color: "#fff",
            opacity: 0.6,
            textAlign: "center",
            padding: "16px",
          }}
        >
          No available destinations
        </p>
      ) : (
        destinations.map((destination) => (
          <div
            key={destination.id}
            onClick={() => setSelectedDestination(destination.id)}
            style={{
              padding: "12px 16px",
              marginBottom: "6px",
              borderRadius: "6px",
              cursor: "pointer",
              background:
                selectedDestination === destination.id
                  ? "rgba(76, 175, 80, 0.25)"
                  : "rgba(255, 255, 255, 0.05)",
              border: `2px solid ${
                selectedDestination === destination.id
                  ? "rgba(76, 175, 80, 0.6)"
                  : "rgba(255, 255, 255, 0.15)"
              }`,
              transition: "all 0.2s",
            }}
            onMouseEnter={(event) => {
              if (selectedDestination !== destination.id) {
                event.currentTarget.style.background =
                  "rgba(255, 255, 255, 0.1)";
              }
            }}
            onMouseLeave={(event) => {
              if (selectedDestination !== destination.id) {
                event.currentTarget.style.background =
                  "rgba(255, 255, 255, 0.05)";
              }
            }}
          >
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>
              {destination.name}
            </div>
            <div
              style={{
                color: "#fff",
                fontSize: 12,
                opacity: 0.7,
                marginTop: "2px",
              }}
            >
              {destination.type === "trial" ? "Trial" : "Loop"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
