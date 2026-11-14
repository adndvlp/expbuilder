import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { changedFiles } from '../ci/select.mjs';

const command = fileURLToPath(new URL('../ci/select.mjs', import.meta.url));
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ci-history-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source'), clone = path.join(directory, 'checkout');
  await mkdir(source);
  const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (...args) => git('-c', 'user.name=CI test', '-c', 'user.email=ci@example.invalid', '-c', 'commit.gpgsign=false', 'commit', ...args);
  git('init', '--initial-branch=main');
  await writeFile(path.join(source, 'README.md'), 'initial\n'); git('add', '.'); commit('-m', 'initial');
  const base = git('rev-parse', 'HEAD');
  await mkdir(path.join(source, 'benchmarks')); await writeFile(path.join(source, 'benchmarks/change.mjs'), 'export const value = 1;\n');
  git('add', '.'); commit('-m', 'before amend'); const before = git('rev-parse', 'HEAD');
  commit('--amend', '-m', 'after amend'); const after = git('rev-parse', 'HEAD');
  execFileSync('git', ['clone', '--no-local', '--no-tags', '--quiet', source, clone], { stdio: 'pipe' });
  const event = path.join(directory, 'event.json'), output = path.join(directory, 'outputs');
  const run = async (eventName, payload) => {
    await writeFile(event, JSON.stringify(payload)); await writeFile(output, '');
    const result = spawnSync(process.execPath, [command], { cwd: clone, encoding: 'utf8', env: { ...process.env,
      GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: event, GITHUB_OUTPUT: output } });
    return { ...result, output: await readFile(output, 'utf8') };
  };
  return { git, clone, base, before, after, run };
}

test('an amended push whose previous SHA is absent from a full checkout runs both checks', async t => {
  const f = await fixture(t);
  assert.equal(f.git('cat-file', '-t', f.before), 'commit', 'The local source still has the amended-away object');
  assert.equal(execFileSync('git', ['-C', f.clone, 'rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim(), 'false');
  assert.notEqual(spawnSync('git', ['-C', f.clone, 'cat-file', '-e', f.before]).status, 0);
  const result = await f.run('push', { before: f.before, after: f.after, forced: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'persistence=true\nbenchmark=true\n');
  assert.match(result.stderr, /base commit.*unavailable.*both checks/i);
});

test('a PR with a missing base also runs both checks', async t => {
  const f = await fixture(t);
  const result = await f.run('pull_request', { pull_request: { base: { sha: f.before }, head: { sha: f.after } } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'persistence=true\nbenchmark=true\n');
});

test('available push and PR histories still select only checks matching the actual diff', async t => {
  const f = await fixture(t);
  for (const [event, payload] of [['push', { before: f.base, after: f.after }],
    ['pull_request', { pull_request: { base: { sha: f.base }, head: { sha: f.after } } }]]) {
    const result = await f.run(event, payload);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'persistence=false\nbenchmark=true\n');
    assert.doesNotMatch(result.stderr, /unavailable/);
  }
  const unchanged = await f.run('push', { before: f.after, after: f.after });
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.equal(unchanged.output, 'persistence=false\nbenchmark=false\n');
});

test('an unavailable event head is an error and cannot publish selection outputs', async t => {
  const f = await fixture(t);
  const result = await f.run('push', { before: f.base, after: f.before });
  assert.notEqual(result.status, 0);
  assert.equal(result.output, '');
  assert.match(result.stderr, /head commit.*unavailable/i);
});

test('repository and diff failures are still errors even when a fallback would run more checks', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40), problem = Object.assign(new Error('repository unavailable'), { status: 128 });
  assert.throws(() => changedFiles('push', { before: a, after: b }, () => { throw problem; }), error => error === problem);
  assert.throws(() => changedFiles('push', { before: a, after: b }, args => {
    if (args[0] === 'diff') throw problem;
    return '';
  }), error => error === problem);
});
