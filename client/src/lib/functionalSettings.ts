import { getApiBaseUrl } from "./apiBaseUrl";
import {
  defaultFunctionalSettings,
  validateFunctionalSettings,
  type FunctionalSettings,
  type SettingsSections,
} from "../../../api/functions/experiment/functional-settings/model.js";

export { defaultFunctionalSettings, validateFunctionalSettings };
export type { FunctionalSettings, SettingsSections };
export type SettingsMigration = {
  state: "complete" | "needs_remote_read" | "needs_review";
  source: "new" | "local" | "remote" | "package" | "reviewed_defaults";
};
export type LocalSettings = {
  functionalSettings: FunctionalSettings | null;
  revision: number;
  settingsMigration: SettingsMigration;
};

async function requestSettings(
  experimentID: string,
  init?: RequestInit,
  suffix = "",
): Promise<LocalSettings> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/functional-settings/${encodeURIComponent(experimentID)}${suffix}`,
    init,
  );
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.message ||
        "Could not access the saved configuration. Retry loading settings.",
    );
  if (
    !Number.isSafeInteger(body.revision) ||
    body.revision < 0 ||
    !["complete", "needs_remote_read", "needs_review"].includes(
      body.settingsMigration?.state,
    )
  ) {
    throw new Error(
      "The saved configuration could not be verified. Review the experiment settings.",
    );
  }
  return {
    functionalSettings:
      body.settingsMigration.state === "complete"
        ? validateFunctionalSettings(body.functionalSettings)
        : null,
    revision: body.revision,
    settingsMigration: body.settingsMigration,
  };
}

export const loadFunctionalSettings = (id: string) => requestSettings(id);
export async function requireFunctionalSettings(
  id: string | undefined,
): Promise<FunctionalSettings> {
  if (!id)
    throw new Error("Select an experiment before generating public code.");
  const saved = await loadFunctionalSettings(id);
  if (
    !saved.functionalSettings ||
    saved.settingsMigration.state !== "complete"
  ) {
    throw new Error(
      "Review and save the experiment configuration, or recover your published settings, before publishing.",
    );
  }
  return saved.functionalSettings;
}
export function saveFunctionalSettings(
  id: string,
  expectedRevision: number,
  settings: SettingsSections,
  sessionNameConfig: unknown,
) {
  return requestSettings(id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision, settings, sessionNameConfig }),
  });
}
export function migrateFunctionalSettings(
  id: string,
  expectedRevision: number,
  idToken: string,
) {
  return requestSettings(
    id,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ expectedRevision }),
    },
    "/migrate",
  );
}
