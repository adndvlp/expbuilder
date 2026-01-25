import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

function ErrorDetail() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div
        style={{
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary-blue)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 16 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            letterSpacing: "2px",
            marginBottom: 8,
            background: "linear-gradient(90deg,var(--gold),var(--dark-gold))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 2px 16px rgba(212,175,55,0.25)",
          }}
        >
          404
        </div>
        <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 8 }}>
          Page not found
        </h2>
        <p style={{ fontSize: 18, marginBottom: 24 }}>
          The page you are looking for does not exist or was moved.
        </p>
        <Link
          to="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "linear-gradient(90deg,var(--gold),var(--dark-gold))",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 16,
            boxShadow: "0 2px 8px #0001",
            transition: "background 0.2s",
          }}
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div>
      {error instanceof Error
        ? `An error occurred: ${error.message}`
        : "An unexpected error occurred."}
    </div>
  );
}

export default ErrorDetail;
