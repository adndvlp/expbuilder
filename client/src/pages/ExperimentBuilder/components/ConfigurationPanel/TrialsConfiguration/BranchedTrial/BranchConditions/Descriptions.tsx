export default function Descriptions() {
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
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
          Branching conditions
        </h3>
      </div>
      <p
        style={{
          color: "var(--text-dark)",
          fontSize: "14px",
          margin: "12px 0 0",
          lineHeight: "1.6",
        }}
      >
        The first matching condition selects the next trial and its parameter
        overrides. Otherwise, use the default destination. A trial continues
        through its own connections.
      </p>
    </div>
  );
}
