import { FaClipboardList } from "react-icons/fa";

interface Props {
  onAdd: () => void;
}

export default function ConditionsEmptyState({ onAdd }: Props) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        borderRadius: "16px",
        border: "2px dashed var(--neutral-mid)",
        backgroundColor: "var(--background)",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          margin: "0 auto 16px",
          borderRadius: "50%",
          backgroundColor: "var(--neutral-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--primary-blue)",
        }}
      >
        <FaClipboardList size={32} />
      </div>
      <p
        style={{
          marginBottom: "24px",
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--text-dark)",
        }}
      >
        No conditions configured
      </p>
      <button
        onClick={onAdd}
        style={{
          padding: "12px 32px",
          borderRadius: "10px",
          fontWeight: 700,
          fontSize: "14px",
          border: "none",
          cursor: "pointer",
          transition: "all 0.3s ease",
          background: "linear-gradient(135deg, var(--gold), var(--dark-gold))",
          color: "var(--text-light)",
          boxShadow: "0 4px 12px rgba(212, 175, 55, 0.3)",
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.transform = "translateY(-2px)";
          event.currentTarget.style.boxShadow =
            "0 6px 16px rgba(212, 175, 55, 0.4)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = "translateY(0)";
          event.currentTarget.style.boxShadow =
            "0 4px 12px rgba(212, 175, 55, 0.3)";
        }}
      >
        + Add first condition
      </button>
    </div>
  );
}
