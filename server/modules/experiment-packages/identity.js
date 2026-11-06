import { pick, packageError } from "./format.js";
import {
  experimentFields,
  configFields,
  codeFields,
  trialFields,
  associationHints,
} from "./serialize.js";
import { validateFunctionalSettings } from "../../utils/functionalSettings.js";
import { canonicalAssetDirectory } from "../experiment-assets/paths.js";

const mediaKeys = new Set([
  "src",
  "url",
  "source",
  "stimulus",
  "image",
  "audio",
  "video",
  "backgroundImage",
  "background_image",
  "poster",
]);
function rewriteDesign(
  value,
  oldID,
  newID,
  key = "",
  csv = false,
  oldName = "",
  warnings = new Set(),
) {
  if (Array.isArray(value))
    return value.map((item) =>
      rewriteDesign(item, oldID, newID, key, csv, oldName, warnings),
    );
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) => !["__proto__", "constructor", "prototype"].includes(key),
        )
        .map(([field, item]) => [
          field,
          ["experimentID", "experimentId"].includes(field) && item === oldID
            ? newID
            : rewriteDesign(
                item,
                oldID,
                newID,
                field === "value" && mediaKeys.has(key) ? key : field,
                csv || ["csvJson", "csvData"].includes(field),
                oldName,
                warnings,
              ),
        ]),
    );
  if (typeof value !== "string") return value;
  if (!(csv || mediaKeys.has(key))) {
    if (/localhost|cloudfunctions\.net|firebaseio\.com/.test(value))
      warnings.add(
        "Review custom design values that refer to the original local server or backend.",
      );
    return value;
  }
  let pathname = value,
    suffix = "";
  if (/^https?:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      return value;
    }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      return value;
    pathname = url.pathname;
    suffix = url.search + url.hash;
  }
  for (const prefix of [
    `/${encodeURIComponent(oldID)}/`,
    `${oldID}/`,
    `/${encodeURIComponent(oldName)}/`,
    `${oldName}/`,
    "/",
  ]) {
    if (
      pathname.startsWith(prefix) &&
      /^(img|aud|vid|others)\//.test(pathname.slice(prefix.length))
    )
      return pathname.slice(prefix.length) + suffix;
  }
  if (
    value.startsWith("/") ||
    /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(value)
  )
    warnings.add(
      "Review local media references that could not be migrated automatically.",
    );
  return value;
}
function safeCodeData(original) {
  return pick(original, codeFields);
}
export function materializeEntry(entry, mode, newID, previousConfig) {
  const source = entry.data,
    id = source.experiment.experimentID;
  const now = new Date().toISOString();
  const experiment = {
    ...pick(source.experiment, experimentFields),
    experimentID: newID,
    assetDirectory: canonicalAssetDirectory(newID),
    updatedAt: now,
  };
  if (mode === "copy") {
    experiment.createdAt = now;
    experiment.origin = { experimentID: id, importedAt: now };
  } else if (source.remoteHints)
    experiment.remoteAssociationHint = {
      ...associationHints(source.remoteHints),
      state: "unverified",
    };
  const referenceWarnings = new Set();
  const trials = source.trials
    ? rewriteDesign(
        pick(source.trials, trialFields),
        id,
        newID,
        "",
        false,
        source.experiment.name,
        referenceWarnings,
      )
    : null;
  const config = {
    ...pick(source.config, configFields),
    experimentID: newID,
    data: safeCodeData(source.config?.data),
    isDevMode: source.config?.isDevMode === true,
    isSaveMode: source.config?.isSaveMode === true,
    createdAt: mode === "copy" ? now : source.config?.createdAt || now,
    updatedAt: now,
  };
  if (!config.isDevMode) config.data.generatedCode = "";
  try {
    const normalized = validateFunctionalSettings(config.functionalSettings);
    config.functionalSettings = {
      ...normalized,
      revision:
        mode === "copy"
          ? 1
          : Math.max(
              normalized.revision,
              previousConfig?.functionalSettings?.revision || 0,
            ) + 1,
    };
    config.settingsMigration = { state: "complete", source: "package" };
  } catch {
    delete config.functionalSettings;
    config.settingsMigration =
      mode === "copy"
        ? { state: "needs_review", source: "package" }
        : { state: "needs_remote_read", source: "local" };
  }
  const previousReview = source.config?.deploymentReview;
  const previousReasons = Array.isArray(previousReview?.reasons)
    ? previousReview.reasons.filter((reason) => typeof reason === "string")
    : [];
  if (previousReview?.required && !previousReasons.length)
    previousReasons.push(
      "Confirm the deployment settings and custom code imported from this package.",
    );
  const reasons = [
    ...referenceWarnings,
    ...(previousReview?.required ? previousReasons : []),
  ];
  if (mode === "copy") {
    if (config.functionalSettings?.recruitmentConfig.platform === "prolific")
      reasons.push(
        "Check that the Prolific completion code belongs to the new study.",
      );
    if (config.functionalSettings?.captchaConfig.enabled)
      reasons.push(
        "Check that the CAPTCHA site key permits the new publication domain.",
      );
    const code = JSON.stringify(config.data);
    if (
      config.isDevMode ||
      /localhost|cloudfunctions\.net|firebaseio\.com|https?:\/\//.test(code) ||
      (id && code.includes(id))
    )
      reasons.push(
        "Review custom code for references to the original experiment or backend. Custom source was preserved.",
      );
  }
  config.deploymentReview = {
    required: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
  const sessionResults =
    mode === "restore" && Array.isArray(source.sessionResults)
      ? structuredClone(source.sessionResults)
      : [];
  const participantFiles =
    mode === "restore" && Array.isArray(source.participantFiles)
      ? structuredClone(source.participantFiles)
      : [];
  for (const record of [...sessionResults, ...participantFiles])
    if (record.experimentID !== id)
      throw packageError(
        "PACKAGE_INVALID",
        400,
        "Historical record identity does not match its experiment",
      );
  return {
    experiment,
    trials,
    config,
    sessionResults,
    participantFiles,
    sessionCounter:
      mode === "restore" &&
      Number.isSafeInteger(source.sessionCounter) &&
      source.sessionCounter >= 0
        ? source.sessionCounter
        : 0,
  };
}
