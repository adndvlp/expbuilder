import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { checkCosts, runCommand } from '../ci/check.mjs';
import { ensureReport } from '../ci/ensure-report.mjs';

const json = value => JSON.stringify(value) + '\n';
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'cost-ci-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseline = path.join(directory, 'baseline'), output = path.join(directory, 'output');
  await mkdir(baseline);
  for (const name of ['reference.json', 'budget.json']) await writeFile(path.join(baseline, name), '{}\n');
  const calls = [];
  const run = async job => {
    calls.push(job);
    await writeFile(job.log, job.name + ' evidence\n');
    if (job.name === 'unit') await writeFile(path.join(output, 'unit.xml'), '<testsuites/>');
    if (job.name === 'measurement') {
      await mkdir(path.join(output, 'capture'));
      for (const name of ['reference.json', 'budget.json']) await writeFile(path.join(output, 'capture', name), '{}\n');
    }
    if (job.name === 'comparison') {
      await mkdir(path.join(output, 'comparison'));
      await writeFile(path.join(output, 'comparison/comparison.json'), json({ format: 1, status: 'passed', exitCode: 0, scenarios: [] }));
    }
    return { code: 0, signal: null };
  };
  return { baseline, output, calls, run };
}
test('one check runs unit, measurement and comparison once, keeps evidence and never writes its reference', async t => {
  const f = await fixture(t), before = await readFile(path.join(f.baseline, 'reference.json'));
  const result = await checkCosts(f, { run: f.run });
  assert.equal(result.exitCode, 0); assert.equal(result.status, 'passed');
  assert.deepEqual(f.calls.map(job => job.name), ['unit','measurement','comparison']);
  assert.ok(f.calls.every(job => job.command === process.execPath));
  assert.ok(!JSON.stringify(f.calls).includes('benchmark:cost:reference'));
  assert.deepEqual(await readFile(path.join(f.baseline, 'reference.json')), before);
  const saved = JSON.parse(await readFile(path.join(f.output, 'run.json')));
  assert.equal(saved.finished, true); assert.ok(saved.artifactBytes > 0);
  assert.equal(await ensureReport(f.output), 0);
});
test('a failing unit suite preserves its JUnit/log and skips expensive measurement', async t => {
  const f = await fixture(t);
  const result = await checkCosts(f, { run: async job => { await f.run(job); return { code: 1 }; } });
  assert.equal(result.exitCode, 5); assert.equal(result.failedStage, 'unit');
  assert.equal(f.calls.length, 1);
  assert.match(await readFile(path.join(f.output, 'unit.xml'), 'utf8'), /testsuites/);
  assert.match(await readFile(path.join(f.output, 'unit.log'), 'utf8'), /evidence/);
});
test('a failed emulator/browser run preserves its partial report and does not proceed to comparison', async t => {
  const f = await fixture(t);
  const result = await checkCosts(f, { run: async job => { const result = await f.run(job); return job.name === 'measurement' ? { code: 1 } : result; } });
  assert.equal(result.exitCode, 5); assert.equal(result.failedStage, 'measurement');
  assert.deepEqual(f.calls.map(job => job.name), ['unit', 'measurement']);
  assert.match(await readFile(path.join(f.output, 'measurement.log'), 'utf8'), /evidence/);
});
test('exit zero without capture or comparison evidence is incomplete, never passed', async t => {
  for (const stage of ['measurement', 'comparison']) {
    const f = await fixture(t);
    const result = await checkCosts(f, { run: job => job.name === stage ? Promise.resolve({ code: 0 }) : f.run(job) });
    assert.equal(result.exitCode, 3, stage); assert.equal(result.failedStage, stage);
  }
});
test('every comparison error code is propagated with the failure report intact', async t => {
  const statuses = { 2: 'regression', 3: 'incomplete', 4: 'incompatible', 5: 'functional_failure', 6: 'invalid_input' };
  for (const [code, status] of Object.entries(statuses)) {
    const f = await fixture(t);
    const result = await checkCosts(f, { run: async job => {
      await f.run(job);
      if (job.name !== 'comparison') return { code: 0 };
      await writeFile(path.join(f.output, 'comparison/comparison.json'), json({ format: 1, status, exitCode: Number(code), scenarios: [] }));
      return { code: Number(code) };
    } });
    assert.equal(result.exitCode, Number(code)); assert.equal(await ensureReport(f.output), Number(code));
  }
});
test('reusing an explicit capture skips measurement and forwards the chosen policy/normalization', async t => {
  const f = await fixture(t);
  const result = await checkCosts({ ...f, candidate: f.baseline, normalization: 'benchmarks/ci/normalization.json' }, { run: f.run });
  assert.equal(result.exitCode, 0); assert.deepEqual(f.calls.map(job => job.name), ['unit','comparison']);
  assert.ok(f.calls[1].args.includes('--normalization')); assert.ok(f.calls[1].args.includes('--policy'));
});
test('spawn errors, mismatched comparison receipts and cancellations cannot become success', async t => {
  for (const failure of ['spawn', 'receipt', 'cancel']) {
    const f = await fixture(t);
    const result = await checkCosts(f, { run: async job => {
      if (failure === 'spawn') throw new Error('Cannot start child');
      await f.run(job);
      if (failure === 'cancel') return { code: null, signal: 'SIGTERM' };
      if (job.name === 'comparison') return { code: 2 };
      return { code: 0 };
    } });
    assert.equal(result.exitCode, failure === 'cancel' ? 143 : 6);
    assert.equal(JSON.parse(await readFile(path.join(f.output, 'run.json'))).finished, true);
  }
});
test('existing outputs and outputs inside captured inputs are rejected without changing files', async t => {
  const f = await fixture(t);
  await assert.rejects(checkCosts({ ...f, output: f.baseline }, { run: f.run }), /separate/);
  await mkdir(f.output); await writeFile(path.join(f.output, 'keep'), 'evidence');
  await assert.rejects(checkCosts(f, { run: f.run }), /exist/i);
  assert.equal(await readFile(path.join(f.output, 'keep'), 'utf8'), 'evidence');
  const alias = path.join(path.dirname(f.output), 'alias');
  await symlink(f.baseline, alias);
  await assert.rejects(checkCosts({ ...f, output: path.join(alias, 'new-report') }, { run: f.run }), /separate/);
});
test('an oversized JUnit report is bounded, identified as truncated and cannot approve the run', async t => {
  const f = await fixture(t);
  const result = await checkCosts(f, { run: async job => {
    await f.run(job);
    if (job.name === 'unit') await writeFile(path.join(f.output, 'unit.xml'), 'x'.repeat(3 * 1024 * 1024));
    return { code: 0 };
  } });
  assert.equal(result.exitCode, 6); assert.equal(f.calls.length, 1);
  assert.equal((await stat(path.join(f.output, 'unit.xml'))).size, 2 * 1024 * 1024);
  assert.match(result.error, /JUnit.*truncated/);
});
test('setup failure, unfinished or malformed runs leave a diagnostic and a nonzero result', async t => {
  const f = await fixture(t);
  assert.equal(await ensureReport(f.output), 3);
  assert.equal(JSON.parse(await readFile(path.join(f.output, 'run.json'))).status, 'incomplete');
  await writeFile(path.join(f.output, 'run.json'), '{broken');
  assert.equal(await ensureReport(f.output), 3);
  assert.match(await readFile(path.join(f.output, 'setup-failure.json'), 'utf8'), /invalid|missing|unfinished/i);
});
test('real subprocess logs are bounded, retain truncation counts and report spawn errors', async t => {
  const f = await fixture(t); await mkdir(f.output);
  const result = await runCommand({ command: process.execPath, args: ['-e', 'process.stdout.write("x".repeat(4096))'], log: path.join(f.output, 'child.log'), logLimit: 256, quiet: true });
  assert.equal(result.code, 0); assert.equal(result.loggedBytes, 256); assert.equal(result.omittedBytes, 3840);
  await assert.rejects(runCommand({ command: '/no/such/cost-command', args: [], log: path.join(f.output, 'error.log'), quiet: true }), /ENOENT/);
});
test('cancelling a real subprocess stops it and records the signal', async t => {
  const f = await fixture(t); await mkdir(f.output);
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(), 150); t.after(() => clearTimeout(timer));
  const result = await runCommand({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], log: path.join(f.output, 'cancel.log'), signal: controller.signal, quiet: true });
  assert.equal(result.signal, 'SIGTERM');
});
test('an interrupt retains SIGINT instead of relabeling it as SIGTERM', async t => {
  const f = await fixture(t); await mkdir(f.output);
  const controller = new globalThis.AbortController(); controller.abort('SIGINT');
  const result = await runCommand({ command: '/must/not/start', args: [], log: path.join(f.output, 'interrupt.log'), signal: controller.signal, quiet: true });
  assert.equal(result.signal, 'SIGINT');
});
test('cancelling also stops a descendant process instead of leaving a local consumer running', async t => {
  const f = await fixture(t); await mkdir(f.output);
  const pidFile = path.join(f.output, 'descendant.pid'), controller = new globalThis.AbortController();
  const script = `const child = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio:'ignore'}); require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(child.pid)); setInterval(() => {}, 1000);`;
  const running = runCommand({ command: process.execPath, args: ['-e', script], log: path.join(f.output, 'tree.log'), signal: controller.signal, quiet: true });
  t.after(() => controller.abort());
  let pid;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { pid = Number(await readFile(pidFile, 'utf8')); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  assert.ok(pid > 0, 'Descendant must start before cancellation');
  controller.abort(); await running;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { process.kill(pid, 0); await new Promise(resolve => setTimeout(resolve, 20)); }
    catch (error) { assert.equal(error.code, 'ESRCH'); return; }
  }
  assert.fail('Cancelled descendant is still running');
});
