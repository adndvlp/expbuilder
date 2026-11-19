import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { createPublicGenerator } from '../../api/persistence-e2e/public-generator.mjs';

test('the shared fixture uses the real public authoring entry without supplying retired generator parameters', async t => {
  const root = fileURLToPath(new URL('../../', import.meta.url)), temp = await mkdtemp(path.join(tmpdir(), 'public-cost-generator-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const origin = 'http://127.0.0.1:3000', calls = [], originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { calls.push(url); return { ok: true, json: async () => ({ tokens: [], separator: '_' }) }; };
  t.after(() => { globalThis.fetch = originalFetch; });
  const generate = await createPublicGenerator({ root, temp, origin });
  const options = { experimentID: 'fixture-study', useStorage: 'googledrive',
    firebaseWebConfig: { apiKey: 'demo', projectId: 'demo-public-persistence' },
    settings: { batchConfig: { useIndexedDB: false, batchSize: 7, resumeTimeoutMinutes: 45 },
      recruitmentConfig: { platform: 'prolific', prolificCompletionCode: 'never-bake-this' },
      captchaConfig: { enabled: true, provider: 'recaptcha', siteKey: 'never-bake-this' } },
    branchingEvaluation: '', baseCode: 'const branchParameters = null; if (branchParameters) Object.entries(branchParameters); jsPsych.run([]);' };
  const first = await generate(options);
  assert.doesNotThrow(() => new Function(first));
  assert.ok(first.includes(origin + '/apiData'));
  assert.ok(first.includes('demo-public-persistence'));
  assert.ok(!first.includes('never-bake-this'));
  assert.ok(!first.includes('_PUBLIC_PUBLICATION_CONFIG'));
  const changed = await generate({ ...options, settings: { batchConfig: { useIndexedDB: true, batchSize: 0, resumeTimeoutMinutes: 1 } } });
  assert.equal(changed, first, 'Current HTML must not change with editable settings');
  assert.deepEqual(calls, [origin + '/api/session-name-config/fixture-study', origin + '/api/session-name-config/fixture-study']);
  await assert.rejects(generate({ ...options, baseCode: 'jsPsych.run([]);' }), /consumer/);
  assert.equal(await generate(options), first, 'A failed generation must not contaminate the next case');
});
