type Props = {};

function LandingPage({}: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(120deg, #3b82f6 0%, #06b6d4 100%)",
        color: "#fff",
        textAlign: "center",
        padding: 24,
      }}
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: 32 }}
      >
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M7 12h10M12 7v10" />
      </svg>
      <h1
        style={{
          fontSize: 48,
          fontWeight: 800,
          marginBottom: 16,
          letterSpacing: -2,
        }}
      >
        Welcome to Builder
      </h1>
      <p
        style={{
          fontSize: 22,
          maxWidth: 540,
          margin: "0 auto 32px",
          opacity: 0.95,
        }}
      >
        Create, manage, and launch behavioral experiments in minutes. <br />
        No code required. 100% open source.
      </p>
      <a
        href="/home"
        style={{
          display: "inline-block",
          padding: "16px 40px",
          background: "linear-gradient(90deg,#fff,#e0f2fe)",
          color: "#0ea5e9",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 20,
          textDecoration: "none",
          boxShadow: "0 4px 24px #0002",
          transition: "background 0.2s, color 0.2s",
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "#fff";
          (e.currentTarget as HTMLAnchorElement).style.color = "#06b6d4";
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background =
            "linear-gradient(90deg,#fff,#e0f2fe)";
          (e.currentTarget as HTMLAnchorElement).style.color = "#0ea5e9";
        }}
      >
        Get Started
      </a>
      <div style={{ marginTop: 48, opacity: 0.7, fontSize: 16 }}></div>
    </div>
  );
}

export default LandingPage;
