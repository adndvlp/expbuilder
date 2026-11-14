import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { URL } from 'node:url';
import { createRepeatabilityContract, repeatabilityIssues } from '../core/repeatability.mjs';
import { persistenceRepeatability } from '../persistence/repeatability.mjs';
import { createScenarioInputs } from '../persistence/inputs.mjs';
import { createScenarioClock } from '../persistence/clock.mjs';

const scenario = name => ({name, inputs:{count:3,indexed:true,size:1,timeout:1},
  controlledInputs:{...createScenarioInputs({scenario:name}).conditions(), participantEnvironment:{locale:'en-US',timezoneId:'UTC'},timing:createScenarioClock().conditions()},
  metrics:{reads:1},storageTimeline:[{atSeconds:1,bytes:10}],functional:{passed:true}});
const fixture = {id:'unit-fixture/1',sources:{'fixture.mjs':'a'.repeat(64)}};
test('condition fingerprints are canonical, isolated and independent of execution order or process', async () => {
  const scenarios=[scenario('b'),scenario('a')], original=globalThis.structuredClone(scenarios);
  const contract=createRepeatabilityContract(scenarios,fixture);
  assert.deepEqual(createRepeatabilityContract([...scenarios].reverse(),fixture),contract);
  const source=`import {createRepeatabilityContract} from ${JSON.stringify(new URL('../core/repeatability.mjs',import.meta.url).href)};
    process.stdout.write(JSON.stringify(createRepeatabilityContract(${JSON.stringify(original)},${JSON.stringify(fixture)})));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr); assert.deepEqual(JSON.parse(child.stdout),contract);
  scenarios[0].inputs.count=9; assert.equal(contract.conditions.scenarios[1].inputs.count,3);
  assert.notEqual(createRepeatabilityContract(scenarios,fixture).sha256,contract.sha256);
});
test('measured operations, retention outcomes and functional results never enter the recipe fingerprint', () => {
  const source=scenario('normal'), changed=globalThis.structuredClone(source);
  changed.metrics.reads++; changed.storageTimeline[0].atSeconds++; changed.functional.passed=false;
  changed.storageTiming={elapsedMs:999,operations:{reads:2}}; changed.virtualSeconds=99; changed.overhead={localInspectionMs:100};
  assert.deepEqual(createRepeatabilityContract([source],fixture),createRepeatabilityContract([changed],fixture));
});
test('persistence captures attest to real fixture/response sources, not product implementation hashes', async () => {
  const scenarios=[scenario('normal')], contract=await persistenceRepeatability(scenarios);
  assert.deepEqual(repeatabilityIssues({scenarios,repeatability:contract}),[]);
  assert.ok(contract.conditions.fixture.sources['api/mock-providers/providers/google-drive.mjs']);
  assert.ok(contract.conditions.fixture.sources['api/persistence-e2e/harness.mjs']);
  assert.ok(contract.conditions.fixture.sources['benchmarks/persistence/scenarios.e2e.mjs']);
  assert.ok(Object.keys(contract.conditions.fixture.sources).every(p=>!p.startsWith('api/functions/')&&!p.startsWith('client/src/')));
  const changed=globalThis.structuredClone(contract); changed.conditions.fixture.sources['api/persistence-e2e/harness.mjs']='b'.repeat(64);
  assert.notEqual(createRepeatabilityContract(scenarios,changed.conditions.fixture).sha256,contract.sha256);
});
test('a partial calendar cannot be declared as a complete repetition contract', () => {
  for (const field of ['operationMs','httpDelivery','disconnectAfterMs','participantSchedule','realtimeCalendar']) {
    const s=scenario('normal'); delete s.controlledInputs.timing[field];
    assert.throws(()=>createRepeatabilityContract([s],fixture),/timing/);
  }
});
