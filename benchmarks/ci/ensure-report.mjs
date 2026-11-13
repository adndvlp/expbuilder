import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath } from 'node:url';
import { readJson } from '../core/artifacts.mjs';

export async function ensureReport(output) {
  if (!output) throw new Error('Required report directory');
  try {
    const { value } = await readJson(path.join(output, 'run.json'));
    if (value.format !== 1 || value.finished !== true || ![0, 2, 3, 4, 5, 6, 130, 143].includes(value.exitCode)) throw new Error('Invalid/unfinished benchmark run');
    return value.exitCode;
  } catch (error) {
    await mkdir(output, { recursive: true });
    const diagnostic = { format: 1, status: 'incomplete', exitCode: 3, finished: true, error: 'Missing, invalid or unfinished benchmark report. Setup, cancellation or runner failure: ' + error.message };
    await writeFile(path.join(output, 'setup-failure.json'), JSON.stringify(diagnostic, null, 2) + '\n');
    try { await writeFile(path.join(output, 'run.json'), JSON.stringify(diagnostic, null, 2) + '\n', { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    return 3;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await ensureReport(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 6; }
}
