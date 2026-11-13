import process from 'node:process';
import console from 'node:console';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { compareReferences, exitCodes, renderComparison, recalculateCapture } from './core/comparison.mjs';
import { readCapture, readJson, writeArtifacts } from './core/artifacts.mjs';

const usage = `Cost benchmarks (local files only):
  compare --baseline DIR --candidate DIR --output NEW_DIR
    [--profile FILE] [--conditions FILE] [--calibration FILE] [--policy FILE]
    [--normalization FILE] [--window-seconds N] [--volumes 1,1000,10000]
  reference --source DIR --output NEW_DIR --reason TEXT
No command replaces an existing reference or contacts cloud services.`;
const json = value => JSON.stringify(value, null, 2) + '\n';
async function calculationSource() {
  const names = ['cli.mjs', 'core/comparison.mjs', 'core/calibration.mjs', 'core/budget.mjs', 'core/models.mjs', 'core/quantity.mjs', 'core/decimal.mjs', 'persistence/budget.mjs'];
  const files = await Promise.all(names.map(async name => {
    const bytes = await readFile(new URL(name, import.meta.url));
    return [name, { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') }];
  }));
  return { runtime: process.version, files: Object.fromEntries(files) };
}
function parse(args) {
  const command = args.shift();
  if (!['compare', 'reference'].includes(command)) throw new Error(usage);
  const flags = command === 'compare' ? ['baseline', 'candidate', 'output', 'profile', 'conditions', 'calibration', 'policy', 'normalization', 'window-seconds', 'volumes'] : ['source', 'output', 'reason'];
  const options = {};
  while (args.length) {
    const key = args.shift(), name = key?.slice(2), value = args.shift();
    if (!key?.startsWith('--') || !flags.includes(name) || options[name] !== undefined || !value || value.startsWith('--')) throw new Error('Invalid/repeated/missing argument: ' + key);
    options[name] = value;
  }
  for (const name of command === 'compare' ? ['baseline', 'candidate', 'output'] : ['source', 'output', 'reason']) if (!options[name]?.trim()) throw new Error('Required --' + name);
  return { command, options };
}
async function execute() {
  const args = process.argv.slice(2);
  if ((args.length === 1 && args[0] === '--help') || (args.length === 2 && ['compare', 'reference'].includes(args[0]) && args[1] === '--help')) { console.log(usage); return; }
  const { command, options } = parse(args);
  const output = path.resolve(options.output);
  for (const key of ['baseline', 'candidate', 'source']) if (options[key]) {
    const source = path.resolve(options[key]);
    if (output === source || output.startsWith(source + path.sep)) throw new Error('Output must be separate from captured inputs');
  }
  if (command === 'reference') {
    const captured = await readCapture(options.source);
    const check = compareReferences({ baseline: captured.bundle, candidate: captured.bundle });
    if (check.status !== 'passed') throw new Error('Cannot record an invalid, incomplete or failed reference: ' + check.status);
    await writeArtifacts(output, { ...captured.files, 'budget.json': json(recalculateCapture(captured.bundle)),
      'reference-record.json': json({ format: 1, recordedAt: new Date().toISOString(), reason: options.reason,
        source: captured.source, calculation: await calculationSource(), approvesConsumptionTarget: false, budgetRecalculated: true, policy: 'Recording evidence does not approve a cost target or bypass comparison limits' }),
      'README.md': '# Referencia registrada\n\n' + options.reason + '\n\nEsta captura conserva las mediciones originales; no aprueba su consumo como objetivo.\n',
    });
    console.log('Reference recorded: ' + output); return;
  }
  let report, sources = {};
  try {
    const baseline = await readCapture(options.baseline), candidate = await readCapture(options.candidate);
    sources = { baseline: baseline.source, candidate: candidate.source, calculation: await calculationSource() };
    const input = { baseline: baseline.bundle, candidate: candidate.bundle };
    for (const key of ['profile', 'conditions', 'calibration', 'policy', 'normalization']) if (options[key]) {
      const document = await readJson(options[key]); input[key] = document.value; sources[key] = { file: path.resolve(options[key]), ...document.identity };
    }
    if (options['window-seconds'] !== undefined) {
      input.windowSeconds = Number(options['window-seconds']);
      if (!Number.isSafeInteger(input.windowSeconds) || input.windowSeconds < 1) throw new Error('Invalid positive window seconds');
    }
    if (options.volumes) {
      if (!/^\d+(,\d+)*$/.test(options.volumes)) throw new Error('Invalid volumes');
      input.volumes = options.volumes.split(',').map(Number);
      if (input.volumes.some(value => !Number.isSafeInteger(value)) || new Set(input.volumes).size !== input.volumes.length) throw new Error('Invalid/duplicate volumes');
    }
    report = compareReferences(input);
  } catch (error) {
    report = { format: 1, status: 'invalid_input', exitCode: exitCodes.invalid_input, scope: 'Comparison could not validate its input files', scenarios: [], issues: [{ code: 'invalid_input', reason: error.message }] };
  }
  report.sources = sources;
  await writeArtifacts(output, { 'comparison.json': json(report), 'README.md': renderComparison(report) });
  console.log(`Comparison: ${report.status}; report: ${output}`); process.exitCode = report.exitCode;
}
try { await execute(); }
catch (error) { console.error(error.message); process.exitCode = exitCodes.invalid_input; }
