import { describe, expect, it, vi } from 'vitest';
import { publicPresenceCode } from '../publicPresenceCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

async function fixture() {
  const calls: string[] = [], listeners: Array<(snapshot: { val(): boolean }) => void> = [];
  let expired = false;
  const state = { success: true, decision: 'resume_allowed', sessionProtocolVersion: 3, lifecycle: 'active', connection: { id: 'C1', generation: 1, phase: 'connecting' } };
  const ref = { onDisconnect: () => ({ set: async () => { calls.push('arm'); } }), set: async () => { calls.push('publish'); },
    on: (_: string, callback: typeof listeners[number]) => listeners.push(callback), off() {} };
  const handshake = vi.fn(async (action: string) => { calls.push(action); return expired ? { ...state, lifecycle: 'expired', decision: 'session_expired' }
    : { ...state, connection: { ...state.connection, phase: action === 'activateConnection' ? 'active' : 'connecting' } }; });
  const originalResume = vi.fn();
  const runtime = { pauseExperiment: vi.fn(), resumeExperiment: originalResume };
  const code = publicPresenceCode({ experimentID: 'EID' } as PublicExperimentCodeOptions);
  const api = new Function('database', 'handshake', 'runtime', `
    const db = database, _publicWriter = { connectionId: 'C1', writeToken: 'token' }, trialSessionId = 'S1';
    let _publicSessionState = ${JSON.stringify(state)};
    const window = { firebase: { database: { ServerValue: { TIMESTAMP: 123 } } } };
    const jsPsych = runtime, _setLoadingMsg = () => {}, _showLoading = () => {};
    const createSession = handshake, _hideLoading = () => {};
    let publicRecoveryMode = false, publicClosing = false;
    const publicResponses = [], _drainPublicResponses = async () => {}, _flushPublicBatches = async () => {};
    const BATCH_CONFIG = { useIndexedDB: true }, _publicPersistenceError = () => {}, publicFinishHandler = async () => {};
    ${code}
    return { connect: _connectPublicSession, retry: _retryPublicPresence, observe: _observePublicConnection, allowed: () => _publicConnected,
      invalidate: _adoptPublicClosure, recovered: () => publicRecoveryMode, state: () => _publicSessionState };
  `)({ ref: () => ref }, handshake, runtime) as { connect(): Promise<void>; retry(): Promise<void>; observe(): void; allowed(): boolean; invalidate(result: object): boolean; recovered(): boolean };
  return { api, calls, listeners, handshake, runtime, originalResume, expire: () => { expired = true; } };
}
describe('public connection handshake', () => {
  it('arms onDisconnect before publishing and confirms server activation before enabling progression', async () => {
    const f = await fixture(); await f.api.connect();
    expect(f.calls).toEqual(['arm', 'publish', 'activateConnection']); expect(f.api.allowed()).toBe(true);
  });
  it('pauses on network loss and handshakes again on reconnect without reloading', async () => {
    const f = await fixture(); await f.api.connect(); f.api.observe();
    f.listeners[0]({ val: () => true }); f.listeners[0]({ val: () => false });
    expect(f.api.allowed()).toBe(false); expect(f.runtime.pauseExperiment).toHaveBeenCalled();
    f.listeners[0]({ val: () => true }); await vi.waitFor(() => expect(f.api.allowed()).toBe(true));
    expect(f.calls).toEqual(['arm', 'publish', 'activateConnection', 'resumeSession', 'arm', 'publish', 'activateConnection']);
  });
  it('an expired reconnect recovers pending responses and never resumes execution', async () => {
    const f = await fixture(); await f.api.connect(); f.api.observe();
    f.listeners[0]({ val: () => true }); f.listeners[0]({ val: () => false }); f.expire();
    f.listeners[0]({ val: () => true }); await vi.waitFor(() => expect(f.api.recovered()).toBe(true));
    expect(f.api.allowed()).toBe(false); expect(f.originalResume).not.toHaveBeenCalled();
  });
  it('a failed reconnect can be retried explicitly without waiting for another network event', async () => {
    const f = await fixture(); await f.api.connect(); f.api.observe();
    f.listeners[0]({ val: () => true }); f.listeners[0]({ val: () => false });
    f.handshake.mockRejectedValueOnce(new Error('temporary outage'));
    f.listeners[0]({ val: () => true });
    await vi.waitFor(() => expect(f.handshake).toHaveBeenCalledWith('resumeSession', true));
    expect(f.api.allowed()).toBe(false);
    await f.api.retry(); expect(f.api.allowed()).toBe(true);
    expect(f.originalResume).toHaveBeenCalledTimes(1);
  });

  it('a rejected writer permission blocks progression until a new handshake succeeds', async () => {
    const f = await fixture(); await f.api.connect(); f.api.observe();
    f.api.invalidate({ decision: 'resume_required', lifecycle: 'active' });
    expect(f.api.allowed()).toBe(false);
    f.runtime.resumeExperiment(); expect(f.originalResume).not.toHaveBeenCalled();
    await f.api.retry(); expect(f.api.allowed()).toBe(true);
  });

});
