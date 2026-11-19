import { describe, expect, it, vi } from 'vitest';
import { publicHandshakeCode } from '../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicHandshakeCode';
import type { PublicExperimentCodeOptions } from '../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicCodeTypes';

const configuration = () => ({ batchConfig: { useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 45 },
  recruitmentConfig: { platform: 'prolific', prolificCompletionCode: 'CURRENT' },
  captchaConfig: { enabled: true, provider: 'recaptcha', siteKey: 'current-key' } });
const options = { DATA_API_URL: '/api', experimentID: 'EID' } as PublicExperimentCodeOptions;
function runtime(result: unknown) {
  const fetch = vi.fn<(...args: [string, RequestInit]) => Promise<{ json(): Promise<unknown> }>>(async () => ({ json: async () => result }));
  const create = new Function('fetch', `
    const trialSessionId = 'S1', metadata = {};
    const _sessionNameHasDynamic = () => false, _generateSessionName = () => null;
    ${publicHandshakeCode(options)}
    return createSession;
  `)(fetch) as (action?: string, renew?: boolean) => Promise<unknown>;
  return { fetch, create };
}

describe('generated session settings contract', () => {
  it.each(['createSession', 'resumeSession', 'activateConnection'])('uses only the server configuration for %s', async action => {
    const response = { decision: 'resume_allowed', sessionProtocolVersion: 3, configuration: configuration() };
    const { create, fetch } = runtime(response);
    expect(await create(action)).toEqual(response);
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ action, experimentID: 'EID', sessionId: 'S1' });
    expect(body).not.toHaveProperty('configuration');
  });

  it.each([
    undefined, {},
    { ...configuration(), batchConfig: undefined },
    { ...configuration(), recruitmentConfig: undefined },
    { ...configuration(), captchaConfig: undefined },
    { ...configuration(), batchConfig: { useIndexedDB: false, batchSize: 1, resumeTimeoutMinutes: 0 } },
    { ...configuration(), captchaConfig: { enabled: true, provider: 'recaptcha', siteKey: '' } },
    { ...configuration(), recruitmentConfig: { platform: 'unknown', prolificCompletionCode: '' } },
  ])('rejects incomplete or invalid session settings without embedded defaults (%#)', async settings => {
    const { create } = runtime({ decision: 'resume_allowed', sessionProtocolVersion: 3, configuration: settings });
    await expect(create()).rejects.toThrow(/session settings/i);
  });
});
