export function SeparatorSelector({
  separator,
  onChange,
}: {
  separator: string;
  onChange: (separator: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-dark)",
          opacity: 0.8,
        }}
      >
        Separator:
      </span>
      {[
        { label: "_ underscore", value: "_" },
        { label: "- hyphen", value: "-" },
        { label: "none", value: "" },
      ].map((option) => (
        <button
          key={option.value === "" ? "none" : option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: "2px solid",
            borderColor:
              separator === option.value
                ? "var(--primary-blue)"
                : "var(--neutral-mid)",
            backgroundColor:
              separator === option.value
                ? "var(--primary-blue)"
                : "transparent",
            color:
              separator === option.value
                ? "var(--text-light)"
                : "var(--text-dark)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: option.value !== "" ? "monospace" : "inherit",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
