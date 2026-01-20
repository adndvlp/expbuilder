type Props = {
  onMove: (direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
};

function ActionButtons({ onMove, canMoveUp, canMoveDown, onDelete }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        paddingTop: "12px",
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <button
        onClick={() => onMove("up")}
        disabled={!canMoveUp}
        style={{
          padding: "6px 12px",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          background: canMoveUp ? "var(--neutral-light)" : "var(--neutral-mid)",
          color: "var(--text-dark)",
          cursor: canMoveUp ? "pointer" : "not-allowed",
          fontSize: "13px",
        }}
      >
        Move Up
      </button>
      <button
        onClick={() => onMove("down")}
        disabled={!canMoveDown}
        style={{
          padding: "6px 12px",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          background: canMoveDown
            ? "var(--neutral-light)"
            : "var(--neutral-mid)",
          color: "var(--text-dark)",
          cursor: canMoveDown ? "pointer" : "not-allowed",
          fontSize: "13px",
        }}
      >
        Move Down
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={onDelete}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          border: "1px solid #ef4444",
          borderRadius: "6px",
          background: "var(--neutral-light)",
          color: "#ef4444",
          cursor: "pointer",
          fontSize: "13px",
        }}
      >
        Delete
      </button>
    </div>
  );
}

export default ActionButtons;
