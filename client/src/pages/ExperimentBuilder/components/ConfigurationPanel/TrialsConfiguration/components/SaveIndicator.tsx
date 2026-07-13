interface Props {
  field: string | null;
  visible: boolean;
}

const indicatorStyle = {
  transition: "opacity 0.3s",
  color: "green",
  fontWeight: "500",
  position: "fixed",
  top: "20px",
  right: "20px",
  zIndex: 1000,
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  padding: "6px 12px",
  borderRadius: "4px",
  fontSize: "14px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  border: "1px solid #22c55e",
} as const;

export default function SaveIndicator({ field, visible }: Props) {
  return (
    <div style={{ ...indicatorStyle, opacity: visible ? 1 : 0 }}>
      ✓ Saved {field ? `(${field})` : "Trial"}
    </div>
  );
}
