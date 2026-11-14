import { createDefaultPublicSettings, validatePublicSettings } from '../../experiment/settings.js';

const expected = () => ({ batchConfig: { useIndexedDB: true, batchSize: 0, resumeTimeoutMinutes: 30 },
  recruitmentConfig: { platform: 'none', prolificCompletionCode: '' }, captchaConfig: { enabled: false, provider: 'hcaptcha', siteKey: '' } });
test('AC05: settings defaults are complete independent values', () => {
  const first = createDefaultPublicSettings(); expect(first).toEqual(expected());
  first.batchConfig.batchSize = 7; expect(createDefaultPublicSettings()).toEqual(expected());
});
test.each([0, 1, 7, Number.MAX_SAFE_INTEGER])('accepts batch %s without coercion or forcing batch 1', batchSize => {
  const settings = expected(); settings.batchConfig = { useIndexedDB: false, batchSize, resumeTimeoutMinutes: 1440 };
  expect(validatePublicSettings(settings)).toEqual(settings);
});
test.each(['none', 'prolific', 'mturk'])('keeps platform %s and its empty completion code', platform => {
  const settings = expected(); settings.recruitmentConfig.platform = platform;
  expect(validatePublicSettings(settings)).toEqual(settings);
});
test.each(['hcaptcha', 'recaptcha'])('accepts enabled %s with a nonempty public key', provider => {
  const settings = expected(); settings.captchaConfig = { enabled: true, provider, siteKey: ' site-key ' };
  expect(validatePublicSettings(settings)).toEqual(settings);
});
test.each([
  ['missing group', s => { delete s.batchConfig; }], ['non-map group', s => { s.batchConfig = []; }],
  ['unknown group field', s => { s.batchConfig.extra = 1; }],
  ['IndexedDB type', s => { s.batchConfig.useIndexedDB = 'false'; }],
  ['negative batch', s => { s.batchConfig.batchSize = -1; }], ['fractional batch', s => { s.batchConfig.batchSize = 1.5; }],
  ['unsafe batch', s => { s.batchConfig.batchSize = 9007199254740992; }], ['infinite batch', s => { s.batchConfig.batchSize = Infinity; }],
  ['zero timeout', s => { s.batchConfig.resumeTimeoutMinutes = 0; }], ['long timeout', s => { s.batchConfig.resumeTimeoutMinutes = 1441; }],
  ['fractional timeout', s => { s.batchConfig.resumeTimeoutMinutes = 1.5; }], ['string timeout', s => { s.batchConfig.resumeTimeoutMinutes = '1'; }],
  ['platform', s => { s.recruitmentConfig.platform = 'other'; }], ['code type', s => { s.recruitmentConfig.prolificCompletionCode = 1; }],
  ['CAPTCHA enabled type', s => { s.captchaConfig.enabled = 'false'; }], ['CAPTCHA provider', s => { s.captchaConfig.provider = 'other'; }],
  ['CAPTCHA site key type', s => { s.captchaConfig.siteKey = 1; }],
  ['CAPTCHA empty key', s => { s.captchaConfig = { enabled: true, provider: 'hcaptcha', siteKey: '' }; }],
  ['CAPTCHA blank key', s => { s.captchaConfig = { enabled: true, provider: 'hcaptcha', siteKey: '\n \t\u00a0' }; }],
])('rejects %s with a 400 validation error', (_name, change) => {
  const settings = expected(); change(settings);
  expect(() => validatePublicSettings(settings)).toThrow(expect.objectContaining({ status: 400 }));
});
