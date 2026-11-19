import { existingExperiment, fetchMock, firestoreMocks, okJson, registerExperimentsettingsHooks } from './testHarness';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useExperimentSettings } from '../../../pages/ExperimentPanel/ExperimentSettings/hooks/useExperimentSettings';

describe('independent public settings save', () => {
  registerExperimentsettingsHooks();
  async function loaded() {
    firestoreMocks.getDoc.mockResolvedValueOnce(existingExperiment({}));
    fetchMock().mockResolvedValueOnce(okJson({ tokens: [], separator: '_' }));
    const hook = renderHook(() => useExperimentSettings('study'));
    await waitFor(() => expect(hook.result.current.experimentExists).toBe(true));
    return hook;
  }
  it('AC02: waits for confirmation, retains edits after failure and retries the same single write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await loaded();
    act(() => result.current.setConfig({ useIndexedDB: false, batchSize: 3, resumeTimeoutMinutes: 1 }));
    let rejectSave!: (error: Error) => void;
    firestoreMocks.setDoc.mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
    let pending!: Promise<void>;
    act(() => { pending = result.current.handleSave(); });
    expect(result.current.saving).toBe(true); expect(result.current.message).toBeNull();
    await act(async () => { rejectSave(new Error('Denied')); await pending; });
    expect(result.current.message?.type).toBe('error'); expect(result.current.saving).toBe(false);
    expect(result.current.config).toEqual({ useIndexedDB: false, batchSize: 3, resumeTimeoutMinutes: 1 });
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.message?.type).toBe('success');
    expect(firestoreMocks.setDoc.mock.calls[0]).toEqual(firestoreMocks.setDoc.mock.calls[1]);
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['missing batch group', 'config', null],
    ['unknown batch field', 'config', { useIndexedDB: true, batchSize: 1, resumeTimeoutMinutes: 1, extra: 1 }],
    ['missing recruitment field', 'recruitment', { platform: 'none' }],
    ['missing CAPTCHA field', 'captcha', { enabled: false, provider: 'hcaptcha' }],
    ['IndexedDB boolean', 'config', { useIndexedDB: 'false', batchSize: 1, resumeTimeoutMinutes: 1 }],
    ['unsafe batch', 'config', { useIndexedDB: true, batchSize: 9007199254740992, resumeTimeoutMinutes: 1 }],
    ['negative batch', 'config', { useIndexedDB: true, batchSize: -1, resumeTimeoutMinutes: 1 }],
    ['fractional batch', 'config', { useIndexedDB: true, batchSize: 1.5, resumeTimeoutMinutes: 1 }],
    ['invalid platform', 'recruitment', { platform: 'other', prolificCompletionCode: '' }],
    ['non-string code', 'recruitment', { platform: 'prolific', prolificCompletionCode: 1 }],
    ['CAPTCHA boolean', 'captcha', { enabled: 'false', provider: 'hcaptcha', siteKey: '' }],
    ['invalid CAPTCHA provider', 'captcha', { enabled: false, provider: 'other', siteKey: '' }],
    ['non-string site key', 'captcha', { enabled: false, provider: 'hcaptcha', siteKey: 1 }],
    ['empty enabled CAPTCHA key', 'captcha', { enabled: true, provider: 'hcaptcha', siteKey: ' \n\t' }],
  ])('rejects %s before any write', async (_name, group, value) => {
    const { result } = await loaded();
    act(() => {
      if (group === 'config') result.current.setConfig(value as never);
      if (group === 'recruitment') result.current.setRecruitmentConfig(value as never);
      if (group === 'captcha') result.current.setCaptchaConfig(value as never);
    });
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.message?.type).toBe('error'); expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
  it.each([0, 1, 9, Number.MAX_SAFE_INTEGER])('keeps batch %s and timeout boundaries without imposing batch 1', async batchSize => {
    const { result } = await loaded();
    act(() => result.current.setConfig({ useIndexedDB: true, batchSize, resumeTimeoutMinutes: 1440 }));
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.message?.type).toBe('success');
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith('experiments/study', expect.objectContaining({ batchConfig: { useIndexedDB: true, batchSize, resumeTimeoutMinutes: 1440 } }), { merge: true });
  });
});
