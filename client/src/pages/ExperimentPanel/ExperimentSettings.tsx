import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import CustomDomainSettings from "./CustomDomainSettings";
import AppearanceSettings from "./AppearanceSettings";

const API_URL = import.meta.env.VITE_API_URL ?? "";

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

type SessionNameTokenType =
  | "date"
  | "time"
  | "randomAlpha"
  | "customText"
  | "counter";

type SessionNameToken = {
  id: string;
  type: SessionNameTokenType;
  dateFormat: string;
  timeFormat: string;
  randomLength: number;
  customValue: string;
  counterDigits: number;
};

const SESSION_TOKEN_CATALOG: Array<{
  type: SessionNameTokenType;
  label: string;
  color: string;
}> = [
  { type: "date", label: "Date", color: "#4a90d9" },
  { type: "time", label: "Time", color: "#9b6dd8" },
  { type: "randomAlpha", label: "Random ID", color: "#e67e22" },
  { type: "customText", label: "Custom Text", color: "#e74c3c" },
  { type: "counter", label: "Participant Number", color: "#16a085" },
];

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [sessionNameMessage, setSessionNameMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [sessionNameTokens, setSessionNameTokens] = useState<
    SessionNameToken[]
  >([]);
  const [sessionNameSeparator, setSessionNameSeparator] = useState("_");
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const MAX_TOKENS = 6;

  useEffect(() => {
    if (!experimentID) return;

    // Don't block the UI — set loading false immediately
    setLoading(false);

    // Load session name config from local API immediately
    fetch(`${API_URL}/api/session-name-config/${experimentID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((sn) => {
        if (sn) {
          setSessionNameTokens(sn.tokens ?? []);
          setSessionNameSeparator(sn.separator ?? "_");
        }
      })
      .catch(() => {});

    // Load Firebase config in background — only used when experiment is published
    const docRef = doc(db, "experiments", experimentID);
    getDoc(docRef)
      .then((docSnap) => {
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
      })
      .catch((error) => {
        console.error("Error loading Firebase configuration:", error);
      });
  }, [experimentID]);

  function makeSessionToken(type: SessionNameTokenType): SessionNameToken {
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type,
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH-mm-ss",
      randomLength: 6,
      customValue: "",
      counterDigits: 3,
    };
  }

  function previewToken(token: SessionNameToken): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = now.getFullYear();
    const mo = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const h = pad(now.getHours());
    const mi = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    switch (token.type) {
      case "date":
        if (token.dateFormat === "YYYYMMDD") return `${y}${mo}${d}`;
        if (token.dateFormat === "DD-MM-YYYY") return `${d}-${mo}-${y}`;
        if (token.dateFormat === "MM-DD-YYYY") return `${mo}-${d}-${y}`;
        return `${y}-${mo}-${d}`;
      case "time":
        if (token.timeFormat === "HH-mm") return `${h}-${mi}`;
        if (token.timeFormat === "HHmmss") return `${h}${mi}${s}`;
        return `${h}-${mi}-${s}`;
      case "randomAlpha": {
        const chars = "aB3k9pQxmN4t7ZvE";
        return Array.from(
          { length: token.randomLength },
          (_, i) => chars[i % chars.length],
        ).join("");
      }
      case "customText":
        return token.customValue || "text";
      case "counter":
        return "1".padStart(token.counterDigits, "0");
      default:
        return "";
    }
  }

  const addSessionToken = (type: SessionNameTokenType) => {
    setSessionNameTokens((prev) =>
      prev.length >= MAX_TOKENS ? prev : [...prev, makeSessionToken(type)],
    );
  };

  const removeSessionToken = (id: string) => {
    setSessionNameTokens((prev) => prev.filter((t) => t.id !== id));
    if (expandedTokenId === id) setExpandedTokenId(null);
  };

  const reorderSessionToken = (from: number, to: number) => {
    if (from === to) return;
    setSessionNameTokens((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const updateSessionToken = (id: string, patch: Partial<SessionNameToken>) => {
    setSessionNameTokens((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const sessionNamePreview = sessionNameTokens
    .map((t) => previewToken(t))
    .join(sessionNameSeparator);

  const handleSaveSessionName = async () => {
    if (!experimentID) return;
    // Require at least one randomAlpha token when a custom name is configured
    if (
      sessionNameTokens.length > 0 &&
      !sessionNameTokens.some(
        (t) => t.type === "randomAlpha" || t.type === "counter",
      )
    ) {
      setSessionNameMessage({
        type: "error",
        text: "Debes incluir al menos un componente Random ID o Participant Number para garantizar sesiones únicas.",
      });
      return;
    }
    setSaving(true);
    setSessionNameMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/session-name-config/${experimentID}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokens: sessionNameTokens,
            separator: sessionNameSeparator,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save");
      setSessionNameMessage({
        type: "success",
        text: "Session name configuration saved!",
      });
    } catch {
      setSessionNameMessage({
        type: "error",
        text: "Error saving session name configuration",
      });
    } finally {
      setSaving(false);
    }
  };

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

      // Save session name config to local API (local-only for now)
      await fetch(`${API_URL}/api/session-name-config/${experimentID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: sessionNameTokens,
          separator: sessionNameSeparator,
        }),
      });

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

      {/* Session Name Configuration */}
      <div style={{ marginBottom: 32, marginTop: 8 }}>
        <h2
          style={{ color: "var(--text-dark)", marginBottom: 8, fontSize: 24 }}
        >
          Session Name Configuration
        </h2>
        <p
          style={{
            color: "var(--text-dark)",
            fontSize: 14,
            opacity: 0.8,
            marginBottom: 20,
          }}
        >
          Define how session names are automatically composed for each
          participant run.
        </p>

        {/* Available Components */}
        <div style={{ marginBottom: 20 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-dark)",
              opacity: 0.55,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Available Components
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SESSION_TOKEN_CATALOG.map((cat) => (
              <button
                key={cat.type}
                onClick={() => addSessionToken(cat.type)}
                disabled={sessionNameTokens.length >= MAX_TOKENS}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `2px solid ${cat.color}33`,
                  backgroundColor:
                    sessionNameTokens.length >= MAX_TOKENS
                      ? "var(--neutral-medium)"
                      : `${cat.color}15`,
                  color:
                    sessionNameTokens.length >= MAX_TOKENS
                      ? "var(--text-dark)"
                      : cat.color,
                  opacity: sessionNameTokens.length >= MAX_TOKENS ? 0.4 : 1,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor:
                    sessionNameTokens.length >= MAX_TOKENS
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                + {cat.label}
              </button>
            ))}
            {sessionNameTokens.length >= MAX_TOKENS && (
              <span
                style={{
                  alignSelf: "center",
                  fontSize: 12,
                  color: "var(--text-dark)",
                  opacity: 0.5,
                }}
              >
                Límite de {MAX_TOKENS} componentes alcanzado
              </span>
            )}
          </div>
        </div>

        {/* Formula builder */}
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-dark)",
              opacity: 0.55,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Name Formula
          </p>
          <div
            style={{
              minHeight: 60,
              padding: 12,
              border: "2px dashed var(--neutral-mid)",
              borderRadius: 8,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              backgroundColor: "var(--neutral-light)",
            }}
          >
            {sessionNameTokens.length === 0 ? (
              <p
                style={{
                  width: "100%",
                  textAlign: "center",
                  color: "var(--text-dark)",
                  opacity: 0.35,
                  fontSize: 14,
                  margin: 0,
                }}
              >
                Add components above to build the session name
              </p>
            ) : (
              (() => {
                const items: React.ReactElement[] = [];
                sessionNameTokens.forEach((token, idx) => {
                  const meta = SESSION_TOKEN_CATALOG.find(
                    (c) => c.type === token.type,
                  )!;
                  const isDragging = dragIndex === idx;
                  const isOver = dragOverIndex === idx;
                  items.push(
                    <div
                      key={token.id}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(idx);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnter={() => setDragOverIndex(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null)
                          reorderSessionToken(dragIndex, idx);
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        borderRadius: 20,
                        backgroundColor: `${meta.color}18`,
                        border: `2px solid ${isOver && !isDragging ? meta.color : `${meta.color}44`}`,
                        color: meta.color,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "grab",
                        opacity: isDragging ? 0.35 : 1,
                        transition: "opacity 0.15s, border-color 0.15s",
                      }}
                    >
                      <span
                        onClick={() =>
                          setExpandedTokenId(
                            expandedTokenId === token.id ? null : token.id,
                          )
                        }
                        style={{ cursor: "pointer", userSelect: "none" }}
                      >
                        {meta.label}
                      </span>
                      <button
                        onClick={() =>
                          setExpandedTokenId(
                            expandedTokenId === token.id ? null : token.id,
                          )
                        }
                        title="Options"
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: meta.color,
                          opacity: expandedTokenId === token.id ? 1 : 0.6,
                          padding: "0 2px",
                          fontSize: 14,
                        }}
                      ></button>
                      <button
                        onClick={() => removeSessionToken(token.id)}
                        title="Remove"
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: meta.color,
                          opacity: 0.7,
                          padding: "0 2px",
                          fontSize: 16,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>,
                  );
                  if (idx < sessionNameTokens.length - 1) {
                    items.push(
                      <span
                        key={`sep-${idx}`}
                        style={{
                          color: "var(--text-dark)",
                          opacity: 0.45,
                          fontSize: 13,
                          fontFamily: "monospace",
                          userSelect: "none",
                          pointerEvents: "none",
                        }}
                      >
                        {sessionNameSeparator === ""
                          ? "·"
                          : sessionNameSeparator}
                      </span>,
                    );
                  }
                });
                return items;
              })()
            )}
          </div>
        </div>

        {/* Separator selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-dark)",
              opacity: 0.8,
            }}
          >
            Separator:
          </span>
          {[
            { label: "_ underscore", value: "_" },
            { label: "- hyphen", value: "-" },
            { label: "none", value: "" },
          ].map((sep) => (
            <button
              key={sep.value === "" ? "none" : sep.value}
              onClick={() => setSessionNameSeparator(sep.value)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "2px solid",
                borderColor:
                  sessionNameSeparator === sep.value
                    ? "var(--primary-blue)"
                    : "var(--neutral-mid)",
                backgroundColor:
                  sessionNameSeparator === sep.value
                    ? "var(--primary-blue)"
                    : "transparent",
                color:
                  sessionNameSeparator === sep.value
                    ? "var(--text-light)"
                    : "var(--text-dark)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: sep.value !== "" ? "monospace" : "inherit",
              }}
            >
              {sep.label}
            </button>
          ))}
        </div>

        {/* Token options panel */}
        {expandedTokenId &&
          (() => {
            const token = sessionNameTokens.find(
              (t) => t.id === expandedTokenId,
            );
            if (!token) return null;
            const meta = SESSION_TOKEN_CATALOG.find(
              (c) => c.type === token.type,
            )!;
            return (
              <div
                style={{
                  padding: 16,
                  marginBottom: 16,
                  border: `2px solid ${meta.color}44`,
                  borderRadius: 8,
                  backgroundColor: `${meta.color}08`,
                }}
              >
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: meta.color,
                    marginBottom: 12,
                  }}
                >
                  {meta.label} options
                </p>

                {token.type === "date" && (
                  <div>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-dark)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Date format
                    </label>
                    <select
                      value={token.dateFormat}
                      onChange={(e) =>
                        updateSessionToken(token.id, {
                          dateFormat: e.target.value,
                        })
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "2px solid var(--neutral-mid)",
                        backgroundColor: "var(--neutral-light)",
                        color: "var(--text-dark)",
                        fontSize: 14,
                      }}
                    >
                      <option value="YYYY-MM-DD">
                        YYYY-MM-DD (e.g. 2026-04-09)
                      </option>
                      <option value="DD-MM-YYYY">
                        DD-MM-YYYY (e.g. 09-04-2026)
                      </option>
                      <option value="MM-DD-YYYY">
                        MM-DD-YYYY (e.g. 04-09-2026)
                      </option>
                      <option value="YYYYMMDD">YYYYMMDD (e.g. 20260409)</option>
                    </select>
                  </div>
                )}

                {token.type === "time" && (
                  <div>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-dark)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Time format
                    </label>
                    <select
                      value={token.timeFormat}
                      onChange={(e) =>
                        updateSessionToken(token.id, {
                          timeFormat: e.target.value,
                        })
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "2px solid var(--neutral-mid)",
                        backgroundColor: "var(--neutral-light)",
                        color: "var(--text-dark)",
                        fontSize: 14,
                      }}
                    >
                      <option value="HH-mm">HH-mm (e.g. 14-35)</option>
                      <option value="HH-mm-ss">HH-mm-ss (e.g. 14-35-22)</option>
                      <option value="HHmmss">HHmmss (e.g. 143522)</option>
                    </select>
                  </div>
                )}

                {token.type === "randomAlpha" && (
                  <div>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-dark)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Length
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <input
                        type="range"
                        min={4}
                        max={16}
                        value={token.randomLength}
                        onChange={(e) =>
                          updateSessionToken(token.id, {
                            randomLength: Number(e.target.value),
                          })
                        }
                        style={{ width: 160 }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--text-dark)",
                          fontFamily: "monospace",
                          fontWeight: 600,
                        }}
                      >
                        {token.randomLength} chars
                      </span>
                    </div>
                  </div>
                )}

                {token.type === "customText" && (
                  <div>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-dark)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Text value
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. pilot, exp1, …"
                      value={token.customValue}
                      onChange={(e) =>
                        updateSessionToken(token.id, {
                          customValue: e.target.value,
                        })
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "2px solid var(--neutral-mid)",
                        backgroundColor: "var(--neutral-light)",
                        color: "var(--text-dark)",
                        fontSize: 14,
                        width: 220,
                      }}
                    />
                  </div>
                )}

                {token.type === "counter" && (
                  <div>
                    <label
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-dark)",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Number of digits
                    </label>
                    <select
                      value={token.counterDigits}
                      onChange={(e) =>
                        updateSessionToken(token.id, {
                          counterDigits: Number(e.target.value),
                        })
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "2px solid var(--neutral-mid)",
                        backgroundColor: "var(--neutral-light)",
                        color: "var(--text-dark)",
                        fontSize: 14,
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} digit{n > 1 ? "s" : ""} (e.g. {"0".repeat(n - 1)}
                          1)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })()}

        {/* Preview */}
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-dark)",
              opacity: 0.55,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Preview
          </p>
          <div
            style={{
              padding: "10px 18px",
              backgroundColor: "#1a1a2e",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 15,
              color: sessionNamePreview ? "#a6e3a1" : "#6c7086",
              letterSpacing: "0.05em",
              display: "inline-block",
              minWidth: 260,
            }}
          >
            {sessionNamePreview || "add components to see a preview"}
          </div>
        </div>

        {/* Save session name button — always visible, no Firebase required */}
        {sessionNameTokens.length > 0 &&
          !sessionNameTokens.some(
            (t) => t.type === "randomAlpha" || t.type === "counter",
          ) && (
            <div
              style={{
                padding: "10px 14px",
                marginTop: 12,
                backgroundColor: "#f39c1220",
                border: "1px solid #f39c12",
                borderRadius: 6,
                fontSize: 13,
                color: "#f39c12",
                fontWeight: 600,
              }}
            >
              Debes incluir al menos un componente <strong>Random ID</strong> o{" "}
              <strong>Participant Number</strong> para garantizar que cada
              sesión sea única.
            </div>
          )}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginTop: 16,
          }}
        >
          <button
            onClick={handleSaveSessionName}
            disabled={saving}
            className="gradient-btn"
            style={{
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Session Name"}
          </button>
          {sessionNameMessage && (
            <p
              style={{
                color:
                  sessionNameMessage.type === "success" ? "#4caf50" : "#f44336",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {sessionNameMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* Recruitment Platform Setting */}
      {experimentExists && (
        <div style={{ marginBottom: 32 }}>
          <h2
            style={{
              color: "var(--text-dark)",
              marginBottom: 24,
              fontSize: 24,
            }}
          >
            Recruitment Platform
          </h2>

          {/* Platform selector */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {(["none", "prolific", "mturk"] as RecruitmentPlatform[]).map(
              (p) => (
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
                  {p === "none"
                    ? "None"
                    : p === "prolific"
                      ? "Prolific"
                      : "MTurk"}
                </button>
              ),
            )}
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
                <code>STUDY_ID=...</code>&amp;<code>SESSION_ID=...</code> to
                your experiment URL automatically. Paste the{" "}
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
                style={{
                  color: "var(--text-dark)",
                  fontSize: 14,
                  opacity: 0.8,
                }}
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
      )}

      {/* CAPTCHA / Web3Forms Setting */}
      {experimentExists && (
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
                setCaptchaConfig({
                  ...captchaConfig,
                  enabled: e.target.checked,
                })
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
      )}
      {/* Save Button */}
      {experimentExists && (
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
      )}

      {/* Experiment Appearance */}
      <AppearanceSettings experimentID={experimentID} />

      {/* Custom Tunnel Domain */}
      <CustomDomainSettings experimentID={experimentID} />
    </div>
  );
}

export default ExperimentSettings;
