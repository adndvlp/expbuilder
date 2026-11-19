import { readFile, stat, mkdir, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Buffer } from 'node:buffer';
const maximumBytes = 16 * 1024 * 1024;
export async function readJson(file) {
  if ((await stat(file)).size > maximumBytes) throw new Error('Benchmark input exceeds 16MiB: ' + file);
  const bytes = await readFile(file);
  return { value: JSON.parse(bytes.toString('utf8')), bytes, identity: { bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') } };
}
export async function readCapture(directory) {
  const reference = await readJson(path.join(directory, 'reference.json')), budgets = await readJson(path.join(directory, 'budget.json'));
  if (reference.bytes.byteLength + budgets.bytes.byteLength > maximumBytes) throw new Error('Captured benchmark exceeds 16MiB');
  return { bundle: { reference: reference.value, budgets: budgets.value },
    source: { directory: path.resolve(directory), files: { 'reference.json': reference.identity, 'budget.json': budgets.identity } },
    files: { 'reference.json': reference.bytes, 'budget.json': budgets.bytes } };
}
export async function writeArtifacts(directory, files) {
  const output = path.resolve(directory);
  try { await lstat(output); throw new Error('Output exists; choose a new directory: ' + output); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const total = Object.values(files).reduce((sum, value) => sum + Buffer.byteLength(value), 0);
  if (total > maximumBytes) throw new Error('Benchmark artifacts exceed 16MiB');
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = await mkdtemp(path.join(path.dirname(output), '.cost-artifacts-'));
  try {
    const { writeFile } = await import('node:fs/promises');
    for (const [name, value] of Object.entries(files)) {
      if (!/^[a-zA-Z][\w.-]*$/.test(name)) throw new Error('Invalid artifact name');
      await writeFile(path.join(temporary, name), value, { flag: 'wx' });
    }
    await rename(temporary, output);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
