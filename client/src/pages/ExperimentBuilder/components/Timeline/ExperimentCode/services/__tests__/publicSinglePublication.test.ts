import { describe, expect, it, vi } from 'vitest';
import { publicHandshakeCode } from '../publicHandshakeCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

const configuration = { batchConfig: { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1 } };
function fixture() {
  const fetch = vi.fn(async () => ({ json: async () => ({ success: true, decision: 'resume_allowed',
    sessionProtocolVersion: 3, sessionId: 'S1', participantNumber: 23, configuration }) }));
  const code = publicHandshakeCode({ DATA_API_URL: 'https://test.invalid/apiData', experimentID: 'EID',
    batchConfig: configuration.batchConfig } as PublicExperimentCodeOptions);
  const create = new Function('fetch', 'crypto', `
    let trialSessionId = 'S1';
    const metadata = { test: 'current' };
    const _sessionNameHasDynamic = () => false, _generateSessionName = () => 'participant';
    ${code}
    return createSession;
  `)(fetch, { randomUUID: () => 'random-connection-value' }) as (action?: string, renew?: boolean) => Promise<unknown>;
  return { fetch, create, code };
}

describe('session handshake without publication history', () => {
  it.each(['createSession', 'resumeSession'])('sends %s with session identity and connection credentials only', async action => {
    const f = fixture();
    expect(await f.create(action)).toMatchObject({ participantNumber: 23, configuration });
    const args = f.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toBe('https://test.invalid/apiData');
    expect(JSON.parse(String(args[1].body))).toEqual({ action, experimentID: 'EID', sessionId: 'S1',
      sessionProtocolVersion: 3, connectionId: 'random-connection-value',
      writeToken: 'random-connection-value'.repeat(2), connectionGeneration: 0,
      renewConnection: false, metadata: { test: 'current' }, sessionName: 'participant' });
    expect(f.code).not.toContain('__PUBLICATION_ID__');
    expect(f.code).not.toContain('__EXECUTION_REVISION__');
  });

  it('a repeated registration keeps the same connection credentials and session identity', async () => {
    const f = fixture();
    await f.create(); await f.create();
    const calls = f.fetch.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([, options]) => JSON.parse(String(options.body)))).toEqual([
      expect.objectContaining({ sessionId: 'S1', connectionId: 'random-connection-value' }),
      expect.objectContaining({ sessionId: 'S1', connectionId: 'random-connection-value' }),
    ]);
  });
});
