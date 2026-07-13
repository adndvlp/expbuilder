type ModalHeaderProps = {
  hint?: string;
  isLightMode: boolean;
  isMultiTab: boolean;
  onClose: () => void;
  title: string;
};

export function ModalHeader({
  hint,
  isLightMode,
  isMultiTab,
  onClose,
  title,
}: ModalHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: isLightMode ? "#f3f3f3" : "#323233",
        borderBottom: `1px solid ${isLightMode ? "#ddd" : "#2b2b2b"}`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isLightMode ? "#444" : "#ccc",
        }}
      >
        {title}
      </span>
      {!isMultiTab && hint && (
        <span style={{ fontSize: 10, color: "#888", flex: 1 }}>{hint}</span>
      )}
      <button
        type="button"
        onClick={onClose}
        style={{
          marginLeft: "auto",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          color: isLightMode ? "#666" : "#888",
          padding: "0 4px",
        }}
      >
        ×
      </button>
    </div>
  );
}
