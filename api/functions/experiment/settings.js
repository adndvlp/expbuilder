export function createDefaultPublicSettings() {
  return { batchConfig: { useIndexedDB: true, batchSize: 0, resumeTimeoutMinutes: 30 },
    recruitmentConfig: { platform: 'none', prolificCompletionCode: '' },
    captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' } };
}
const fields = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && keys.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => keys.includes(key));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
function requireSetting(valid, message) {
  if (!valid) throw Object.assign(new Error(message), { status: 400 });
}
export function validatePublicSettings(settings) {
  const b = settings?.batchConfig, r = settings?.recruitmentConfig, c = settings?.captchaConfig;
  requireSetting(fields(b, ['useIndexedDB', 'batchSize', 'resumeTimeoutMinutes']), 'Complete batch configuration required');
  requireSetting(typeof b.useIndexedDB === 'boolean', 'Use IndexedDB must be a boolean');
  requireSetting(integer(b.batchSize, 0, Number.MAX_SAFE_INTEGER), 'Batch Size must be a nonnegative safe integer');
  requireSetting(integer(b.resumeTimeoutMinutes, 1, 1440), 'Resume Timeout must be an integer from 1 to 1440 minutes');
  requireSetting(fields(r, ['platform', 'prolificCompletionCode']), 'Complete recruitment configuration required');
  requireSetting(['none', 'prolific', 'mturk'].includes(r.platform), 'Invalid recruitment platform');
  requireSetting(typeof r.prolificCompletionCode === 'string', 'Prolific completion code must be a string');
  requireSetting(fields(c, ['enabled', 'provider', 'siteKey']), 'Complete CAPTCHA configuration required');
  requireSetting(typeof c.enabled === 'boolean', 'CAPTCHA enabled must be a boolean');
  requireSetting(['hcaptcha', 'recaptcha'].includes(c.provider), 'Invalid CAPTCHA provider');
  requireSetting(typeof c.siteKey === 'string' && (!c.enabled || c.siteKey.trim().length > 0), 'A nonempty CAPTCHA site key is required when enabled');
  return { batchConfig: { ...b }, recruitmentConfig: { ...r }, captchaConfig: { ...c } };
}
