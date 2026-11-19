import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function preparePersistenceSdk() {
  const directory = process.env.PERSISTENCE_SDK_DIR || path.join(tmpdir(), 'expbuilder-firebase-9.23.0');
  await mkdir(directory, { recursive: true });
  const expected = {
    'firebase-app-compat.js': '1586b85e7ecc265235f1e224c1ac1b44a2f3edb19e50e0ed369491f9bb239478',
    'firebase-database-compat.js': '1fdd331f8fd0448f9d7ce97573cb828a83aad7a7bb2c4da0e75fdb9563eef129',
  };
  for (const [name, hash] of Object.entries(expected)) {
    const file = path.join(directory, name); let bytes;
    try { bytes = await readFile(file); } catch { /* Download the pinned public SDK below. */ }
    if (!bytes) {
      const response = await fetch(`https://www.gstatic.com/firebasejs/9.23.0/${name}`, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Could not download Firebase 9.23.0. Set PERSISTENCE_SDK_DIR to its verified local files.');
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Firebase SDK checksum mismatch: ${name}`);
    await writeFile(file, bytes);
  }
  return directory;
}
