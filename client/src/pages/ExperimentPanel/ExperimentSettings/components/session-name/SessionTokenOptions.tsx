import type { SessionNameToken } from "../../types";
import { SESSION_TOKEN_CATALOG } from "../../utils/sessionName";

export function SessionTokenOptions({
  token,
  onUpdate,
}: {
  token: SessionNameToken;
  onUpdate: (patch: Partial<SessionNameToken>) => void;
}) {
  const metadata = SESSION_TOKEN_CATALOG.find(
    (item) => item.type === token.type,
  )!;
  return (
    <div
      style={{
        padding: 16,
        marginBottom: 16,
        border: `2px solid ${metadata.color}44`,
        borderRadius: 8,
        backgroundColor: `${metadata.color}08`,
      }}
    >
      <p
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: metadata.color,
          marginBottom: 12,
        }}
      >
        {metadata.label} options
      </p>
      {token.type === "date" && (
        <OptionField label="Date format">
          <select
            value={token.dateFormat}
            onChange={(event) => onUpdate({ dateFormat: event.target.value })}
            style={controlStyle}
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-04-09)</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY (e.g. 09-04-2026)</option>
            <option value="MM-DD-YYYY">MM-DD-YYYY (e.g. 04-09-2026)</option>
            <option value="YYYYMMDD">YYYYMMDD (e.g. 20260409)</option>
          </select>
        </OptionField>
      )}
      {token.type === "time" && (
        <OptionField label="Time format">
          <select
            value={token.timeFormat}
            onChange={(event) => onUpdate({ timeFormat: event.target.value })}
            style={controlStyle}
          >
            <option value="HH-mm">HH-mm (e.g. 14-35)</option>
            <option value="HH-mm-ss">HH-mm-ss (e.g. 14-35-22)</option>
            <option value="HHmmss">HHmmss (e.g. 143522)</option>
          </select>
        </OptionField>
      )}
      {token.type === "randomAlpha" && (
        <OptionField label="Length">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min={4}
              max={16}
              value={token.randomLength}
              onChange={(event) =>
                onUpdate({ randomLength: Number(event.target.value) })
              }
              style={{ width: 160 }}
            />
            <span
              style={{
                fontSize: 14,
                color: "var(--text-dark)",
                fontFamily: "monospace",
                fontWeight: 600,
              }}
            >
              {token.randomLength} chars
            </span>
          </div>
        </OptionField>
      )}
      {token.type === "customText" && (
        <OptionField label="Text value">
          <input
            type="text"
            placeholder="e.g. pilot, exp1, …"
            value={token.customValue}
            onChange={(event) => onUpdate({ customValue: event.target.value })}
            style={{ ...controlStyle, width: 220 }}
          />
        </OptionField>
      )}
      {token.type === "counter" && (
        <OptionField label="Number of digits">
          <select
            value={token.counterDigits}
            onChange={(event) =>
              onUpdate({ counterDigits: Number(event.target.value) })
            }
            style={controlStyle}
          >
            {[1, 2, 3, 4, 5, 6].map((digits) => (
              <option key={digits} value={digits}>
                {digits} digit{digits > 1 ? "s" : ""} (e.g.{" "}
                {"0".repeat(digits - 1)}
                1)
              </option>
            ))}
          </select>
        </OptionField>
      )}
    </div>
  );
}

const controlStyle = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "2px solid var(--neutral-mid)",
  backgroundColor: "var(--neutral-light)",
  color: "var(--text-dark)",
  fontSize: 14,
} as const;

function OptionField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-dark)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
