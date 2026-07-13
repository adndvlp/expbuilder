import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import type {
  BatchConfig,
  CaptchaConfig,
  RecruitmentConfig,
  SessionNameToken,
  SessionNameTokenType,
  StatusMessage,
} from "../types";
import {
  getSessionNameUniquenessError,
  makeSessionToken,
  MAX_SESSION_TOKENS,
  previewToken,
} from "../utils/sessionName";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export function useExperimentSettings(experimentID: string | undefined) {
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [sessionNameMessage, setSessionNameMessage] =
    useState<StatusMessage | null>(null);
  const [sessionNameTokens, setSessionNameTokens] = useState<
    SessionNameToken[]
  >([]);
  const [sessionNameSeparator, setSessionNameSeparator] = useState("_");

  useEffect(() => {
    if (!experimentID) return;
    fetch(`${API_URL}/api/session-name-config/${experimentID}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((sessionName) => {
        if (sessionName) {
          setSessionNameTokens(sessionName.tokens ?? []);
          setSessionNameSeparator(sessionName.separator ?? "_");
        }
      })
      .catch(() => {});

    getDoc(doc(db, "experiments", experimentID))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        setExperimentExists(true);
        const data = snapshot.data();
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
      })
      .catch((error) => {
        console.error("Error loading Firebase configuration:", error);
      });
  }, [experimentID]);

  const addSessionToken = (type: SessionNameTokenType) => {
    setSessionNameTokens((previous) =>
      /* v8 ignore next -- maxed buttons are disabled; this guards stale queued clicks. */
      previous.length >= MAX_SESSION_TOKENS
        ? previous
        : [...previous, makeSessionToken(type)],
    );
  };
  const removeSessionToken = (id: string) => {
    setSessionNameTokens((previous) =>
      previous.filter((token) => token.id !== id),
    );
  };
  const reorderSessionToken = (from: number, to: number) => {
    if (from === to) return;
    setSessionNameTokens((previous) => {
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const updateSessionToken = (id: string, patch: Partial<SessionNameToken>) => {
    setSessionNameTokens((previous) =>
      previous.map((token) =>
        token.id === id ? { ...token, ...patch } : token,
      ),
    );
  };

  const handleSaveSessionName = async () => {
    if (!experimentID) return;
    const uniquenessError = getSessionNameUniquenessError(sessionNameTokens);
    if (uniquenessError) {
      setSessionNameMessage({ type: "error", text: uniquenessError });
      return;
    }
    setSaving(true);
    setSessionNameMessage(null);
    try {
      const response = await fetch(
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
      if (!response.ok) throw new Error("Failed to save");
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
    const uniquenessError = getSessionNameUniquenessError(sessionNameTokens);
    if (uniquenessError) {
      setSessionNameMessage({ type: "error", text: uniquenessError });
      setMessage({
        type: "error",
        text: "Session name configuration is invalid.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, "experiments", experimentID),
        { batchConfig: config, recruitmentConfig, captchaConfig },
        { merge: true },
      );
      const response = await fetch(
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
      if (!response.ok) {
        throw new Error("Failed to save session name configuration");
      }
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

  return {
    config,
    setConfig,
    recruitmentConfig,
    setRecruitmentConfig,
    captchaConfig,
    setCaptchaConfig,
    experimentExists,
    saving,
    message,
    sessionNameMessage,
    sessionNameTokens,
    sessionNameSeparator,
    setSessionNameSeparator,
    sessionNamePreview: sessionNameTokens
      .map((token) => previewToken(token))
      .join(sessionNameSeparator),
    addSessionToken,
    removeSessionToken,
    reorderSessionToken,
    updateSessionToken,
    handleSaveSessionName,
    handleSave,
  };
}
