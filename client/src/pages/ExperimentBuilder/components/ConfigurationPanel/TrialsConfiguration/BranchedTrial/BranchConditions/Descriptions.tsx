import { FaCodeBranch, FaArrowRight } from "react-icons/fa";

function Descriptions() {
  return (
    <div
      style={{
        marginBottom: "24px",
        padding: "20px",
        borderRadius: "12px",
        border: "2px solid var(--primary-blue)",
        backgroundColor: "var(--neutral-light)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "24px",
            backgroundColor: "var(--primary-blue)",
            borderRadius: "2px",
          }}
        />
        <h3
          style={{
            color: "var(--text-dark)",
            fontSize: "16px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Branch & Jump Conditions
        </h3>
      </div>
      <p
        style={{
          color: "var(--text-dark)",
          fontSize: "14px",
          marginBottom: "12px",
          lineHeight: "1.6",
        }}
      >
        Configure conditions to navigate between trials dynamically.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
        }}
      >
        <div
          style={{
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: "rgba(61, 146, 180, 0.1)",
            border: "1px solid var(--primary-blue)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: "var(--primary-blue)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaCodeBranch size={12} />
            </div>
            <strong style={{ fontSize: "14px", color: "var(--text-dark)" }}>
              Branch
            </strong>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-dark)",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            Navigate within current scope. Allows parameter overriding.
          </p>
        </div>
        <div
          style={{
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: "rgba(212, 175, 55, 0.1)",
            border: "1px solid var(--gold)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                backgroundColor: "var(--gold)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaArrowRight size={12} />
            </div>
            <strong style={{ fontSize: "14px", color: "var(--text-dark)" }}>
              Jump
            </strong>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-dark)",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            Navigate to any trial. Parameter override disabled.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Descriptions;
