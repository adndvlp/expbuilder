import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getRuntimeChoice } = require('firebase-tools/lib/deploy/functions/runtimes/node/parseRuntimeAndValidateSDK');
const { guardVersionSupport } = require('firebase-tools/lib/deploy/functions/runtimes/supported');
const apiDir = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(path.join(apiDir, 'firebase.json'), 'utf8'));
const sourceDir = path.join(apiDir, config.functions.source);
const packageJson = JSON.parse(readFileSync(path.join(sourceDir, 'package.json'), 'utf8'));
const lockfile = JSON.parse(readFileSync(path.join(sourceDir, 'package-lock.json'), 'utf8'));
const runtime = getRuntimeChoice(sourceDir, config.functions.runtime);

test('Firebase CLI accepts the configured Functions runtime after the reported Node 20 retirement and today', () => {
  // Keep the reported failure reproducible regardless of the test machine clock.
  const incidentDate = new Date('2026-11-12T00:00:00.000Z');
  assert.doesNotThrow(() => guardVersionSupport(runtime, incidentDate));
  assert.doesNotThrow(() => guardVersionSupport(runtime));
});

test('Firebase deploy selection and the lockfile agree with the Functions package runtime', () => {
  assert.equal(runtime, `nodejs${packageJson.engines.node}`);
  assert.equal(lockfile.packages[''].engines.node, packageJson.engines.node);
});
