const STATE_STYLES: Record<string, { background: string; label: string }> = {
  initiated: { background: "#f59e0b", label: "Initiated" },
  "in-progress": { background: "#3b82f6", label: "In Progress" },
  completed: { background: "#10b981", label: "Completed" },
  abandoned: { background: "#ef4444", label: "Abandoned" },
};

export default function StateBadge({ state }: { state?: string }) {
  if (!state) return null;
  const style = STATE_STYLES[state] ?? {
    background: "#6b7280",
    label: "Unknown",
  };
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 12,
        backgroundColor: style.background,
        color: "white",
        fontSize: 12,
        fontWeight: 600,
        display: "inline-block",
      }}
    >
      {style.label}
    </span>
  );
}
