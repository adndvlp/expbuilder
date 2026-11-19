import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { createScenarioClock, timeMeter } from '../persistence/clock.mjs';
import { controlDatabaseTimestamps } from '../persistence/clock-database.mjs';
import { storageUsage } from '../core/models.mjs';
import { decimal, multiply } from '../core/decimal.mjs';
import { quantityValue } from '../core/quantity.mjs';
import { createMeter } from '../core/meter.mjs';
import { createDispatcher } from '../persistence/dispatcher.mjs';
import { createScenarioInputs } from '../persistence/inputs.mjs';
import { nodeInputs, selectNodeInputs } from '../persistence/node-inputs.mjs';
import { instrumentInputs } from '../persistence/instrument-inputs.mjs';
import { installBrowserInputs } from '../persistence/browser-inputs.mjs';

const byteSeconds = clock => decimal(multiply(quantityValue(storageUsage({ samples: clock.samples(), windowSeconds: clock.elapsedMs() / 1000,
  billingPeriodSeconds: 1, representation: 'stored-including-indexes', provenance: 'assumed', source: 'Controlled interval and observed bytes' })), 1073741824));
test('real execution/inspection delays change diagnostics without advancing storage time', async () => {
  const run = async delay => {
    const clock = createScenarioClock(), realStart = performance.now(); clock.sample(100);
    await setTimeout(delay); clock.advance(2000, 'retain'); clock.sample(0); clock.advance(1000, 'finish');
    return { samples: clock.samples(), quantity: byteSeconds(clock), realMs: performance.now() - realStart };
  };
  const first = await run(1), slow = await run(30);
  assert.deepEqual(first.samples, slow.samples); assert.equal(first.quantity, '200'); assert.equal(slow.quantity, '200');
  assert.ok(slow.realMs >= 25); assert.notEqual(slow.realMs,first.realMs);
});
test('retaining another second increases storage and committed operations have positive intervals', () => {
  const clock = createScenarioClock(); clock.sample(100); clock.advance(3000, 'retain'); clock.sample(0); clock.advance(1000, 'finish');
  assert.equal(byteSeconds(clock), '300');
  const commits = createScenarioClock(); commits.sample(0);
  commits.observe('firestore.directWriteCalls', 1); commits.sample(100);
  commits.observe('firestore.directWriteCalls', 1); commits.sample(0);
  assert.ok(Number(byteSeconds(commits)) > 0);
  assert.equal(commits.snapshot().provenance, 'assumed');
  assert.ok(commits.samples()[2].atSeconds > commits.samples()[1].atSeconds);
  assert.throws(() => commits.advance(-1, 'bad'), /advance/);
  assert.throws(() => commits.advanceTo(commits.now() - 1, 'backdate'), /backward/);
});
test('retained bytes remain priced to the reporting horizon instead of expiring when the test stops', () => {
  const clock=createScenarioClock(); clock.sample(100); clock.advance(2000,'stop'); clock.sample(100);
  const usage=storageUsage({samples:clock.samples(),windowSeconds:10,billingPeriodSeconds:1,representation:'stored-including-indexes',provenance:'assumed',source:'Declared horizon, no TTL'});
  assert.equal(decimal(multiply(quantityValue(usage),1073741824)),'1000');
});
test('observed attempt counts, including failures/retries, advance declared intervals exactly once', () => {
  const clock = createScenarioClock(), meter = timeMeter(createMeter({scenario:'clock',environment:'test'}), clock);
  meter.add('functions.invocations', 1); meter.add('firestore.readCalls', 2);
  meter.add('firestore.transactionAttempts', 1); meter.add('firestore.transactionFailures', 1);
  meter.add('firestore.transactionAttempts', 1); meter.add('provider.googledrive.requests', 1);
  meter.add('functions.localDurationMs', 999999, {unit:'millisecond'});
  const durations = clock.snapshot().operationMs;
  assert.equal(clock.elapsedMs(), durations.function + 2 * durations.firestoreRead + 2 * durations.firestoreCommit + durations.provider);
  assert.equal(meter.snapshot().metrics['firestore.transactionAttempts'].value, '2');
});
test('RTDB rules retain native timestamp writes while handlers receive a controlled calendar view', async () => {
  const writes = [], clock = createScenarioClock(), registrations = new Map();
  const disconnectedAt = path => { if (!registrations.has(path)) registrations.set(path, clock.now() + 10000); return registrations.get(path); };
  const native = { ref: path => ({ toString: () => 'http://127.0.0.1:1234/' + path,
    set: async value => {writes.push(['set', value]);},
    once:async()=>({val:()=>({connected:false,changedAt:1899999999999})}),
    onDisconnect: () => ({set: async value => {writes.push(['disconnect', value]);}, cancel: async () => {writes.push(['cancel']);}}),
  }) };
  const db = controlDatabaseTimestamps(native, {disconnectAt:disconnectedAt, readPresence:(_path,value)=>({...value,changedAt:clock.now()})});
  const value = {connected:true,changedAt:{'.sv':'timestamp'}};
  await db.ref('connection').set(value);
  await db.ref('connection').onDisconnect().set({...value,connected:false});
  clock.advance(100, 'work'); await db.ref('connection').onDisconnect().set({...value,connected:false});
  assert.deepEqual(writes[0][1].changedAt, {'.sv':'timestamp'});
  assert.deepEqual(writes[1][1].changedAt, {'.sv':'timestamp'});
  assert.equal((await db.ref('connection').once('value')).val().changedAt, clock.now());
  assert.equal(writes[1][1].connected, false); assert.deepEqual(value.changedAt, {'.sv':'timestamp'});
  await db.ref('connection').onDisconnect().cancel(); assert.equal(writes.at(-1)[0], 'cancel');
});
test('a handler crossing a schedule deadline still delivers that tick within the same pump', async () => {
  const clock = createScenarioClock(), meter = createMeter({scenario:'schedule',environment:'test'}), calls=[];
  const dispatcher = createDispatcher({meter, queue:[], now:clock.now, definitions:[
    {name:'work', origin:'firestore', handler:async()=>{clock.advance(60000,'work');calls.push('work');}},
    {name:'tick', origin:'schedule', intervalMs:60000, handler:async()=>{calls.push('tick');}},
  ]});
  dispatcher.event('work',{}); await dispatcher.pump();
  assert.deepEqual(calls, ['work','tick']);
  await dispatcher.pump(); assert.equal(calls.length, 2);
});
test('native delays preserve retry deadlines, attempts and event identity', async () => {
  const run=async milliseconds=>{
    const clock=createScenarioClock(), meter=timeMeter(createMeter({scenario:'retry-clock',environment:'test'}),clock), queue=[], calls=[];
    const dispatcher=createDispatcher({meter,queue,now:clock.now,definitions:[{name:'worker',origin:'task',retry:{maxAttempts:3,minBackoffSeconds:30,maxBackoffSeconds:30,maxDoublings:0},
      handler:async event=>{await setTimeout(milliseconds);calls.push([event.data.eventId,event.retryCount]);if(calls.length===1)throw new Error('Lost acknowledgement');},
    }]});
    queue.push({name:'worker',data:{eventId:'stable-event'},due:clock.now()}); await dispatcher.pump();
    const due=queue[0].due;
    clock.advanceTo(due-1,'before-retry'); await dispatcher.pump(); assert.equal(calls.length,1);
    clock.advance(1,'retry-deadline'); await dispatcher.pump(); assert.deepEqual(calls,[['stable-event',0],['stable-event',1]]);
    const metrics=Object.fromEntries(Object.entries(meter.snapshot().metrics).filter(([,q])=>q.unit!=='millisecond').map(([name,q])=>[name,q.value]));
    return {calls,due,metrics,timing:clock.snapshot(),pending:dispatcher.pending()};
  };
  assert.deepEqual(await run(1),await run(10));
});
test('private Date.now calls and references share the calendar without patching the SDK clock', () => {
  const nativeNow = Date.now, clock = createScenarioClock(), inputs = createScenarioInputs({scenario:'calendar'});
  try {
    selectNodeInputs(inputs, clock); clock.advance(2000, 'test');
    const source = instrumentInputs(`const now=Date.now; const date=new Date(Date.now()).toISOString(); const sdk=globalThis.Date.now();`, {scope:'api/functions/experiment/fixture.js'});
    const result = new Function('__costInputs', source + ';return {now:now(),date,sdk};')(nodeInputs);
    assert.equal(result.now, inputs.epoch + 2000); assert.equal(result.date, '2026-11-13T00:00:02.000Z');
    assert.ok(Math.abs(result.sdk - nativeNow()) < 1000); assert.equal(Date.now, nativeNow);
  } finally { selectNodeInputs(null); }
});
test('browser response synchronization pauses until callback handoff and fetch keeps its body', async () => {
  const clock = createScenarioClock(), tokens = new Set(), nativeNow=Date.now, sent=[];
  const window = {Date, __benchmarkTime:async action => {if(action==='response') clock.advance(125,'response');return clock.now();},
    ExpBuilderPersistence:{start(){const token={};tokens.add(token);return token;},finish(token){tokens.delete(token);}},
    initJsPsych:options=>({options,pauseExperiment(){sent.push('pause');}}),
    fetch:async(...args)=>{sent.push(args);clock.advance(35,'http');return {ok:true};},
  };
  const inputs=installBrowserInputs(window,{scenario:'browser-clock',epoch:clock.conditions().epoch,timing:clock.conditions()});
  await inputs.ready; clock.advance(1000,'work');
  const instance=inputs.initJsPsych({async on_data_update(data){assert.equal(tokens.size,1);assert.equal(data.time_elapsed,1125);sent.push('saved');}});
  const pending=instance.options.on_data_update({rt:4.5,time_elapsed:99}); assert.equal(tokens.size,1); await pending;
  assert.equal(tokens.size,0); assert.deepEqual(sent,['pause','saved']);
  const body=JSON.stringify({action:'createSession',data:{response:'A'}});
  await inputs.fetch('http://127.0.0.1:1234/apiData',{method:'POST',body});
  assert.equal(sent[2][1].body,body); assert.equal(inputs.now(),clock.now()); assert.equal(Date.now,nativeNow);
});
test('the calendar barrier hands off to the original backup token without waiting for a later network flush', async () => {
  const tokens=new Set(), clock=createScenarioClock();
  let entered, backed, flush;
  const started=new Promise(resolve=>{entered=resolve;}), backup=new Promise(resolve=>{backed=resolve;}), network=new Promise(resolve=>{flush=resolve;});
  const window={Date,__benchmarkTime:async()=>clock.now(),
    ExpBuilderPersistence:{start(){const token={};tokens.add(token);return token;},finish(token){tokens.delete(token);}},
    initJsPsych:options=>({options,pauseExperiment(){}}),
  };
  const inputs=installBrowserInputs(window,{scenario:'backup',epoch:clock.conditions().epoch,timing:clock.conditions()});
  await inputs.ready;
  const instance=inputs.initJsPsych({async on_data_update(){
    const token=window.ExpBuilderPersistence.start(); entered(); await backup; window.ExpBuilderPersistence.finish(token); await network;
  }});
  const pending=instance.options.on_data_update({time_elapsed:0});
  await started; assert.equal(tokens.size,1,'Only the original backup token may remain after handing off');
  backed(); await Promise.resolve(); assert.equal(tokens.size,0,'A pending batch flush must not hold the backup barrier');
  flush(); await pending;
});
test('the next synthetic response waits for the previous submission while runtime may already advance after backup', async () => {
  const clock=createScenarioClock(), tokens=new Set(); let flush, calls=0;
  const network=new Promise(resolve=>{flush=resolve;});
  const window={Date,__benchmarkTime:async()=>clock.now(),
    ExpBuilderPersistence:{start(){const token={};tokens.add(token);return token;},finish(token){tokens.delete(token);}},
    initJsPsych:options=>({options,pauseExperiment(){}}),
  };
  const inputs=installBrowserInputs(window,{scenario:'serial-input',epoch:clock.conditions().epoch,timing:clock.conditions()}); await inputs.ready;
  const instance=inputs.initJsPsych({async on_data_update(){if(++calls===1) await network;}});
  const first=instance.options.on_data_update({time_elapsed:0}); await setTimeout(1);
  assert.equal(tokens.size,0,'The first callback has handed off; advancement is not waiting on its flush');
  const second=instance.options.on_data_update({time_elapsed:0}); await setTimeout(1);
  assert.equal(calls,1,'The second synthetic response must respect the declared serial submission schedule');
  flush(); await Promise.all([first,second]); assert.equal(calls,2); assert.equal(tokens.size,0);
});

