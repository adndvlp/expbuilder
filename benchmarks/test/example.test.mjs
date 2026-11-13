import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { describe, it } from 'node:test';
import { buildKnownBudget } from '../examples/known-budget.mjs';

describe('reproducible monetary example', () => {
  it('uses separate nam5 and us-central1 prices and produces a budget without a cloud request', () => {
    const previous = globalThis.fetch;
    globalThis.fetch = () => { throw new Error('Example must remain offline'); };
    try {
      const report = buildKnownBudget();
      assert.equal(report.status, 'complete');
      assert.equal(report.profile.rates.reads.location, 'nam5');
      assert.equal(report.profile.rates.cpu.location, 'us-central1');
      assert.equal(report.projections.find(p => p.sessions === 1000).total, '0.110125');
      assert.match(report.scope, /arithmetic/i);
      assert.match(report.scope, /not.*persistence/i);
    } finally { globalThis.fetch = previous; }
  });
  it('prints reproducible JSON and Markdown while explicitly limiting the scope of the example', () => {
    const script = fileURLToPath(new URL('../examples/known-budget.mjs', import.meta.url));
    const output = execFileSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
    assert.equal(JSON.parse(output).projections[2].total, '0.110125');
    const markdown = execFileSync(process.execPath, [script], { encoding: 'utf8' });
    assert.match(markdown, /0.110125/);
    assert.match(markdown, /gross usage/);
  });
});
