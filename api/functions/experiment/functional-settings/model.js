// Pure contract shared by Cloud Functions, the local API and the editor.
export class FunctionalSettingsError extends Error {
  constructor(message) {
    super(message);
    this.code = "SETTINGS_INVALID";
    this.status = 422;
  }
}

export function defaultFunctionalSettings(revision = 1) {
  return {
    schemaVersion: 1,
    revision,
    batchConfig: { useIndexedDB: true, batchSize: 0, resumeTimeoutMinutes: 30 },
    recruitmentConfig: { platform: "none", prolificCompletionCode: "" },
    captchaConfig: { enabled: false, provider: "hcaptcha", siteKey: "" },
  };
}

export function validateSettingsSections(value) {
  const batch = value?.batchConfig;
  const recruitment = value?.recruitmentConfig;
  const captcha = value?.captchaConfig;
  if (
    typeof batch?.useIndexedDB !== "boolean" ||
    !Number.isSafeInteger(batch.batchSize) ||
    batch.batchSize < 0 ||
    !Number.isInteger(batch.resumeTimeoutMinutes) ||
    batch.resumeTimeoutMinutes < 1 ||
    batch.resumeTimeoutMinutes > 1440
  )
    throw new FunctionalSettingsError(
      "Batch size must be a nonnegative integer and resume timeout must be 1–1440 minutes.",
    );
  if (
    !["none", "prolific", "mturk"].includes(recruitment?.platform) ||
    typeof recruitment.prolificCompletionCode !== "string"
  )
    throw new FunctionalSettingsError(
      "Choose a supported recruitment platform and a completion code string.",
    );
  if (
    typeof captcha?.enabled !== "boolean" ||
    !["hcaptcha", "recaptcha"].includes(captcha.provider) ||
    typeof captcha.siteKey !== "string" ||
    (captcha.enabled && !captcha.siteKey.trim())
  )
    throw new FunctionalSettingsError(
      "Choose a supported CAPTCHA provider and enter a public site key when enabled.",
    );
  // Explicit fields prevent credentials, identity or counters from being persisted.
  return {
    batchConfig: {
      useIndexedDB: batch.useIndexedDB,
      batchSize: batch.batchSize,
      resumeTimeoutMinutes: batch.resumeTimeoutMinutes,
    },
    recruitmentConfig: {
      platform: recruitment.platform,
      prolificCompletionCode: recruitment.prolificCompletionCode,
    },
    captchaConfig: {
      enabled: captcha.enabled,
      provider: captcha.provider,
      siteKey: captcha.siteKey,
    },
  };
}

export function validateFunctionalSettings(value) {
  if (
    value?.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1
  ) {
    throw new FunctionalSettingsError(
      "The saved settings version or revision is invalid. Review and save the configuration.",
    );
  }
  return {
    schemaVersion: 1,
    revision: value.revision,
    ...validateSettingsSections(value),
  };
}
