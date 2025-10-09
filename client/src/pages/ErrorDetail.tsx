import { isRouteErrorResponse, useRouteError } from "react-router-dom";

type Props = {};

function ErrorDetail({}: Props) {
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
          color: "#222",
          textAlign: "center",
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 24 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
        <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 8 }}>
          Page not found
        </h2>
        <p style={{ fontSize: 18, marginBottom: 24 }}>
          The page you are looking for does not exist or was moved.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "linear-gradient(90deg,#3b82f6,#06b6d4)",
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
        </a>
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
