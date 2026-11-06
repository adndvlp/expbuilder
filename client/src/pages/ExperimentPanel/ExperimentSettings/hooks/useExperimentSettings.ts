import { useEffect, useRef, useState } from "react";
import { auth } from "../../../../lib/firebase";
import {
  loadFunctionalSettings,
  saveFunctionalSettings,
  migrateFunctionalSettings,
  SettingsRequestError,
  type SettingsMigration,
} from "../../../../lib/functionalSettings";
import type { StatusMessage } from "../types";
import { getApiBaseUrl } from "../../../../lib/apiBaseUrl";
import { getSessionNameUniquenessError } from "../utils/sessionName";
import { createSettingsDraft, useSettingsDraft } from "./useSettingsDraft";

export function useExperimentSettings(experimentID: string | undefined) {
  const editor = useSettingsDraft();
  const [experimentExists, setExperimentExists] = useState(false);
  const [settingsMigration, setSettingsMigration] =
    useState<SettingsMigration | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [sessionNameMessage, setSessionNameMessage] =
    useState<StatusMessage | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [reload, setReload] = useState(0);
  const currentID = useRef(experimentID);
  currentID.current = experimentID;
  const generation = useRef(0);
  const needsReview =
    settingsMigration !== null && settingsMigration.state !== "complete";

  useEffect(() => {
    const requestGeneration = ++generation.current;
    const valid = () =>
      currentID.current === experimentID &&
      generation.current === requestGeneration;
    setExperimentExists(false);
    setSettingsMigration(null);
    setLoadError("");
    setMessage(null);
    setSessionNameMessage(null);
    setSaving(false);
    setHasConflict(false);
    setRevision(0);
    editor.reset(createSettingsDraft(), false);
    if (!experimentID) return;
    const session = fetch(
      `${getApiBaseUrl()}/api/session-name-config/${encodeURIComponent(experimentID)}`,
    ).then((response) => {
      if (!response.ok)
        throw new Error(
          "Could not load session name settings. Retry before saving.",
        );
      return response.json();
    });
    Promise.all([loadFunctionalSettings(experimentID), session])
      .then(([saved, sessionName]) => {
        if (!valid()) return;
        editor.reset(
          createSettingsDraft(saved.functionalSettings, sessionName),
        );
        setRevision(saved.revision);
        setSettingsMigration(saved.settingsMigration);
        setExperimentExists(true);
      })
      .catch((error) => {
        if (valid())
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load local settings.",
          );
      });
    return () => {
      generation.current++;
    };
  }, [experimentID, reload]);

  const handleReload = () => {
    if (saving) return;
    if (
      editor.hasChanges &&
      !window.confirm(
        "Discard unsaved changes and load the saved configuration?",
      )
    )
      return;
    setReload((previous) => previous + 1);
  };
  const reportError = (error: unknown) => {
    if (
      error instanceof SettingsRequestError &&
      ["SETTINGS_REVISION_CONFLICT", "SETTINGS_ALREADY_COMPLETE"].includes(
        error.code ?? "",
      )
    ) {
      setHasConflict(true);
      setMessage({
        type: "error",
        text: "A newer configuration was saved. Your changes are still here. Load the saved version before saving again.",
      });
      return;
    }
    setMessage({
      type: "error",
      text:
        error instanceof Error
          ? error.message
          : "Could not save the configuration.",
    });
  };
  const handleMigrate = async () => {
    if (
      !experimentID ||
      !experimentExists ||
      saving ||
      hasConflict ||
      !needsReview
    )
      return;
    if (
      editor.functionalChanges &&
      !window.confirm(
        "Recover published settings and replace unsaved changes to batching, recruitment and CAPTCHA?",
      )
    )
      return;
    const id = experimentID,
      requestGeneration = generation.current;
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
      if (valid() && saved.functionalSettings) {
        editor.applyRecovered(saved.functionalSettings);
        setRevision(saved.revision);
        setSettingsMigration(saved.settingsMigration);
        setMessage({
          type: "success",
          text: "Published settings recovered and saved on this device.",
        });
      }
    } catch (error) {
      if (valid()) {
        setSettingsMigration(
          (previous) => previous && { ...previous, state: "needs_review" },
        );
        reportError(error);
      }
    } finally {
      if (valid()) setSaving(false);
    }
  };
  const canSave =
    experimentExists &&
    !saving &&
    !hasConflict &&
    (editor.hasChanges || needsReview);
  const handleSave = async () => {
    if (!experimentID || !canSave) return;
    const uniquenessError = getSessionNameUniquenessError(
      editor.sessionNameTokens,
    );
    if (uniquenessError) {
      setSessionNameMessage({ type: "error", text: uniquenessError });
      setMessage({
        type: "error",
        text: "Session name configuration is invalid.",
      });
      return;
    }
    const id = experimentID,
      requestGeneration = generation.current,
      snapshot = editor.draft;
    const valid = () =>
      currentID.current === id && generation.current === requestGeneration;
    setSaving(true);
    setMessage(null);
    setSessionNameMessage(null);
    try {
      const { sessionNameConfig, ...sections } = snapshot;
      const saved = await saveFunctionalSettings(
        id,
        revision,
        sections,
        sessionNameConfig,
      );
      if (valid()) {
        editor.markSaved(snapshot);
        setRevision(saved.revision);
        setSettingsMigration(saved.settingsMigration);
        setMessage({
          type: "success",
          text: "Configuration saved on this device.",
        });
      }
    } catch (error) {
      if (valid()) reportError(error);
    } finally {
      if (valid()) setSaving(false);
    }
  };
  return {
    ...editor,
    experimentExists,
    settingsMigration,
    needsReview,
    canSave,
    hasConflict,
    saving,
    message,
    sessionNameMessage,
    loadError,
    handleReload,
    handleMigrate,
    handleSave,
  };
}
