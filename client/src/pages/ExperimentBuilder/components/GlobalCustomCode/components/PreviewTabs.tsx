import { Variant } from "../config";

type Props = {
  value: Variant;
  onChange: (value: Variant) => void;
  isLightMode: boolean;
  borderColor: string;
  panelHeaderBg: string;
  panelHeaderColor: string;
  hideLabel?: boolean;
};

export function PreviewTabs({
  value,
  onChange,
  isLightMode,
  borderColor,
  panelHeaderBg,
  panelHeaderColor,
  hideLabel,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        background: panelHeaderBg,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
        gap: 0,
      }}
    >
      {!hideLabel && (
        <span style={{ fontSize: 9, color: panelHeaderColor, marginRight: 8 }}>
          preview
        </span>
      )}
      {(["local", "public"] as Variant[]).map((variant) => (
        <button
          key={variant}
          type="button"
          onClick={() => onChange(variant)}
          style={{
            padding: "3px 10px",
            border: "none",
            borderBottom:
              value === variant ? "2px solid #3d92b4" : "2px solid transparent",
            background: "transparent",
            color:
              value === variant
                ? isLightMode
                  ? "#333"
                  : "#ccc"
                : panelHeaderColor,
            fontSize: 9,
            fontWeight: value === variant ? 600 : 400,
            cursor: "pointer",
          }}
        >
          {variant === "local" ? "Local" : "Public"}
        </button>
      ))}
      <span
        style={{
          marginLeft: "auto",
          fontSize: 9,
          color: panelHeaderColor,
          fontStyle: "italic",
        }}
      >
        read-only · matches HTML
      </span>
    </div>
  );
}
