import { expect, it, vi } from 'vitest';
import { publicBootstrapCode } from '../publicBootstrapCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

it.each([
  { name: 'hCaptcha from the session', saved: { enabled: true, siteKey: 'session-key', provider: 'hcaptcha' }, expected: ['session-key', 'hcaptcha'] },
  { name: 'reCAPTCHA from the session', saved: { enabled: true, siteKey: 'saved-key', provider: 'recaptcha' }, expected: ['saved-key', 'recaptcha'] },
  { name: 'disabled CAPTCHA from the session', saved: { enabled: false, siteKey: '', provider: 'hcaptcha' }, expected: null },
])('registers presence first and applies $name', async ({ saved, expected }) => {
  const calls: string[] = [];
  const showCaptcha = vi.fn(async () => { calls.push('captcha'); });
  const options = { experimentID: 'EID', evaluateCondition: '' } as PublicExperimentCodeOptions;
  await new Function('calls', 'saved', '_showCaptchaGate', `
    const _publicStorageKeys = {}, _publicWriter = { connectionId: 'C1', writeToken: 'secret' }, trialSessionId = 'S1', isResuming = false;
    let participantNumber;
    const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const sessionStorage = { getItem: () => null, setItem() {} };
    const createSession = async action => ({ decision: 'resume_allowed', sessionProtocolVersion: 3, lifecycle: 'active', participantNumber: 0,
      configuration: { batchConfig: { useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: 1 }, captchaConfig: saved, recruitmentConfig: { platform: 'none', prolificCompletionCode: '' } },
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
