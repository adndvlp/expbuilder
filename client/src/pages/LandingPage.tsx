import { Link } from "react-router-dom";
import {
  FaGithub,
  FaLinkedin,
  FaEnvelope,
  FaHeart,
  FaCodeBranch,
} from "react-icons/fa";
import logo from "../../../icon/icon.png";
import unamLogo from "../assets/unam.svg";
// @ts-ignore
import fpLogo from "../assets/fp white.png";
// @ts-ignore
import labLogo from "../assets/lab.png";

function LandingPage() {
  const openLink = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    // @ts-ignore
    if (window.electron && window.electron.openExternal) {
      // @ts-ignore
      window.electron.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

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
          <div>
            <div style={{ marginBottom: "8px" }}>
              <img
                className="logo-img"
                alt="Logo"
                style={{ width: 120, height: 120, objectFit: "contain" }}
              />
            </div>
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
          onMouseOver={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "#b7950b";
            (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background =
              "linear-gradient(90deg,#d4af37,#f1c40f)";
            (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
          }}
        >
          Get Started
        </Link>
      </div>

      <footer
        style={{
          marginTop: "auto",
          width: "100%",
          padding: "40px 60px",
          background: "rgba(10, 25, 41, 0.8)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -20px 40px rgba(0,0,0,0.2)",
          color: "#b0bec5",
          textAlign: "left",
          fontSize: "14px",
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "40px",
          }}
        >
          {/* Contact */}
          <div style={{ flex: "0 1 auto", minWidth: "200px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                marginBottom: "20px",
                fontSize: "16px",
                fontWeight: 700,
                borderBottom: "2px solid #d4af37",
                display: "inline-block",
                paddingBottom: "6px",
              }}
            >
              Developer Contact
            </h4>
            <p style={{ marginBottom: "8px", opacity: 0.8 }}>
              Andrés Pacheco Fabián
            </p>
            <div style={{ display: "flex", gap: "12px", fontSize: "20px" }}>
              <a
                href="https://github.com/adndvlp"
                onClick={(e) => openLink(e, "https://github.com/adndvlp")}
                title="GitHub Profile"
                style={{ color: "#fff", transition: "color 0.2s" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#d4af37")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#fff")}
              >
                <FaGithub />
              </a>
              <a
                href="https://www.linkedin.com/in/andpacheco/"
                onClick={(e) =>
                  openLink(e, "https://www.linkedin.com/in/andpacheco/")
                }
                title="LinkedIn Profile"
                style={{ color: "#fff", transition: "color 0.2s" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#d4af37")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#fff")}
              >
                <FaLinkedin />
              </a>
              <a
                href="mailto:andngdv.lpr@gmail.com"
                onClick={(e) => openLink(e, "mailto:andngdv.lpr@gmail.com")}
                title="Email Me"
                style={{ color: "#fff", transition: "color 0.2s" }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#d4af37")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#fff")}
              >
                <FaEnvelope />
              </a>
            </div>
            <a
              href="https://github.com/adndvlp/expbuilder"
              onClick={(e) =>
                openLink(e, "https://github.com/adndvlp/expbuilder")
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "16px",
                color: "#d4af37",
                textDecoration: "none",
                fontSize: "13px",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.textDecoration = "underline")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.textDecoration = "none")
              }
            >
              <FaCodeBranch /> View Project Repo
            </a>
          </div>
          {/* Institutional Home */}
          <div style={{ flex: "0 1 auto", minWidth: "200px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                marginBottom: "20px",
                fontSize: "16px",
                fontWeight: 700,
                borderBottom: "2px solid #d4af37",
                display: "inline-block",
                paddingBottom: "6px",
              }}
            >
              Institutional Home
            </h4>

            {/* Logo Links */}
            <div
              style={{
                marginTop: "8px",
                display: "flex",
                gap: "24px",
                alignItems: "center",
              }}
            >
              <a
                href="https://www.unam.mx/"
                onClick={(e) => openLink(e, "https://www.unam.mx/")}
                title="Universidad Nacional Autónoma de México"
                style={{ transition: "opacity 0.2s", opacity: 0.8 }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
              >
                <img
                  src={unamLogo}
                  alt="UNAM"
                  style={{
                    height: 50,
                    width: "auto",
                    filter: "brightness(0) invert(1)",
                  }}
                />
              </a>

              <a
                href="https://www.psicologia.unam.mx/"
                onClick={(e) => openLink(e, "https://www.psicologia.unam.mx/")}
                title="Facultad de Psicología"
                style={{ transition: "opacity 0.2s", opacity: 0.8 }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
              >
                <img
                  src={fpLogo}
                  alt="Facultad de Psicología"
                  style={{ height: 50, width: "auto" }}
                />
              </a>

              <a
                href="https://www.labpsicolinguistica.psicol.unam.mx/"
                onClick={(e) =>
                  openLink(e, "https://www.labpsicolinguistica.psicol.unam.mx/")
                }
                title="Laboratorio de Psicolingüística"
                style={{ transition: "opacity 0.2s", opacity: 0.8 }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseOut={(e) => (e.currentTarget.style.opacity = "0.8")}
              >
                <img
                  src={labLogo}
                  alt="Laboratorio de Psicolingüística"
                  style={{ height: 50, width: "auto" }}
                />
              </a>
            </div>
          </div>

          {/* Support */}
          <div style={{ flex: "0 1 auto", minWidth: "200px" }}>
            <h4
              style={{
                color: "#e0e0e0",
                marginBottom: "20px",
                fontSize: "16px",
                fontWeight: 700,
                borderBottom: "2px solid #d4af37",
                display: "inline-block",
                paddingBottom: "6px",
              }}
            >
              Support Us
            </h4>
            <p style={{ marginBottom: "12px", opacity: 0.8 }}>
              Help us maintain these tools for open science.
            </p>
            <a
              href="https://opencollective.com/"
              onClick={(e) => openLink(e, "https://opencollective.com/")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                border: "1px solid #d4af37",
                borderRadius: "6px",
                color: "#d4af37",
                textDecoration: "none",
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#d4af37";
                e.currentTarget.style.color = "#0a1929";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#d4af37";
              }}
            >
              <FaHeart /> Donate on Open Collective
            </a>
          </div>

          {/* Brand Col */}
          <div style={{ flex: "0 1 auto", minWidth: "200px" }}>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 800,
                marginBottom: "16px",
                background: "linear-gradient(to right, #fff, #d4af37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ExpBuilder
            </div>
            <p style={{ marginBottom: "8px", opacity: 0.8 }}>
              &copy; {new Date().getFullYear()} Laboratorio de Psicolingüística,
              Fac. Psicología, UNAM.
            </p>
            <p style={{ opacity: 0.6, fontSize: "12px" }}>
              Open Source Project under MIT License.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
