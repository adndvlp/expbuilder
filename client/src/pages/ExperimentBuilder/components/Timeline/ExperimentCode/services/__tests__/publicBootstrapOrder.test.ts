import { expect, it } from 'vitest';
import { publicBootstrapCode } from '../publicBootstrapCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

it('registers presence before waiting for CAPTCHA so that its setup deadline cannot expire while the participant is connected', async () => {
  const calls: string[] = [];
  const options = { experimentID: 'EID', batchConfig: { useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: 1 },
    captchaConfig: { enabled: true, siteKey: 'site-key', provider: 'hcaptcha' }, recruitmentConfig: { platform: 'none' },
    evaluateCondition: '' } as PublicExperimentCodeOptions;
  await new Function('calls', `
    const _publicStorageKeys = {}, _publicWriter = { connectionId: 'C1', writeToken: 'secret' }, trialSessionId = 'S1', isResuming = false;
    let participantNumber;
    const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    const sessionStorage = { getItem: () => null, setItem() {} };
    const createSession = async action => ({ decision: 'resume_allowed', sessionProtocolVersion: 3, lifecycle: 'active', participantNumber: 0,
      connection: { id: 'C1', generation: 1, phase: action === 'activateConnection' ? 'active' : 'connecting' } });
    const _sessionNameHasDynamic = () => false, _setLoadingMsg = () => {}, _hideLoading = () => {};
    const _showCaptchaGate = async () => calls.push('captcha');
    const _resolveResumeBranch = () => null, _canonicalPublicEvent = JSON.stringify;
    const metadata = {}, firebaseConfig = {}, waitForFirebase = async () => {};
    const database = () => ({ ref: () => ({ set: async () => calls.push('publish'), onDisconnect: () => ({ set: async () => calls.push('arm') }) }) });
    database.ServerValue = { TIMESTAMP: 1 };
    const window = { firebase: { apps: [{}], database }, location: { search: '', hash: '' }, ExpBuilderNavigation: { activateResume() {} } };
    return ${publicBootstrapCode(options).trim()}
    })();
  `)(calls);
  expect(calls).toEqual(['arm', 'publish', 'captcha']);
});
