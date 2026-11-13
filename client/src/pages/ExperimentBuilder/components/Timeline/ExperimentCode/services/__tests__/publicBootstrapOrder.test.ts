import { expect, it, vi } from 'vitest';
import { publicBootstrapCode } from '../publicBootstrapCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

const publishedCaptcha = { enabled: true, siteKey: 'published-key', provider: 'hcaptcha' };
const savedCaptcha = { enabled: true, siteKey: 'saved-key', provider: 'recaptcha' };

it.each([
  { name: 'published configuration when the response has none', published: publishedCaptcha, saved: undefined,
    expected: ['published-key', 'hcaptcha'] },
  { name: 'saved key and provider after republication', published: publishedCaptcha, saved: savedCaptcha,
    expected: ['saved-key', 'recaptcha'] },
  { name: 'saved enabled CAPTCHA after publishing it disabled', published: { ...publishedCaptcha, enabled: false }, saved: savedCaptcha,
    expected: ['saved-key', 'recaptcha'] },
  { name: 'saved disabled CAPTCHA after publishing it enabled', published: publishedCaptcha, saved: { ...savedCaptcha, enabled: false },
    expected: null },
])('registers presence first and applies $name', async ({ published, saved, expected }) => {
  const calls: string[] = [];
  const showCaptcha = vi.fn(async () => { calls.push('captcha'); });
  const options = { experimentID: 'EID', batchConfig: { useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: 1 },
    captchaConfig: published, recruitmentConfig: { platform: 'none' },
    evaluateCondition: '' } as PublicExperimentCodeOptions;
  await new Function('calls', 'saved', '_showCaptchaGate', `
    const _publicStorageKeys = {}, _publicWriter = { connectionId: 'C1', writeToken: 'secret' }, trialSessionId = 'S1', isResuming = false;
    let participantNumber;
    const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const sessionStorage = { getItem: () => null, setItem() {} };
    const createSession = async action => ({ decision: 'resume_allowed', sessionProtocolVersion: 3, lifecycle: 'active', participantNumber: 0,
      configuration: { captchaConfig: saved },
      connection: { id: 'C1', generation: 1, phase: action === 'activateConnection' ? 'active' : 'connecting' } });
    const _sessionNameHasDynamic = () => false, _setLoadingMsg = () => {}, _hideLoading = () => {};
    const _resolveResumeBranch = () => null, _canonicalPublicEvent = JSON.stringify;
    const metadata = {}, firebaseConfig = {}, waitForFirebase = async () => {};
    const database = () => ({ ref: () => ({ set: async () => calls.push('publish'), onDisconnect: () => ({ set: async () => calls.push('arm') }) }) });
    database.ServerValue = { TIMESTAMP: 1 };
    const window = { firebase: { apps: [{}], database }, location: { search: '', hash: '' }, ExpBuilderNavigation: { activateResume() {} } };
    return ${publicBootstrapCode(options).trim()}
    })();
  `)(calls, saved, showCaptcha);
  expect(calls).toEqual(expected ? ['arm', 'publish', 'captcha'] : ['arm', 'publish']);
  if (expected) expect(showCaptcha).toHaveBeenCalledExactlyOnceWith(...expected);
  else expect(showCaptcha).not.toHaveBeenCalled();
});
