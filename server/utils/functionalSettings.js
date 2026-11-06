import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Electron ships api/ in extraResources, while server/ lives inside app.asar.
const packagedModel =
  process.resourcesPath &&
  path.join(
    process.resourcesPath,
    "api/functions/experiment/functional-settings/model.js",
  );
const modelUrl =
  packagedModel && fs.existsSync(packagedModel)
    ? pathToFileURL(packagedModel)
    : new URL(
        "../../api/functions/experiment/functional-settings/model.js",
        import.meta.url,
      );
const model = await import(modelUrl.href);
export const {
  defaultFunctionalSettings,
  validateSettingsSections,
  validateFunctionalSettings,
} = model;

export function settingsDocument(data, experimentID) {
  return data.configs.find((c) => c.experimentID === experimentID);
}

export function ensureSettingsDocument(data, experimentID) {
  let doc = settingsDocument(data, experimentID);
  if (!doc) {
    doc = {
      experimentID,
      data: {},
      isDevMode: false,
      isSaveMode: false,
      createdAt: new Date().toISOString(),
    };
    data.configs.push(doc);
  }
  return doc;
}

export function readFunctionalSettings(doc) {
  const revision =
    Number.isSafeInteger(doc?.functionalSettings?.revision) &&
    doc.functionalSettings.revision >= 0
      ? doc.functionalSettings.revision
      : 0;
  if (doc?.settingsMigration?.state === "complete") {
    try {
      return {
        functionalSettings: validateFunctionalSettings(doc.functionalSettings),
        revision,
        ...(doc.deploymentReview
          ? { deploymentReview: doc.deploymentReview }
          : {}),
        settingsMigration: doc.settingsMigration,
      };
    } catch {
      /* Corrupt/incompatible records must be explicitly reviewed. */
    }
  }
  return {
    functionalSettings: null,
    ...(doc?.deploymentReview
      ? { deploymentReview: doc.deploymentReview }
      : {}),
    revision,
    settingsMigration: {
      state:
        doc?.settingsMigration?.state === "needs_review" ||
        doc?.settingsMigration?.state === "complete"
          ? "needs_review"
          : "needs_remote_read",
      source: doc?.settingsMigration?.source || "local",
    },
  };
}

export function settingsError(code, status, message) {
  return Object.assign(new Error(message), { code, status });
}

export function requireLocalExperiment(data, id) {
  const experiment = data.experiments.find((e) => e.experimentID === id);
  if (!experiment)
    throw settingsError(
      "EXPERIMENT_NOT_FOUND",
      404,
      "Local experiment not found",
    );
  return experiment;
}

export function assertSettingsRevision(doc, expectedRevision) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw settingsError(
      "INVALID_SETTINGS_REVISION",
      400,
      "An expectedRevision is required",
    );
  }
  if (readFunctionalSettings(doc).revision !== expectedRevision) {
    throw settingsError(
      "SETTINGS_REVISION_CONFLICT",
      409,
      "Settings changed. Reload saved settings before saving again.",
    );
  }
}
