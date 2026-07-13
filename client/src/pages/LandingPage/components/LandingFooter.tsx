import {
  FaCodeBranch,
  FaEnvelope,
  FaGithub,
  FaHeart,
  FaLinkedin,
} from "react-icons/fa";
import unamLogo from "../../../assets/unam.svg";

function openLink(event: React.MouseEvent<HTMLAnchorElement>, url: string) {
  event.preventDefault();
  const electron = window.electron;
  if (electron?.openExternal) {
    electron.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}

const headingStyle = {
  color: "#e0e0e0",
  marginBottom: "20px",
  fontSize: "16px",
  fontWeight: 700,
  borderBottom: "2px solid #d4af37",
  display: "inline-block",
  paddingBottom: "6px",
} as const;

export function LandingFooter() {
  return (
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

        <div
          style={{ flex: "0 1 auto", minWidth: "200px", textAlign: "center" }}
        >
          <h4 style={headingStyle}>Institutional Home</h4>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              gap: "24px",
              justifyContent: "center",
            }}
          >
            <a
              href="https://www.unam.mx/"
              onClick={(event) => openLink(event, "https://www.unam.mx/")}
              title="Universidad Nacional Autónoma de México"
              style={{ transition: "opacity 0.2s", opacity: 0.8 }}
              onMouseOver={(event) => (event.currentTarget.style.opacity = "1")}
              onMouseOut={(event) =>
                (event.currentTarget.style.opacity = "0.8")
              }
            >
              <img
                src={unamLogo}
                alt="UNAM"
                style={{
                  height: 80,
                  width: "auto",
                  filter: "brightness(0) invert(1)",
                }}
              />
            </a>
          </div>
        </div>

        <div style={{ flex: "0 1 auto", minWidth: "200px" }}>
          <h4 style={headingStyle}>Support Us</h4>
          <p style={{ marginBottom: "12px", opacity: 0.8 }}>
            Help us maintain these tools for open science.
          </p>
          <a
            href="https://opencollective.com/"
            onClick={(event) => openLink(event, "https://opencollective.com/")}
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
            onMouseOver={(event) => {
              event.currentTarget.style.backgroundColor = "#d4af37";
              event.currentTarget.style.color = "#0a1929";
            }}
            onMouseOut={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
              event.currentTarget.style.color = "#d4af37";
            }}
          >
            <FaHeart /> Donate on Open Collective
          </a>
        </div>

        <div style={{ flex: "0 1 auto", minWidth: "200px" }}>
          <h4 style={headingStyle}>Developer Contact</h4>
          <p style={{ marginBottom: "8px", opacity: 0.8 }}>
            Andrés Pacheco Fabián
          </p>
          <div style={{ display: "flex", gap: "12px", fontSize: "20px" }}>
            <SocialLink
              href="https://github.com/adndvlp"
              title="GitHub Profile"
            >
              <FaGithub />
            </SocialLink>
            <SocialLink
              href="https://www.linkedin.com/in/andpacheco/"
              title="LinkedIn Profile"
            >
              <FaLinkedin />
            </SocialLink>
            <SocialLink href="mailto:andngdv.lpr@gmail.com" title="Email Me">
              <FaEnvelope />
            </SocialLink>
          </div>
          <a
            href="https://github.com/adndvlp/expbuilder"
            onClick={(event) =>
              openLink(event, "https://github.com/adndvlp/expbuilder")
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
            onMouseOver={(event) =>
              (event.currentTarget.style.textDecoration = "underline")
            }
            onMouseOut={(event) =>
              (event.currentTarget.style.textDecoration = "none")
            }
          >
            <FaCodeBranch /> View Project Repo
          </a>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={(event) => openLink(event, href)}
      title={title}
      style={{ color: "#fff", transition: "color 0.2s" }}
      onMouseOver={(event) => (event.currentTarget.style.color = "#d4af37")}
      onMouseOut={(event) => (event.currentTarget.style.color = "#fff")}
    >
      {children}
    </a>
  );
}
