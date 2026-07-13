import { Link } from "react-router-dom";
import logo from "../../../icon/icon.png";
import { LandingFooter } from "./LandingPage/components/LandingFooter";

function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(120deg, #3d92b4 0%, #06b6d4 100%)",
        color: "#fff",
        textAlign: "center",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 32 }}
        >
          <div style={{ marginBottom: "8px", marginRight: "16px" }}>
            <img
              src={logo}
              style={{ width: 120, height: 120, objectFit: "contain" }}
            />
          </div>
        </div>
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
        <Link
          to="/home"
          style={{
            display: "inline-block",
            padding: "16px 40px",
            background: "linear-gradient(90deg,#d4af37,#f1c40f)",
            color: "#fff",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 20,
            textDecoration: "none",
            boxShadow: "0 4px 24px #0002",
            transition: "background 0.2s, color 0.2s",
          }}
          onMouseOver={(event) => {
            event.currentTarget.style.background = "#b7950b";
            event.currentTarget.style.color = "#fff";
          }}
          onMouseOut={(event) => {
            event.currentTarget.style.background =
              "linear-gradient(90deg,#d4af37,#f1c40f)";
            event.currentTarget.style.color = "#fff";
          }}
        >
          Get Started
        </Link>
      </div>
      <LandingFooter />
    </div>
  );
}

export default LandingPage;
