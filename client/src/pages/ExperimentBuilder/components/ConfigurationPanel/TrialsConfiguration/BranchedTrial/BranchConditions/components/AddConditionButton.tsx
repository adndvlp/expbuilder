interface Props {
  onClick: () => void;
}

export default function AddConditionButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        marginTop: "24px",
        padding: "14px 32px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        transition: "all 0.3s ease",
        background:
          "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
        color: "white",
        boxShadow: "0 4px 12px rgba(61, 146, 180, 0.3)",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.boxShadow =
          "0 6px 16px rgba(61, 146, 180, 0.4)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.boxShadow =
          "0 4px 12px rgba(61, 146, 180, 0.3)";
      }}
    >
      <span style={{ fontSize: "18px" }}>+</span> Add condition (OR)
    </button>
  );
}
