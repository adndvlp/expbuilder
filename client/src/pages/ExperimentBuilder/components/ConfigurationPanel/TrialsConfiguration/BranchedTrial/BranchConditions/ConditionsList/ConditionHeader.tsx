import { Condition } from "../../types";

type Props = {
  condIdx: number;
  condition: Condition;
  removeCondition: (conditionId: number) => void;
};

function ConditionHeader({ condIdx, condition, removeCondition }: Props) {
  return (
    <div
      style={{
        padding: "16px 20px",
        background:
          "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            padding: "6px 12px",
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.2)",
            fontWeight: 700,
            fontSize: "14px",
            color: "white",
          }}
        >
          {condIdx === 0 ? "IF" : "OR IF"}
        </div>
        <span
          style={{
            fontWeight: 600,
            fontSize: "15px",
            color: "white",
          }}
        >
          Condition {condIdx + 1}
        </span>
      </div>
      <button
        onClick={() => removeCondition(condition.id)}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "all 0.2s ease",
          backgroundColor: "rgba(207, 0, 11, 0.9)",
          color: "white",
          fontWeight: 700,
          fontSize: "18px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(207, 0, 11, 1)";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(207, 0, 11, 0.9)";
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Remove condition"
      >
        ✕
      </button>
    </div>
  );
}

export default ConditionHeader;
