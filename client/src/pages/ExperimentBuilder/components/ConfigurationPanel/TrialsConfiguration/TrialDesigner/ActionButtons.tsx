import { TrialComponent } from "./types";

type Props = {
  onAutoSave: ((config: any) => void) | undefined;
  isAutoSaving: boolean | undefined;
  onClose: () => void;
  generateConfigFromComponents: (
    comps: TrialComponent[],
  ) => Record<string, any>;
  onSave: (config: any) => void;
  components: TrialComponent[];
};

function ActionButtons({
  onAutoSave,
  isAutoSaving,
  onClose,
  generateConfigFromComponents,
  onSave,
  components,
}: Props) {
  // Export configuration
  const handleExport = () => {
    const config = generateConfigFromComponents(components);
    onSave(config);
    onClose();
  };
  return (
    <div
      style={{
        padding: "12px 16px",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "10px",
        borderTop: "2px solid var(--neutral-mid)",
        background: "var(--neutral-light)",
      }}
    >
      {onAutoSave && (
        <div
          style={{
            marginRight: "auto",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: isAutoSaving ? "var(--text-light)" : "#059669",
            transition: "all 0.3s ease",
          }}
        >
          {isAutoSaving ? (
            <>
              <div
                className="spinner"
                style={{
                  width: "12px",
                  height: "12px",
                  border: "2px solid #e5e7eb",
                  borderTopColor: "var(--primary-blue)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Saving changes...
            </>
          ) : (
            <>✓ All changes saved</>
          )}
          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          padding: "10px 20px",
          border: "1px solid var(--danger)",
          borderRadius: "6px",
          background: "var(--danger)",
          color: "var(--text-light)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Cancel
      </button>
      <button
        onClick={handleExport}
        style={{
          padding: "10px 20px",
          border: "none",
          borderRadius: "6px",
          background: "linear-gradient(135deg, var(--gold), var(--dark-gold))",
          color: "var(--text-light)",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save Trial
      </button>
    </div>
  );
}

export default ActionButtons;
