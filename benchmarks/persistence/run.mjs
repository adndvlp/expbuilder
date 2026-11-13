import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import net from 'node:net';
import { preparePersistenceSdk } from '../../scripts/persistence-sdk.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
if (![22, 24].includes(Number(process.versions.node.split('.')[0]))) {
  const nvm = path.join(homedir(), '.nvm/versions/node');
  const version = existsSync(nvm) && readdirSync(nvm).filter(name => /^v(22|24)\./.test(name)).sort().reverse()[0];
  if (!version) throw new Error('Use Node 22 or 24');
  const node = path.join(nvm, version, 'bin/node');
  const child = spawnSync(node, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PATH: path.dirname(node) + path.delimiter + process.env.PATH } });
  process.exit(child.status ?? 1);
}
const args = process.argv.slice(2), option = name => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing value: ' + name);
  const value = args[index + 1]; args.splice(index, 2); return value;
};
const target = option('--output'), pattern = option('--scenario');
if (args.length) throw new Error('Unknown benchmark options: ' + args.join(' '));
const directory = await mkdtemp(path.join(tmpdir(), 'persistence-cost-'));
const output = target ? path.resolve(target) : path.join(directory, 'report');
// Existing references cannot be replaced implicitly.
if (existsSync(path.join(output, 'reference.json'))) throw new Error('Output already contains a reference; choose a new directory');
await mkdir(output, { recursive: true });
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
try {
  const sdk = await preparePersistenceSdk();
  await writeFile(path.join(directory, 'firebase.json'), JSON.stringify({
    firestore: { rules: path.join(root, 'api/firestore.rules'), indexes: path.join(root, 'api/firestore.indexes.json') },
    database: { rules: path.join(root, 'api/database.rules.json') },
    emulators: { firestore: { host: '127.0.0.1', port: await freePort(), websocketPort: await freePort() }, database: { host: '127.0.0.1', port: await freePort() }, ui: { enabled: false }, hub: { port: await freePort() }, logging: { port: await freePort() }, singleProjectMode: true },
  }));
  const command = [process.execPath, '--experimental-loader', path.join(root, 'benchmarks/persistence/loader.mjs'), '--test', '--test-concurrency=1', '--test-force-exit', '--test-reporter=spec', ...(pattern ? ['--test-name-pattern', pattern] : []), path.join(root, 'benchmarks/persistence/scenarios.e2e.mjs')].map(quote).join(' ');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--only', 'firestore,database', '--project', 'demo-public-persistence', '--config', path.join(directory, 'firebase.json'), command], {
    cwd: directory, stdio: 'inherit', env: { ...process.env, JAVA_TOOL_OPTIONS: '-Xms32m -Xmx256m', PERSISTENCE_E2E: '1', PERSISTENCE_E2E_ROOT: root, PERSISTENCE_E2E_TEMP: directory, PERSISTENCE_SDK_DIR: sdk,
      COST_BENCHMARK_OUTPUT: output, GCLOUD_PROJECT: 'demo-public-persistence', GOOGLE_APPLICATION_CREDENTIALS: '',
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-public-persistence', databaseURL: 'https://demo-public-persistence-default-rtdb.firebaseio.com' }),
    },
  });
  process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
  if (!existsSync(path.join(output, 'reference.json'))) { process.exitCode = 1; console.error('No reference was produced; check scenario selection or the failed setup above.'); }
  console.log('Benchmark report: ' + output);
} finally {
  // Keep reports when no explicit destination was supplied, remove only infrastructure temporaries.
  if (target) await rm(directory, { recursive: true, force: true });
  else for (const entry of readdirSync(directory)) if (entry !== 'report') await rm(path.join(directory, entry), { recursive: true, force: true });
}
