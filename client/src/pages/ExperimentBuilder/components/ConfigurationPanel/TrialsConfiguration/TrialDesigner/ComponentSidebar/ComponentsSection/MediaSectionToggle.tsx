interface Props {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}

export default function MediaSectionToggle({
  expanded,
  label,
  onToggle,
}: Props) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%",
        padding: "10px 12px",
        background: "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
        color: "#1e40af",
        border: "1px solid #93c5fd",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: 600,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "8px",
      }}
    >
      <span>{label}</span>
      <span>{expanded ? "▼" : "▶"}</span>
    </button>
  );
}
