type Props = {
  surveyJson: Record<string, unknown>;
  onChange: (json: Record<string, unknown>) => void;
};

function ThemeCustomization({ surveyJson, onChange }: Props) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <details>
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--text-dark)",
            marginBottom: "12px",
            padding: "8px",
            background: "var(--neutral-mid)",
            borderRadius: "6px",
          }}
        >
          Theme Customization (optional)
        </summary>
        <div
          style={{
            paddingTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--text-dark)",
              }}
            >
              Primary Color
            </label>
            <input
              type="color"
              value={
                (surveyJson?.themeVariables as Record<string, string>)?.[
                  "--sjs-primary-backcolor"
                ] || "#333333"
              }
              onChange={(e) =>
                onChange({
                  ...surveyJson,
                  themeVariables: {
                    ...((surveyJson?.themeVariables as object) || {}),
                    "--sjs-primary-backcolor": e.target.value,
                  },
                })
              }
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-dark)",
                opacity: 0.7,
                marginTop: "4px",
              }}
            >
              Used for buttons and highlights
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--text-dark)",
              }}
            >
              Text Color
            </label>
            <input
              type="color"
              value={
                (surveyJson?.themeVariables as Record<string, string>)?.[
                  "--sjs-general-forecolor"
                ] || "#333333"
              }
              onChange={(e) =>
                onChange({
                  ...surveyJson,
                  themeVariables: {
                    ...((surveyJson?.themeVariables as object) || {}),
                    "--sjs-general-forecolor": e.target.value,
                  },
                })
              }
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-dark)",
                opacity: 0.7,
                marginTop: "4px",
              }}
            >
              Main text color
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--text-dark)",
              }}
            >
              Background Color
            </label>
            <input
              type="color"
              value={
                (surveyJson?.themeVariables as Record<string, string>)?.[
                  "--sjs-general-backcolor-dim"
                ] || "#f9fafb"
              }
              onChange={(e) =>
                onChange({
                  ...surveyJson,
                  themeVariables: {
                    ...((surveyJson?.themeVariables as object) || {}),
                    "--sjs-general-backcolor-dim": e.target.value,
                  },
                })
              }
              style={{
                width: "100%",
                height: "40px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-dark)",
                opacity: 0.7,
                marginTop: "4px",
              }}
            >
              Background for questions
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

export default ThemeCustomization;
