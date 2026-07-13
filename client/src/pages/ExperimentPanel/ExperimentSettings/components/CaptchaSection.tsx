import type { Dispatch, SetStateAction } from "react";
import type { CaptchaConfig, CaptchaProvider } from "../types";

interface CaptchaSectionProps {
  config: CaptchaConfig;
  setConfig: Dispatch<SetStateAction<CaptchaConfig>>;
}

export function CaptchaSection({ config, setConfig }: CaptchaSectionProps) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}>
        Anti-Spam (CAPTCHA)
      </h2>
      <p
        style={{
          color: "var(--text-dark)",
          fontSize: 14,
          opacity: 0.8,
          marginBottom: 16,
        }}
      >
        Uses{" "}
        <a
          href="https://www.hcaptcha.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--primary-blue)" }}
        >
          hCaptcha
        </a>{" "}
        or{" "}
        <a
          href="https://www.google.com/recaptcha"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--primary-blue)" }}
        >
          reCAPTCHA v2
        </a>
        . Participants must pass the challenge before the experiment starts.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <input
          type="checkbox"
          id="captchaEnabled"
          checked={config.enabled}
          onChange={(event) =>
            setConfig({ ...config, enabled: event.target.checked })
          }
          style={{ width: 20, height: 20, cursor: "pointer" }}
        />
        <label
          htmlFor="captchaEnabled"
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "var(--text-dark)",
            cursor: "pointer",
          }}
        >
          Enable CAPTCHA
        </label>
      </div>

      {config.enabled && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            marginTop: 4,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-dark)",
                marginBottom: 8,
              }}
            >
              Provider
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              {(["hcaptcha", "recaptcha"] as CaptchaProvider[]).map(
                (provider) => (
                  <button
                    key={provider}
                    onClick={() => setConfig({ ...config, provider })}
                    style={{
                      padding: "7px 18px",
                      borderRadius: 6,
                      border: "2px solid",
                      borderColor:
                        config.provider === provider
                          ? "var(--primary-blue)"
                          : "var(--neutral-mid)",
                      backgroundColor:
                        config.provider === provider
                          ? "var(--primary-blue)"
                          : "transparent",
                      color:
                        config.provider === provider
                          ? "var(--text-light)"
                          : "var(--text-dark)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {provider === "hcaptcha" ? "hCaptcha" : "reCAPTCHA v2"}
                  </button>
                ),
              )}
            </div>
            <p
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "var(--text-dark)",
                opacity: 0.65,
              }}
            >
              {config.provider === "hcaptcha"
                ? "Get your keys at hcaptcha.com → Sites"
                : 'Get your keys at google.com/recaptcha → Admin Console (v2 "I am not a robot")'}
            </p>
          </div>
          <div>
            <label
              htmlFor="captchaSiteKey"
              style={{
                display: "block",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-dark)",
                marginBottom: 6,
              }}
            >
              Site Key{" "}
              <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 13 }}>
                (public — used in the browser)
              </span>
            </label>
            <input
              id="captchaSiteKey"
              type="text"
              placeholder={
                config.provider === "hcaptcha"
                  ? "e.g. d2263a2a-7d46-48c8-b490-c50812a6c80e"
                  : "e.g. 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
              }
              value={config.siteKey}
              onChange={(event) =>
                setConfig({ ...config, siteKey: event.target.value })
              }
              style={{
                padding: 10,
                fontSize: 14,
                border: "2px solid var(--neutral-mid)",
                borderRadius: 6,
                width: "380px",
                backgroundColor: "var(--neutral-light)",
                color: "var(--text-dark)",
                fontFamily: "monospace",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
