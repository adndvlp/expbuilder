import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { preparePersistenceSdk } from './persistence-sdk.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const compatible = [22, 24].includes(Number(process.versions.node.split('.')[0]));
const nvm = path.join(homedir(), '.nvm/versions/node');
const candidate = existsSync(nvm) && readdirSync(nvm).filter(name => /^v(22|24)\./.test(name)).sort().reverse()[0];
if (!compatible && candidate) {
  const node = path.join(nvm, candidate, 'bin/node');
  const result = spawnSync(node, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, PATH: path.dirname(node) + path.delimiter + process.env.PATH } });
  process.exit(result.status || 0);
}
if (!compatible) throw new Error('Run this suite using Node 22 or 24');
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const sdk = await preparePersistenceSdk();
const contracts = spawnSync(process.execPath, ['--test', path.join(root, 'api/persistence-e2e/provider-contract.test.mjs')], { cwd: root, stdio: 'inherit' });
if (contracts.status !== 0) process.exit(contracts.status || 1);
const directory = await mkdtemp(path.join(tmpdir(), 'public-persistence-e2e-'));
const [firestore, database] = await Promise.all([freePort(), freePort()]);
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
try {
  await writeFile(path.join(directory, 'firebase.json'), JSON.stringify({
    firestore: { rules: path.join(root, 'api/firestore.rules'), indexes: path.join(root, 'api/firestore.indexes.json') },
    database: { rules: path.join(root, 'api/database.rules.json') },
    emulators: { firestore: { host: '127.0.0.1', port: firestore, websocketPort: await freePort() }, database: { host: '127.0.0.1', port: database }, ui: { enabled: false }, hub: { port: await freePort() }, logging: { port: await freePort() }, singleProjectMode: true },
  }));
  const command = [process.execPath, '--experimental-loader', path.join(root, 'api/persistence-e2e/task-queue-loader.mjs'), '--test', '--test-concurrency=1', '--test-force-exit', ...process.argv.slice(2), ...readdirSync(path.join(root, 'api/persistence-e2e')).filter(name => name.endsWith('.e2e.mjs')).map(name => path.join(root, 'api/persistence-e2e', name))].map(quote).join(' ');
  const args = [path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--only', 'firestore,database', '--project', 'demo-public-persistence', '--config', path.join(directory, 'firebase.json'), command];
  const processHandle = spawn(process.execPath, args, { cwd: directory, stdio: 'inherit', env: { ...process.env,
    PERSISTENCE_E2E: '1', PERSISTENCE_SDK_DIR: sdk, JAVA_TOOL_OPTIONS: '-Xms32m -Xmx256m', PERSISTENCE_E2E_ROOT: root, PERSISTENCE_E2E_TEMP: directory, GCLOUD_PROJECT: 'demo-public-persistence',
    FIREBASE_CONFIG: JSON.stringify({ projectId: 'demo-public-persistence', databaseURL: 'https://demo-public-persistence-default-rtdb.firebaseio.com' }),
  } });
  process.exitCode = await new Promise(resolve => processHandle.on('exit', code => resolve(code ?? 1)));
} finally { await rm(directory, { recursive: true, force: true }); }