test('CO04: the declared page close waits for an initiated flush after local backup, without forcing another batch or advancing time', async () => {
  const clock = createScenarioClock(), tokens = new Set();
  let flush, entered, closed = false, calls = 0;
  const network = new Promise(resolve => { flush = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const window = { Date, __benchmarkTime: async () => clock.now(),
    ExpBuilderPersistence: { start() { const token = {}; tokens.add(token); return token; }, finish(token) { tokens.delete(token); } },
    initJsPsych: options => ({ options, pauseExperiment() {} }),
  };
  const inputs = installBrowserInputs(window, { scenario: 'close-boundary', epoch: clock.conditions().epoch, timing: clock.conditions() });
  await inputs.ready;
  const instance = inputs.initJsPsych({ async on_data_update() { calls++; entered(); await network; } });
  const response = instance.options.on_data_update({ time_elapsed: 0 });
  await started; assert.equal(tokens.size, 0, 'The local backup barrier has already been released');
  assert.equal(typeof inputs.whenResponsesSettled, 'function');
  const closing = inputs.whenResponsesSettled().then(() => { closed = true; });
  await Promise.resolve(); assert.equal(closed, false, 'Closing while the upload receipt is pending changes the workload');
  const before = clock.snapshot(); flush(); await Promise.all([response, closing]);
  assert.equal(closed, true); assert.equal(calls, 1); assert.deepEqual(clock.snapshot(), before);
});
