import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { createScenarioInputs } from '../persistence/inputs.mjs';
import { instrumentInputs } from '../persistence/instrument-inputs.mjs';
import { installBrowserInputs } from '../persistence/browser-inputs.mjs';
import { createProviderTransport } from '../persistence/input-transport.mjs';
import { nodeInputs, selectNodeInputs } from '../persistence/node-inputs.mjs';
import { withProviderInputs, nextId, providerTimestamp, resetStore, store } from '../../api/mock-providers/store.mjs';
import { handleGoogleDrive } from '../../api/mock-providers/providers/google-drive.mjs';
import { handleDropbox } from '../../api/mock-providers/providers/dropbox.mjs';
import { handleOsf } from '../../api/mock-providers/providers/osf.mjs';

test('same scenario/seed repeats in another process; identities are unique and actors do not shift each other', () => {
  const first = createScenarioInputs({ scenario: 'normal', seed: 'test' });
  const second = createScenarioInputs({ scenario: 'normal', seed: 'test' });
  first.id('connection'); first.id('connection');
  const a = Array.from({ length: 500 }, () => first.id('event'));
  const b = Array.from({ length: 500 }, () => second.id('event'));
  assert.deepEqual(a, b); assert.equal(new Set(a).size, a.length);
  assert.match(a[0], /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
  assert.notEqual(createScenarioInputs({ scenario: 'other', seed: 'test' }).id('event'), a[0]);
  const command = `import { createScenarioInputs } from ${JSON.stringify(new URL('../persistence/inputs.mjs', import.meta.url).href)}; console.log(createScenarioInputs({scenario:'normal',seed:'test'}).id('event'));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', command], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout.trim(), a[0]);
});
test('scenario dates, numeric authoring IDs and random streams are explicit and independent of the machine clock', () => {
  const inputs = createScenarioInputs({ scenario: 'clock' });
  assert.equal(inputs.date().toISOString(), '2026-11-13T00:00:00.000Z');
  assert.equal(inputs.number('trial'), inputs.epoch);
  assert.equal(inputs.number('trial'), inputs.epoch + 1);
  assert.equal(inputs.number('loop'), inputs.epoch);
  const first = inputs.random('order'), other = createScenarioInputs({ scenario: 'clock' });
  other.random('name'); assert.equal(other.random('order'), first);
  assert.ok(first >= 0 && first < 1);
});
test('provider dependencies are request-scoped, restore after an error and preserve ordinary randomness', async () => {
  const original = Math.random, originalDate = Date;
  const inputs = createScenarioInputs({ scenario: 'provider' });
  await assert.rejects(withProviderInputs(inputs, async () => {
    assert.equal(nextId('file'), 'file-' + createScenarioInputs({ scenario: 'provider' }).id('provider:file'));
    assert.equal(providerTimestamp(), '2026-11-13T00:00:00.000Z');
    await Promise.resolve(); throw new Error('injected');
  }), /injected/);
  assert.notEqual(nextId('file'), nextId('file'));
  assert.equal(Math.random, original); assert.equal(Date, originalDate);
  assert.ok(Math.abs(Date.parse(providerTimestamp()) - Date.now()) < 1000);
});
test('stopping Node input selection restores ordinary values without patching Date or crypto', () => {
  const date = Date, now = Date.now, crypto = globalThis.crypto, math = Math.random;
  const inputs = createScenarioInputs({scenario:'cleanup'});
  try {
    selectNodeInputs(inputs);
    assert.equal(nodeInputs.date().toISOString(), '2026-11-13T00:00:00.000Z');
    assert.equal(nodeInputs.id('event'), createScenarioInputs({scenario:'cleanup'}).id('event'));
  } finally { selectNodeInputs(null); }
  assert.ok(Math.abs(nodeInputs.date().getTime() - Date.now()) < 1000);
  assert.notEqual(nodeInputs.id('event'), inputs.id('event'));
  assert.equal(Date, date); assert.equal(Date.now, now); assert.equal(globalThis.crypto, crypto); assert.equal(Math.random, math);
});
test('source instrumentation controls public calendar/deadlines through the private facade', () => {
  const code = `function _publicEventId() { return crypto.randomUUID(); }
    const writer = { connectionId: crypto.randomUUID(), token: crypto.randomUUID() };
    const startedAt = new Date().toISOString();
    const remaining = Date.now() + 600000;
    const jsPsych = initJsPsych({on_data_update(data) {data.clientTimestamp = Date.now();}});`;
  const output = instrumentInputs(code, { scope: 'public', browser: true });
  assert.match(output, /__costInputs\.id\(/); assert.match(output, /__costInputs\.date\(/);
  assert.match(output, /__costInputs\.initJsPsych\(/);
  assert.match(output, /remaining = window\.__costInputs\.now\(\)/);
  assert.match(output, /clientTimestamp = .*__costInputs\.number\(/);
});
test('Date.now used as a calendar value is controlled, but an actual deadline remains native', () => {
  const source = `const createdAt = new Date(Date.now()).toISOString(); const deadline = Date.now() + 60000;`;
  const output = instrumentInputs(source, { scope: 'public', browser: true });
  const inputs = createScenarioInputs({ scenario: 'calendar' });
  const evaluate = new Function('window', output + '; return {createdAt, deadline};');
  const first = evaluate({ __costInputs: inputs });
  assert.equal(first.createdAt, '2026-11-13T00:00:00.000Z');
  assert.ok(Math.abs(first.deadline - Date.now() - 60000) < 1000);
});
test('instrumented code executes native callbacks with controlled values before submission', () => {
  const source = `function _publicEventId() {return crypto.randomUUID();}
    let sent; const jsPsych = initJsPsych({on_data_update(data) {data.clientTimestamp=Date.now(); sent={eventId:_publicEventId(),data};}});
    jsPsych.options.on_data_update({rt:987.123,time_elapsed:555.43,response:'A,quoted'});`;
  const execute = new Function('window', instrumentInputs(source, { scope: 'public', browser: true }) + '; return sent;');
  const run = () => { const window = {initJsPsych: options => ({options})}; installBrowserInputs(window, {scenario:'submission'}); return execute(window); };
  assert.deepEqual(run(), run());
  assert.equal(run().data.rt, 125); assert.equal(run().data.response, 'A,quoted');
});
test('browser controls operate before hashing/sending, retain response fields, and do not patch browser globals', () => {
  const calls = [], globals = { Date, Math, crypto: globalThis.crypto,
    initJsPsych: options => ({ options }) };
  const native = { date: globals.Date, random: globals.Math.random, crypto: globals.crypto };
  const inputs = installBrowserInputs(globals, { scenario: 'browser' });
  const instance = inputs.initJsPsych({ on_data_update(data) { calls.push({ ...data }); } });
  const data = { rt: 12.456, time_elapsed: 987.6, response: ['A', 'B'], custom: 'kept' };
  instance.options.on_data_update(data);
  assert.equal(calls[0].rt, 125); assert.equal(calls[0].time_elapsed, 125);
  assert.deepEqual(calls[0].response, ['A', 'B']); assert.equal(calls[0].custom, 'kept');
  assert.equal(globals.Date, native.date); assert.equal(globals.Math.random, native.random); assert.equal(globals.crypto, native.crypto);
  assert.equal(inputs.date('2020-01-01').toISOString(), '2020-01-01T00:00:00.000Z');
  assert.deepEqual(Object.keys(data).sort(), ['custom','response','rt','time_elapsed']);
});
test('browser identities continue across a reload and separate participants do not collide', () => {
  const storage = new Map();
  const window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  const conditions = { scenario: 'reload', participant: 1 };
  const first = installBrowserInputs(window, conditions).id('connection');
  const second = installBrowserInputs(window, conditions).id('connection');
  assert.notEqual(first, second);
  assert.notEqual(installBrowserInputs(window, { ...conditions, participant: 2 }).id('connection'), first);
});
test('logical provider addresses are stable while actual free ports differ and external traffic is rejected', () => {
  const first = createProviderTransport(), second = createProviderTransport();
  const logical = first.register('osf', 'http://127.0.0.1:1234');
  assert.equal(second.register('osf', 'http://127.0.0.1:56789'), logical);
  assert.equal(first.resolve(logical + '/v2/files/a/?meta='), 'http://127.0.0.1:1234/v2/files/a/?meta=');
  assert.equal(second.resolve(logical + '/v2/files/a/?meta='), 'http://127.0.0.1:56789/v2/files/a/?meta=');
  assert.throws(() => first.register('osf', 'https://example.com'), /loopback/);
  assert.throws(() => first.resolve('https://example.com/file'), /unregistered/);
});

for (const name of ['googledrive', 'dropbox', 'osf']) test(name + ': actual response bodies repeat across ports and still expose a payload increase', async () => {
  async function response(actual, payload = 'A,B') {
    resetStore(); const inputs = createScenarioInputs({scenario:'wire/' + name}), transport = createProviderTransport();
    const origin = transport.register(name, actual);
    store.drive.tokens.set('token', {}); store.dropbox.tokens.set('token', {}); store.osf.tokens.set('token', {});
    const headers = {authorization:'Bearer token', 'dropbox-api-arg': JSON.stringify({path:'/file.csv'})};
    const handler = {googledrive:handleGoogleDrive,dropbox:handleDropbox,osf:handleOsf}[name];
    const invoke = async (path, method, body, contentType) => {
      let result;
      const res = {writeHead(status) {assert.equal(status >= 200 && status < 300, true);}, setHeader() {}, end(value) {result = value;}};
      await withProviderInputs(inputs, () => handler({method,headers}, res, new URL(path, origin), body, contentType));
      return String(result);
    };
    if (name === 'googledrive') {
      const boundary = 'controlled-fixture';
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n{"name":"file.csv"}\r\n--${boundary}\r\nContent-Type: text/csv\r\n\r\n${payload}\r\n--${boundary}--`;
      const created = JSON.parse(await invoke('/upload/drive/v3/files', 'POST', Buffer.from(body), 'multipart/related; boundary=' + boundary));
      return invoke('/drive/v3/files/' + created.id, 'GET', Buffer.alloc(0));
    }
    return invoke(name === 'dropbox' ? '/2/files/upload' : '/v2/nodes/folder/files/osfstorage/?name=file.csv', name === 'dropbox' ? 'POST' : 'PUT', Buffer.from(payload));
  }
  const first = await response('http://127.0.0.1:1234'), second = await response('http://127.0.0.1:56789');
  assert.equal(first, second); assert.ok(first.includes('file.csv'));
  const expanded = await response('http://127.0.0.1:56789', 'A,B\nC,D');
  assert.notEqual(expanded, first);
  const size = text => { const value = JSON.parse(text); return name === 'googledrive' ? value.content.data.length : name === 'osf' ? value.data.attributes.size : value.size; };
  assert.equal(size(first), 3); assert.equal(size(expanded), 7);
});
