import { describe, expect, it, vi } from 'vitest';
import { publicRecoveryCode } from '../publicRecoveryCode';
import type { PublicExperimentCodeOptions } from '../publicCodeTypes';

function fixture(url = 'https://study.test/?PROLIFIC_PID=P') {
  const values = new Map<string, string>(), responses = [{ persisted: false }], assigned = vi.fn(), reloaded = vi.fn(), deleted = vi.fn();
  const rows = [{ id: 1, eventId: 'old-0', sequence: 0, payloadHash: 'a'.repeat(64), payload: { response: 'old' } }];
  const fetch = vi.fn(async (_url, request: RequestInit) => {
    const body = JSON.parse(String(request.body));
    return { ok: true, json: async () => ({ success: true, experimentID: 'EID', sessionId: body.sessionId,
      lifecycle: 'expired', export: { confirmed: true, requestedRevision: 2, confirmedRevision: 2 },
      acknowledged: body.data?.events.map(({ eventId, sequence, payloadHash }: Record<string, unknown>) => ({ eventId, sequence, payloadHash })) }) };
  });
  const api = new Function('responses', 'values', 'assigned', 'reloaded', 'deleted', 'fetch', 'rows', 'url', `
    const _publicSessionState = { lifecycle: 'expired' }, publicResponses = responses;
    const trialSessionId = 'old-session', _publicStorageKeys = { recoverySessions: 'recovery', sessionId: 'active', participant: 'participant', resumeTrial: 'checkpoint', captchaPassed: 'captcha' };
    const localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const current = new URL(url);
    const sessionStorage = { removeItem() {} }, window = { location: { href: current.href, assign: assigned, reload: reloaded, search: current.search, hash: current.hash } };
    const TrialDB = { getAll: async sessionId => rows.filter(row => sessionId === 'earlier-session'), deleteIds: deleted };
    const _publicEventEnvelope = async row => row;
    ${publicRecoveryCode({ DATA_API_URL: '/apiData', experimentID: 'EID' } as PublicExperimentCodeOptions)}
    return { offer: _offerNewPublicSession, recover: _recoverOlderPublicSessions, location: window.location };
  `)(responses, values, assigned, reloaded, deleted, fetch, rows, url) as { offer(panel: HTMLElement): void; recover(): Promise<void>; location: { href: string } };
  return { api, values, responses, assigned, reloaded, deleted, fetch };
}
describe('separate recovery and explicit new participation', () => {
  it('never starts automatically, and enables starting only after memory responses are backed', () => {
    const f = fixture(), panel = document.createElement('div'); f.api.offer(panel);
    const button = panel.querySelector('button')!;
    expect(f.assigned).not.toHaveBeenCalled(); expect(button.disabled).toBe(true);
    f.responses[0].persisted = true; f.api.offer(panel);
    expect(button.disabled).toBe(false); button.click();
    expect(JSON.parse(f.values.get('recovery')!)).toEqual(['old-session']);
    expect(f.values.get('active')).not.toBe('old-session'); expect(f.reloaded).toHaveBeenCalledOnce();
    expect(f.api.location.href).toBe('https://study.test/?PROLIFIC_PID=P');
  });
  it('recovers earlier rows into their original session and deletes only acknowledged IDs', async () => {
    const f = fixture(); f.values.set('recovery', JSON.stringify(['earlier-session']));
    await f.api.recover();
    expect(f.fetch.mock.calls.map(([, request]) => JSON.parse(String(request.body)).sessionId)).toEqual(['earlier-session', 'earlier-session', 'earlier-session']);
    expect(f.deleted).toHaveBeenCalledWith([1]); expect(JSON.parse(f.values.get('recovery')!)).toEqual([]);
  });
  it.each(['https://custom.study.test/run/?PROLIFIC_PID=P&x=1#consent', 'https://lab.github.io/study/index.html?workerId=W#step'])(
    'starts another participation at the current location %s', url => {
      const f = fixture(url), panel = document.createElement('div');
      f.responses[0].persisted = true; f.api.offer(panel); panel.querySelector('button')!.click();
      expect(f.reloaded).toHaveBeenCalledOnce(); expect(f.assigned).not.toHaveBeenCalled();
      expect(f.api.location.href).toBe(url);
      expect(JSON.parse(f.values.get('recovery')!)).toEqual(['old-session']);
    });
  it('keeps recovery references and payloads when a received acknowledgement is for another event', async () => {
    const f = fixture(); f.values.set('recovery', JSON.stringify(['earlier-session']));
    f.fetch.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, experimentID: 'EID', sessionId: 'earlier-session', lifecycle: 'expired' }) }));
    f.fetch.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, experimentID: 'EID', sessionId: 'earlier-session', acknowledged: [{ eventId: 'other' }] }) }));
    await expect(f.api.recover()).rejects.toThrow(); expect(f.deleted).not.toHaveBeenCalled();
    expect(JSON.parse(f.values.get('recovery')!)).toEqual(['earlier-session']);
  });
});
