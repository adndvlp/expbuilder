type PublicSettingsInput = {
  batchConfig: unknown;
  recruitmentConfig: unknown;
  captchaConfig: unknown;
};
// Self-contained: the public HTML embeds this validator without external dependencies.
export function getPublicSettingsError(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return 'Complete public settings are required.';
  function fields(value: unknown, keys: string[]): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
  }
  const integer = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
  const { batchConfig: b, recruitmentConfig: r, captchaConfig: c } = settings as PublicSettingsInput;
  if (!fields(b, ['useIndexedDB', 'batchSize', 'resumeTimeoutMinutes'])) return 'Complete batch configuration is required.';
  if (typeof b.useIndexedDB !== 'boolean') return 'Use IndexedDB must be a boolean.';
  if (!integer(b.batchSize, 0, Number.MAX_SAFE_INTEGER)) return 'Batch Size must be a nonnegative safe integer.';
  if (!integer(b.resumeTimeoutMinutes, 1, 1440)) return 'Resume Timeout must be an integer from 1 to 1440 minutes.';
  if (!fields(r, ['platform', 'prolificCompletionCode'])) return 'Complete recruitment configuration is required.';
  if (typeof r.platform !== 'string' || !['none', 'prolific', 'mturk'].includes(r.platform)) return 'Recruitment platform must be none, prolific or mturk.';
  if (typeof r.prolificCompletionCode !== 'string') return 'Prolific Completion Code must be a string.';
  if (!fields(c, ['enabled', 'provider', 'siteKey'])) return 'Complete CAPTCHA configuration is required.';
  if (typeof c.enabled !== 'boolean') return 'CAPTCHA enabled must be a boolean.';
  if (typeof c.provider !== 'string' || !['hcaptcha', 'recaptcha'].includes(c.provider)) return 'CAPTCHA provider must be hcaptcha or recaptcha.';
  if (typeof c.siteKey !== 'string') return 'CAPTCHA Site Key must be a string.';
  if (c.enabled && !c.siteKey.trim()) return 'CAPTCHA Site Key is required when CAPTCHA is enabled.';
  return null;
}
