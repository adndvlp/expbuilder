export default function GridToggleButton({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      title="Show the grid and snap elements to its lines. Hold Alt while dragging to move freely."
      style={{
        padding: "5px 10px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.4)",
        background: enabled ? "rgba(255,255,255,0.2)" : "transparent",
        color: "var(--text-light)",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      Grid
    </button>
  );
}
