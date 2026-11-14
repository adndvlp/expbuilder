import { spawn } from 'node:child_process';
import { open, readdir, mkdir, writeFile, rename, lstat, realpath, stat, truncate } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath, URL } from 'node:url';
import { setTimeout, clearTimeout } from 'node:timers';
import { readCapture, readJson } from '../core/artifacts.mjs';
import { exitCodes } from '../core/comparison.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const cancelledCode = signal => signal === 'SIGINT' ? 130 : 143;
const knownCodes = new Set([...Object.values(exitCodes), 130, 143]);

// A separate process group also stops Java/emulator descendants on cancellation.
export async function runCommand({ command, args, log, signal, logLimit = 2 * 1024 * 1024, quiet = false }) {
  const file = await open(log, 'wx');
  let loggedBytes = 0, omittedBytes = 0, startError, logError, writes = Promise.resolve();
  const interruption = () => signal?.reason === 'SIGINT' ? 'SIGINT' : 'SIGTERM';
  if (signal?.aborted) { await file.close(); return { code: null, signal: interruption(), loggedBytes, omittedBytes }; }
  const child = spawn(command, args, { cwd: root, env: process.env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const receive = chunk => {
    const kept = chunk.subarray(0, Math.max(0, logLimit - loggedBytes));
    loggedBytes += kept.length; omittedBytes += chunk.length - kept.length;
    if (kept.length) {
      if (!quiet) process.stdout.write(kept);
      writes = writes.then(() => file.writeFile(kept)).catch(error => { logError = error; });
    }
  };
  child.stdout.on('data', receive); child.stderr.on('data', receive);
  child.on('error', error => { startError = error; });
  const kill = kind => {
    try { if (process.platform === 'win32') child.kill(kind); else if (child.pid) process.kill(-child.pid, kind); }
    catch (error) { if (error.code !== 'ESRCH') startError ||= error; }
  };
  let timer;
  const abort = () => { kill('SIGTERM'); timer = setTimeout(() => kill('SIGKILL'), 3000); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const result = await new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
    await writes;
    if (startError || logError) throw startError || logError;
    return { ...result, ...(signal?.aborted ? { code: null, signal: interruption() } : {}), loggedBytes, omittedBytes };
  } finally {
    signal?.removeEventListener('abort', abort); clearTimeout(timer);
    if (signal?.aborted) kill('SIGKILL');
    await file.close();
  }
}

async function artifactBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Artifact symlinks are not supported');
    bytes += entry.isDirectory() ? await artifactBytes(file) : (await lstat(file)).size;
  }
  return bytes;
}
async function canonical(file) {
  try { return await realpath(file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await canonical(path.dirname(file)), path.basename(file));
  }
}
export async function checkCosts(options, { run = runCommand, signal } = {}) {
  if (!options.output) throw new Error('Required --output NEW_DIRECTORY');
  const output = await canonical(path.resolve(options.output)), baseline = await canonical(path.resolve(options.baseline || path.join(root, 'benchmarks/references/persistence-b0-2026-11-14')));
  const candidate = options.candidate ? await canonical(path.resolve(options.candidate)) : path.join(output, 'capture');
  for (const input of [baseline, ...(options.candidate ? [candidate] : [])]) {
    if (output === input || output.startsWith(input + path.sep) || input.startsWith(output + path.sep)) throw new Error('Output must be separate from captured inputs');
  }
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // Exclusive directory: no implicit replacement of a report/reference.
  const report = { format: 1, startedAt: new Date().toISOString(), finished: false, status: 'incomplete', exitCode: 3,
    baseline, candidate, reusedCapture: Boolean(options.candidate), stages: [] };
  const save = async () => {
    await writeFile(path.join(output, 'run.json.tmp'), json(report));
    await rename(path.join(output, 'run.json.tmp'), path.join(output, 'run.json'));
  };
  const stage = async (name, args) => {
    const record = { name, startedAt: new Date().toISOString(), log: name + '.log' };
    report.stages.push(record); await save();
    const result = await run({ name, command: process.execPath, args, log: path.join(output, record.log), signal });
    Object.assign(record, result, { finishedAt: new Date().toISOString() }); await save();
    if (result.signal) throw Object.assign(new Error(name + ' cancelled: ' + result.signal), { exitCode: cancelledCode(result.signal) });
    return result.code;
  };
  let current = 'unit';
  await save();
  try {
    const tests = (await readdir(path.join(root, 'benchmarks/test'))).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(root, 'benchmarks/test', name));
    const unit = await stage('unit', ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=junit', '--test-reporter-destination=' + path.join(output, 'unit.xml'), ...tests]);
    const unitReport = path.join(output, 'unit.xml');
    const unitBytes = await stat(unitReport).catch(() => null);
    if (unitBytes?.size > 2 * 1024 * 1024) {
      await truncate(unitReport, 2 * 1024 * 1024);
      report.truncatedArtifacts = [{ file: 'unit.xml', originalBytes: unitBytes.size, retainedBytes: 2 * 1024 * 1024 }];
      throw new Error('JUnit report exceeded 2MiB and was truncated; see unit.log');
    }
    if (unit !== 0) throw Object.assign(new Error('Benchmark unit tests failed'), { exitCode: 5 });
    if (!unitBytes?.size) throw Object.assign(new Error('Missing JUnit report'), { exitCode: 3 });
    if (!options.candidate) {
      current = 'measurement';
      const measured = await stage('measurement', [path.join(root, 'benchmarks/persistence/run.mjs'), '--output', candidate]);
      if (measured !== 0) throw Object.assign(new Error('Benchmark measurement failed'), { exitCode: 5 });
    }
    current = 'measurement';
    try { await readCapture(candidate); }
    catch (error) { throw Object.assign(new Error('Missing/invalid capture: ' + error.message), { exitCode: 3 }); }
    current = 'comparison';
    const args = [path.join(root, 'benchmarks/cli.mjs'), 'compare', '--baseline', baseline, '--candidate', candidate,
      '--output', path.join(output, 'comparison'), '--policy', path.resolve(options.policy || path.join(root, 'benchmarks/policies/no-increases.json'))];
    if (options.normalization) args.push('--normalization', path.resolve(options.normalization));
    const code = await stage('comparison', args);
    let comparison;
    try { comparison = (await readJson(path.join(output, 'comparison/comparison.json'))).value; }
    catch (error) { throw Object.assign(new Error('Missing/invalid comparison: ' + error.message), { exitCode: code === 0 ? 3 : 6 }); }
    if (comparison.format !== 1 || !Array.isArray(comparison.scenarios) || exitCodes[comparison.status] !== code || comparison.exitCode !== code) {
      throw new Error('Comparison report and process exit code disagree');
    }
    report.exitCode = code; report.status = comparison.status;
    if (code !== 0) report.failedStage = current;
  } catch (error) {
    report.exitCode = knownCodes.has(error.exitCode) ? error.exitCode : 6;
    report.status = [130, 143].includes(report.exitCode) ? 'cancelled' : Object.keys(exitCodes).find(key => exitCodes[key] === report.exitCode);
    report.failedStage = current; report.error = error.message;
  } finally {
    report.finished = true; report.finishedAt = new Date().toISOString();
    report.artifactBytes = await artifactBytes(output);
    if (report.artifactBytes > 40 * 1024 * 1024) {
      report.exitCode = 6; report.status = 'invalid_input'; report.error = 'Combined artifacts exceed 40MiB';
    }
    await save();
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new globalThis.AbortController();
  const interrupt = () => controller.abort('SIGINT'), terminate = () => controller.abort('SIGTERM');
  process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
  try {
    const args = process.argv.slice(2), options = {};
    while (args.length) {
      const flag = args.shift(), key = flag?.slice(2), value = args.shift();
      if (!['output', 'baseline', 'candidate', 'policy', 'normalization'].includes(key) || !flag.startsWith('--') || !value || value.startsWith('--') || options[key]) throw new Error('Invalid/repeated/missing argument: ' + flag);
      options[key] = value;
    }
    const report = await checkCosts(options, { signal: controller.signal });
    console.log(`Cost check: ${report.status}; report: ${path.resolve(options.output)}`); process.exitCode = report.exitCode;
  } catch (error) { console.error(error.message); process.exitCode = 6; }
  finally { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); }
}
