import { useEffect, useRef, useState } from "react";
import { auth } from "../../../../lib/firebase";
import {
  defaultFunctionalSettings,
  loadFunctionalSettings,
  saveFunctionalSettings,
  migrateFunctionalSettings,
  type LocalSettings,
  type SettingsMigration,
} from "../../../../lib/functionalSettings";
import type {
  BatchConfig,
  CaptchaConfig,
  RecruitmentConfig,
  SessionNameToken,
  SessionNameTokenType,
  StatusMessage,
} from "../types";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";
import {
  getSessionNameUniquenessError,
  makeSessionToken,
  MAX_SESSION_TOKENS,
  previewToken,
} from "../utils/sessionName";

const API_URL = getApiBaseUrl() ?? "";

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

  const [settingsMigration, setSettingsMigration] =
    useState<SettingsMigration | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const currentID = useRef(experimentID);
  currentID.current = experimentID;
  const generation = useRef(0);

  const applySettings = (saved: LocalSettings) => {
    const values = saved.functionalSettings ?? defaultFunctionalSettings();
    setConfig(values.batchConfig);
    setRecruitmentConfig(values.recruitmentConfig);
    setCaptchaConfig(values.captchaConfig);
    setRevision(saved.revision);
    setSettingsMigration(saved.settingsMigration);
    setExperimentExists(true);
  };

  useEffect(() => {
    const requestGeneration = ++generation.current;
    setExperimentExists(false);
    setSettingsMigration(null);
    setLoadError("");
    setMessage(null);
    setSessionNameMessage(null);
    setSaving(false);
    setRevision(0);
    const defaults = defaultFunctionalSettings();
    setConfig(defaults.batchConfig);
    setRecruitmentConfig(defaults.recruitmentConfig);
    setCaptchaConfig(defaults.captchaConfig);
    setSessionNameTokens([]);
    setSessionNameSeparator("_");
    if (!experimentID) return;
    let cancelled = false;
    const valid = () => !cancelled && generation.current === requestGeneration;
    const sessionName = fetch(
      `${API_URL}/api/session-name-config/${experimentID}`,
    )
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    Promise.all([loadFunctionalSettings(experimentID), sessionName])
      .then(([saved, session]) => {
        if (!valid()) return;
        applySettings(saved);
        if (session) {
          setSessionNameTokens(session.tokens ?? []);
          setSessionNameSeparator(session.separator ?? "_");
        }
      })
      .catch((error) => {
        if (valid())
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load the local configuration.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [experimentID, reload]);

  const handleReload = () => setReload((previous) => previous + 1);
  const handleMigrate = async () => {
    if (!experimentID || !experimentExists || saving) return;
    const id = experimentID;
    const requestGeneration = generation.current;
    const valid = () =>
      currentID.current === id && generation.current === requestGeneration;
    setSaving(true);
    setMessage(null);
    try {
      const user = auth?.currentUser;
      if (!user)
        throw new Error(
          "Sign in with the owner account to recover published settings.",
        );
      const saved = await migrateFunctionalSettings(
        id,
        revision,
        await user.getIdToken(),
      );
      if (valid()) {
        applySettings(saved);
        setMessage({
          type: "success",
          text: "Published settings recovered and saved locally.",
        });
      }
    } catch (error) {
      if (valid()) {
        setSettingsMigration(
          (previous) => previous && { ...previous, state: "needs_review" },
        );
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Could not recover settings. Review and save them locally.",
        });
      }
    } finally {
      if (valid()) setSaving(false);
    }
  };

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
    if (!experimentID || saving) return;
    const id = experimentID;
    const requestGeneration = generation.current;
    const valid = () =>
      currentID.current === id && generation.current === requestGeneration;
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
      if (valid())
        setSessionNameMessage({
          type: "success",
          text: "Session name configuration saved!",
        });
    } catch {
      if (valid())
        setSessionNameMessage({
          type: "error",
          text: "Error saving session name configuration",
        });
    } finally {
      if (valid()) setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!experimentID || !experimentExists || saving) return;
    const uniquenessError = getSessionNameUniquenessError(sessionNameTokens);
    if (uniquenessError) {
      setSessionNameMessage({ type: "error", text: uniquenessError });
      setMessage({
        type: "error",
        text: "Session name configuration is invalid.",
      });
      return;
    }
    const id = experimentID;
    const requestGeneration = generation.current;
    const valid = () =>
      currentID.current === id && generation.current === requestGeneration;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveFunctionalSettings(
        id,
        revision,
        { batchConfig: config, recruitmentConfig, captchaConfig },
        { tokens: sessionNameTokens, separator: sessionNameSeparator },
      );
      if (valid()) {
        setRevision(saved.revision);
        setSettingsMigration(saved.settingsMigration);
        setMessage({
          type: "success",
          text: "Configuration saved locally. Changes apply on the next publication.",
        });
      }
    } catch (error) {
      if (valid())
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Error saving configuration",
        });
    } finally {
      if (valid()) setSaving(false);
    }
  };

  return {
    settingsMigration,
    loadError,
    handleReload,
    handleMigrate,
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
