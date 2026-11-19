const { buildHistoricalPlan, verifyHistoricalPlan } = await import('../../../experiment/sessions/recovery/plan.js');
const input = () => ({ projectId: 'demo-test', experimentID: 'EID', sessionId: 'SID', experiment: { owner: 'owner', storageProvider: 'googledrive', driveFolderId: 'folder' },
  session: { participantNumber: 23, condition: 0, createdAt: '2026-11-05T00:00:00Z' }, metadata: {}, remote: { exists: false },
  sources: [{ id: 'batch', data: { trialsData: JSON.stringify([{ response: 'A', trial_index: 0 }, { response: 'A', trial_index: 1 }]) } }] });
test('plans identical answers as distinct events and preserves deterministic provenance across retries', () => {
  const first = buildHistoricalPlan(input()), second = buildHistoricalPlan(input());
  expect(first.status).toBe('ready'); expect(first.events).toHaveLength(2);
  expect(first.events[0].eventId).not.toBe(first.events[1].eventId);
  expect(first).toEqual(second); expect(first.identity.participantNumber).toBe(23);
  expect(verifyHistoricalPlan(first)).toBe(true);
});
test('a malformed batch blocks the entire plan instead of silently dropping that document', () => {
  const data = input(); data.sources.push({ id: 'corrupt', data: { trialsData: '{broken' } });
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'invalid_source' });
});
test('existing unreceipted CSV requires explicit reconciliation, never content-based deduplication', () => {
  const data = input(); data.remote = { exists: true, csvHash: 'hash' };
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'unverified_existing_file' });
});
test('never reconstructs participant or condition from the current experiment counter', () => {
  const data = input(); data.session = {}; data.experiment.currentCondition = 999;
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'missing_identity' });
});
test('an edited plan cannot be applied with its original digest', () => {
  const plan = buildHistoricalPlan(input()); plan.events[0].payload.response = 'changed';
  expect(() => verifyHistoricalPlan(plan)).toThrow();
});
test('existing versioned sessions are reported for their own exporter rather than assigned replacement identities', () => {
  const data = input(); data.session.sessionProtocolVersion = 3;
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'already_versioned' });
});
test('an explicit reviewed identity can fill missing facts without replacing an existing participant', () => {
  const data = input(); delete data.session.condition; data.identity = { participantNumber: 23, condition: 0 };
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'ready', identity: { participantNumber: 23, condition: 0 } });
  data.identity.participantNumber = 999;
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'identity_conflict' });
});
test('a positive legacy count with no remaining payloads cannot become a successful empty recovery', () => {
  const data = input(); data.sources = []; data.session.trialCount = 5;
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'missing_payloads' });
});
test.each(['protocol', 'receipts'])('does not replace identities from an earlier partially versioned delivery: %s', kind => {
  const data = input();
  if (kind === 'protocol') data.session.eventProtocolVersion = 1;
  else data.hasReceipts = true;
  expect(buildHistoricalPlan(data)).toMatchObject({ status: 'blocked', reason: 'already_versioned' });
});
