import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

type ExperimentSettingsProps = {
  experimentID: string | undefined;
};

type BatchConfig = {
  useIndexedDB: boolean;
  batchSize: number;
  resumeTimeoutMinutes: number;
};

type RecruitmentPlatform = "none" | "prolific" | "mturk";

type RecruitmentConfig = {
  platform: RecruitmentPlatform;
  prolificCompletionCode: string;
};

type CaptchaProvider = "hcaptcha" | "recaptcha";

type CaptchaConfig = {
  enabled: boolean;
  provider: CaptchaProvider;
  siteKey: string;
};

function ExperimentSettings({ experimentID }: ExperimentSettingsProps) {
  const [config, setConfig] = useState<BatchConfig>({
    useIndexedDB: true,
    batchSize: 0,
    resumeTimeoutMinutes: 30,
  });
  const [recruitmentConfig, setRecruitmentConfig] = useState<RecruitmentConfig>(
    {
      platform: "none",
      prolificCompletionCode: "",
    },
  );
  const [captchaConfig, setCaptchaConfig] = useState<CaptchaConfig>({
    enabled: false,
    provider: "hcaptcha",
    siteKey: "",
  });
  const [experimentExists, setExperimentExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!experimentID) return;

    const loadConfig = async () => {
      try {
        const docRef = doc(db, "experiments", experimentID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setExperimentExists(true);
          const data = docSnap.data();
          setConfig({
            useIndexedDB: data.batchConfig?.useIndexedDB ?? true,
            batchSize: data.batchConfig?.batchSize ?? 0,
            resumeTimeoutMinutes: data.batchConfig?.resumeTimeoutMinutes ?? 30,
          });
          setRecruitmentConfig({
            platform: data.recruitmentConfig?.platform ?? "none",
            prolificCompletionCode:
              data.recruitmentConfig?.prolificCompletionCode ?? "",
          });
          setCaptchaConfig({
            enabled: data.captchaConfig?.enabled ?? false,
            provider: data.captchaConfig?.provider ?? "hcaptcha",
            siteKey: data.captchaConfig?.siteKey ?? "",
          });
        }
      } catch (error) {
        console.error("Error loading configuration:", error);
        setMessage({ type: "error", text: "Error loading configuration" });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [experimentID]);

  const handleSave = async () => {
    if (!experimentID) return;

    setSaving(true);
    setMessage(null);

    try {
      const docRef = doc(db, "experiments", experimentID);
      await setDoc(
        docRef,
        {
          batchConfig: config,
          recruitmentConfig: recruitmentConfig,
          captchaConfig: captchaConfig,
        },
        { merge: true },
      );

      setMessage({
        type: "success",
        text: "Configuration saved successfully!",
      });
    } catch (error) {
      console.error("Error saving configuration:", error);
      setMessage({ type: "error", text: "Error saving configuration" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "var(--text-dark)" }}>Loading configuration...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 32,
        backgroundColor: "var(--neutral-light)",
        borderRadius: 12,
        border: "1px solid var(--neutral-mid)",
      }}
    >
      <h2 style={{ color: "var(--text-dark)", marginBottom: 24, fontSize: 24 }}>
        Experiment Data Configuration
      </h2>

      {/* IndexedDB Setting — only shown when experiment is published */}
      {!experimentExists && (
        <div
          style={{
            padding: 12,
            marginBottom: 24,
            backgroundColor: "var(--neutral-mid)",
            borderRadius: 6,
            fontSize: 14,
            color: "var(--text-dark)",
            opacity: 0.8,
          }}
        >
          Data configuration options are available after the experiment is
          published.
        </div>
      )}

      {/* IndexedDB Setting */}
      {experimentExists && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              id="useIndexedDB"
              checked={config.useIndexedDB}
              onChange={(e) =>
                setConfig({ ...config, useIndexedDB: e.target.checked })
              }
              style={{ width: 20, height: 20, cursor: "pointer" }}
            />
            <label
              htmlFor="useIndexedDB"
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "var(--text-dark)",
                cursor: "pointer",
              }}
            >
              Use IndexedDB (Client-side persistence)
            </label>
          </div>
          <p
            style={{
              marginLeft: 32,
              marginTop: 8,
              color: "var(--text-dark)",
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            When enabled, trial data is stored in the participant's browser for
            offline resilience. Disable for maximum data confidentiality (trials
            sent directly to Firestore).
          </p>
        </div>
      )}

      {/* Batch Size Setting */}
      {experimentExists && (
        <div style={{ marginBottom: 32 }}>
          <label
            htmlFor="batchSize"
            style={{
              display: "block",
              fontSize: 16,
              fontWeight: "600",
              color: "var(--text-dark)",
              marginBottom: 8,
            }}
          >
            Batch Size
          </label>
          <input
            type="number"
            id="batchSize"
            min="0"
            value={config.batchSize}
            onChange={(e) =>
              setConfig({ ...config, batchSize: parseInt(e.target.value) || 0 })
            }
            style={{
              padding: 12,
              fontSize: 16,
              border: "2px solid var(--neutral-mid)",
              borderRadius: 6,
              width: "200px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
            disabled={!config.useIndexedDB}
          />
          <p
            style={{
              marginTop: 8,
              color: "var(--text-dark)",
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            <strong>0</strong>: Send all trials at the end (no batching)
            <br />
            <strong>&gt; 0</strong>: Send trials in batches of N (e.g., 10 =
            batch every 10 trials)
            <br />
            {!config.useIndexedDB && (
              <em>(Only available with IndexedDB enabled)</em>
            )}
          </p>
        </div>
      )}

      {/* Resume Timeout Setting */}
      {experimentExists && (
        <div style={{ marginBottom: 32 }}>
          <label
            htmlFor="resumeTimeout"
            style={{
              display: "block",
              fontSize: 16,
              fontWeight: "600",
              color: "var(--text-dark)",
              marginBottom: 8,
            }}
          >
            Resume Timeout (minutes)
          </label>
          <input
            type="number"
            id="resumeTimeout"
            min="1"
            max="1440"
            value={config.resumeTimeoutMinutes}
            onChange={(e) =>
              setConfig({
                ...config,
                resumeTimeoutMinutes: parseInt(e.target.value) || 30,
              })
            }
            style={{
              padding: 12,
              fontSize: 16,
              border: "2px solid var(--neutral-mid)",
              borderRadius: 6,
              width: "200px",
              backgroundColor: "var(--neutral-light)",
              color: "var(--text-dark)",
            }}
          />
          <p
            style={{
              marginTop: 8,
              color: "var(--text-dark)",
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            Time before disconnected session data is deleted (1-1440 minutes)
          </p>
        </div>
      )}

      {/* Storage Behavior Info */}
      {experimentExists && (
        <div
          style={{
            padding: 16,
            backgroundColor: "var(--primary-blue)",
            border: `4px solid var(--dark-blue)`,
            borderRadius: 6,
            marginBottom: 24,
            opacity: 0.9,
          }}
        >
          <h3
            style={{
              color: "var(--text-light)",
              marginBottom: 12,
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            Storage Behavior Summary
          </h3>
          <ul
            style={{
              color: "var(--text-light)",
              fontSize: 14,
              lineHeight: 1.8,
              paddingLeft: 20,
            }}
          >
            {config.useIndexedDB ? (
              <>
                <li>
                  <strong>IndexedDB enabled:</strong> Trials cached locally
                  {config.batchSize === 0
                    ? ", sent all at once when experiment completes"
                    : ` in batches of ${config.batchSize} trials`}
                </li>
                <li>
                  Participants can reconnect within{" "}
                  {config.resumeTimeoutMinutes} minutes
                </li>
              </>
            ) : (
              <>
                <li>
                  <strong>IndexedDB disabled:</strong> Trials sent individually
                  to Firestore
                </li>
                <li>
                  <strong>Google Drive/Dropbox:</strong> Partial save on
                  disconnect, append on completion
                </li>
                <li>
                  <strong>OSF:</strong> Complete save only after timeout or
                  completion (no PATCH support)
                </li>
              </>
            )}
          </ul>
        </div>
      )}

      {/* Recruitment Platform Setting */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{ color: "var(--text-dark)", marginBottom: 24, fontSize: 24 }}
        >
          Recruitment Platform
        </h2>

        {/* Platform selector */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {(["none", "prolific", "mturk"] as RecruitmentPlatform[]).map((p) => (
            <button
              key={p}
              onClick={() =>
                setRecruitmentConfig({ ...recruitmentConfig, platform: p })
              }
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "2px solid",
                borderColor:
                  recruitmentConfig.platform === p
                    ? "var(--primary-blue)"
                    : "var(--neutral-mid)",
                backgroundColor:
                  recruitmentConfig.platform === p
                    ? "var(--primary-blue)"
                    : "transparent",
                color:
                  recruitmentConfig.platform === p
                    ? "var(--text-light)"
                    : "var(--text-dark)",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {p === "none" ? "None" : p === "prolific" ? "Prolific" : "MTurk"}
            </button>
          ))}
        </div>

        {/* Prolific options */}
        {recruitmentConfig.platform === "prolific" && (
          <div
            style={{
              padding: 16,
              border: "1px solid var(--neutral-mid)",
              borderRadius: 8,
              marginTop: 12,
            }}
          >
            <p
              style={{
                color: "var(--text-dark)",
                fontSize: 14,
                marginBottom: 12,
                opacity: 0.8,
              }}
            >
              Prolific will append <code>?PROLIFIC_PID=...</code>&amp;
              <code>STUDY_ID=...</code>&amp;<code>SESSION_ID=...</code> to your
              experiment URL automatically. Paste the{" "}
              <strong>completion code</strong> provided by Prolific when
              creating their study.
            </p>
            <label
              htmlFor="prolificCode"
              style={{
                display: "block",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text-dark)",
                marginBottom: 6,
              }}
            >
              Prolific Completion Code
            </label>
            <input
              id="prolificCode"
              type="text"
              placeholder="e.g. C1A2B3C4"
              value={recruitmentConfig.prolificCompletionCode}
              onChange={(e) =>
                setRecruitmentConfig({
                  ...recruitmentConfig,
                  prolificCompletionCode: e.target.value,
                })
              }
              style={{
                padding: 10,
                fontSize: 15,
                border: "2px solid var(--neutral-mid)",
                borderRadius: 6,
                width: "280px",
                backgroundColor: "var(--neutral-light)",
                color: "var(--text-dark)",
              }}
            />
            <p
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "var(--text-dark)",
                opacity: 0.7,
              }}
            >
              On <code>on_finish</code>, participants will be redirected to{" "}
              <code>
                https://app.prolific.com/submissions/complete?cc=&#123;code&#125;
              </code>
            </p>
          </div>
        )}

        {/* MTurk info */}
        {recruitmentConfig.platform === "mturk" && (
          <div
            style={{
              padding: 16,
              border: "1px solid var(--neutral-mid)",
              borderRadius: 8,
              marginTop: 12,
            }}
          >
            <p
              style={{ color: "var(--text-dark)", fontSize: 14, opacity: 0.8 }}
            >
              MTurk will append <code>?workerId=...</code>&amp;
              <code>assignmentId=...</code>&amp;
              <code>hitId=...</code>&amp;<code>turkSubmitTo=...</code> to your
              experiment URL when loading it inside a HIT. On{" "}
              <code>on_finish</code>, a form will be submitted to Amazon
              automatically. If{" "}
              <code>assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE</code> (preview
              mode), the experiment will show a message instead of starting.
            </p>
          </div>
        )}
      </div>

      {/* CAPTCHA / Web3Forms Setting */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}
        >
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
            checked={captchaConfig.enabled}
            onChange={(e) =>
              setCaptchaConfig({ ...captchaConfig, enabled: e.target.checked })
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

        {captchaConfig.enabled && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              marginTop: 4,
            }}
          >
            {/* Provider selector */}
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
                {(["hcaptcha", "recaptcha"] as CaptchaProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      setCaptchaConfig({ ...captchaConfig, provider: p })
                    }
                    style={{
                      padding: "7px 18px",
                      borderRadius: 6,
                      border: "2px solid",
                      borderColor:
                        captchaConfig.provider === p
                          ? "var(--primary-blue)"
                          : "var(--neutral-mid)",
                      backgroundColor:
                        captchaConfig.provider === p
                          ? "var(--primary-blue)"
                          : "transparent",
                      color:
                        captchaConfig.provider === p
                          ? "var(--text-light)"
                          : "var(--text-dark)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {p === "hcaptcha" ? "hCaptcha" : "reCAPTCHA v2"}
                  </button>
                ))}
              </div>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--text-dark)",
                  opacity: 0.65,
                }}
              >
                {captchaConfig.provider === "hcaptcha"
                  ? "Get your keys at hcaptcha.com → Sites"
                  : 'Get your keys at google.com/recaptcha → Admin Console (v2 "I am not a robot")'}
              </p>
            </div>

            {/* Site Key */}
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
                  captchaConfig.provider === "hcaptcha"
                    ? "e.g. d2263a2a-7d46-48c8-b490-c50812a6c80e"
                    : "e.g. 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                }
                value={captchaConfig.siteKey}
                onChange={(e) =>
                  setCaptchaConfig({
                    ...captchaConfig,
                    siteKey: e.target.value,
                  })
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

      {/* Save Button */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="gradient-btn"
          style={{
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>

        {message && (
          <p
            style={{
              color: message.type === "success" ? "#4caf50" : "#f44336",
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default ExperimentSettings;
