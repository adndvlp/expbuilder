type Props = {
  onConfirm: (addAsBranch: boolean) => void;
  onClose: () => void;
  parentName?: string;
};

function AddTrialModal({ onConfirm, onClose, parentName }: Props) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.75)",
        padding: "24px 20px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
        width: "420px",
        maxWidth: "95vw",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1px solid var(--text-dark)",
      }}
    >
      <h5
        style={{
          margin: "0 0 12px 0",
          color: "#fff",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Add New Trial
      </h5>

      <p
        style={{
          fontSize: 14,
          color: "#fff",
          marginBottom: 20,
          textAlign: "center",
          opacity: 0.8,
          lineHeight: "1.5",
        }}
      >
        <strong>{parentName || "The selected item"}</strong> already has
        branches.
        <br />
        Do you want to add the new trial as a <strong>branch</strong> (parallel)
        or as a <strong>parent</strong> (sequential before branches)?
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
        }}
      >
        <button
          onClick={() => onConfirm(false)}
          style={{
            flex: 1,
            padding: "14px 20px",
            borderRadius: "8px",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #4caf50, #45a049)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.border = "none";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(76, 175, 80, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.border = "2px solid rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          As Parent (Sequential)
        </button>

        <button
          onClick={() => onConfirm(true)}
          style={{
            flex: 1,
            padding: "14px 20px",
            borderRadius: "8px",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(135deg, #4caf50, #45a049)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.border = "none";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(76, 175, 80, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.border = "2px solid rgba(255, 255, 255, 0.3)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          As Branch (Parallel)
        </button>
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: 12,
          padding: "8px 16px",
          background: "transparent",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          fontSize: 13,
          opacity: 0.7,
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.7";
        }}
      >
        Cancel
      </button>
    </div>
  );
}

export default AddTrialModal;
