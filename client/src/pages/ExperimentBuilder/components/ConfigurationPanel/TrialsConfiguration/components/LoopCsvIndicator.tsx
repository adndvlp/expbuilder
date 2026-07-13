import Switch from "react-switch";
import type { Loop } from "../../types";

interface Props {
  parentLoop: Loop | null;
}

export default function LoopCsvIndicator({ parentLoop }: Props) {
  if (!parentLoop || (parentLoop.csvJson?.length ?? 0) === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "16px",
        padding: "12px 16px",
        backgroundColor: "var(--neutral-light)",
        borderRadius: "8px",
        border: "1px solid var(--neutral-mid)",
      }}
    >
      <Switch
        checked
        onChange={() => {}}
        disabled
        onColor="#f1c40f"
        offColor="#cccccc"
        onHandleColor="#ffffff"
        offHandleColor="#ffffff"
        handleDiameter={24}
        uncheckedIcon={false}
        checkedIcon={false}
        height={20}
        width={44}
      />
      <label style={{ margin: 0, fontWeight: 500, color: "var(--text-dark)" }}>
        Using CSV from loop
      </label>
    </div>
  );
}
