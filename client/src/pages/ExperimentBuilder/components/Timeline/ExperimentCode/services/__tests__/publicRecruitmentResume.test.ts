import { expect, it, vi } from 'vitest';
import { publicInitCode } from '../publicInitCode';
import { publicFinishCode } from '../publicFinishCode';
import { publicBootstrapCode } from '../publicBootstrapCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

const none = { platform: 'none', prolificCompletionCode: '' };
const prolific = (code: string) => ({ platform: 'prolific', prolificCompletionCode: code });
it.each([[none, prolific('OLD')], [prolific('NEW'), none], [prolific('NEW'), prolific('OLD')]])(
  'completion uses the session recruitment settings after republishing %#', async (published, saved) => {
    const success = vi.fn(), complete = vi.fn(async () => {}), location = { href: '' };
    const options = { experimentID: 'EID', customPreInitCode: {}, publicParams: {}, extensions: '', recruitmentConfig: published } as PublicExperimentCodeOptions;
    const code = (publicInitCode(options) + publicFinishCode(options)).split('// __INIT_JSPSYCH_END__')[0];
    const callback = new Function('saved', 'success', 'complete', 'location', `
      let publicFinished = false, publicFinishInFlight = null, publicClosing = false, publicFinishHandler;
      const _publicSessionState = { lifecycle: 'active', sessionProtocolVersion: 3, configuration: { recruitmentConfig: saved } };
      const _publicStorageKeys = {}, sessionRef = { onDisconnect: () => ({ cancel: async () => {} }) };
      const window = { location, ExpBuilderNavigation: { isTransitionPending: () => false, clearTransientState() {} } };
      const _showLoading = () => {}, _setLoadingMsg = () => {}, _showSuccess = success, _completePublicSession = complete;
      const _publicPersistenceError = error => { throw error; }, setTimeout = callback => callback();
      const _prolificPID = 'P', _mturkTurkSubmitTo = null, _mturkAssignmentID = null, _mturkIsPreview = false;
      const initJsPsych = callbacks => callbacks;
      ${code}
      return jsPsych.on_finish;
    `)(saved, success, complete, location) as () => Promise<void>;
    await callback();
    expect(complete).toHaveBeenCalledOnce();
    if (saved.platform === 'none') { expect(success).toHaveBeenCalledOnce(); expect(location.href).toBe(''); }
    else { expect(location.href).toBe('https://app.prolific.com/submissions/complete?cc=OLD'); expect(success).not.toHaveBeenCalled(); }
  });

it.each([['mturk', 'none'], ['none', 'mturk']])('the preview gate uses saved recruitment settings: published %s, saved %s', async (published, saved) => {
  const panel = document.createElement('div');
  const options = { experimentID: 'EID', batchConfig: { useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: 1 },
    captchaConfig: { enabled: false }, recruitmentConfig: { platform: published }, evaluateCondition: '' } as PublicExperimentCodeOptions;
  const continued = await new Function('panel', 'saved', `
    const _publicStorageKeys = {}, _publicWriter = { connectionId: 'C1', writeToken: 'secret' }, trialSessionId = 'S1', isResuming = false;
    let participantNumber;
    const localStorage = { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage = { getItem: () => null };
    const createSession = async action => ({ decision: 'resume_allowed', sessionProtocolVersion: 3, lifecycle: 'active', participantNumber: 0,
      configuration: { recruitmentConfig: { platform: saved } },
      connection: { id: 'C1', generation: 1, phase: action === 'activateConnection' ? 'active' : 'connecting' } });
    const _sessionNameHasDynamic = () => false, _setLoadingMsg = () => {}, _hideLoading = () => {};
    const _resolveResumeBranch = () => null, _canonicalPublicEvent = JSON.stringify;
    const metadata = {}, firebaseConfig = {}, waitForFirebase = async () => {};
    const database = () => ({ ref: () => ({ set: async () => {}, onDisconnect: () => ({ set: async () => {} }) }) });
    database.ServerValue = { TIMESTAMP: 1 };
    const document = { getElementById: () => panel };
    const window = { firebase: { apps: [{}], database }, location: { search: '?assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE', hash: '' }, ExpBuilderNavigation: { activateResume() {} } };
    return ${publicBootstrapCode(options).trim()}
      return true;
    })();
  `)(panel, saved);
  expect(Boolean(continued)).toBe(saved !== 'mturk');
  expect(panel.innerHTML.includes('Preview')).toBe(saved === 'mturk');
});
