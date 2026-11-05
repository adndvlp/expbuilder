import type { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicCompletionCode({ DATA_API_URL, experimentID }: PublicExperimentCodeOptions): string {
  return `
    async function _completePublicSession() {
      await window.ExpBuilderPersistence.whenIdle();
      await _drainPublicResponses();
      if (BATCH_CONFIG.useIndexedDB) await _flushPublicBatches(true);
      await publicBatchTail;
      const generation = publicResponses.length;
      const saved = BATCH_CONFIG.useIndexedDB ? (await TrialDB.getState()).events : [...publicManifest.values()];
      const events = saved.map(({ eventId, sequence, payloadHash }) => ({ eventId, sequence, payloadHash }))
        .sort((a, b) => a.sequence - b.sequence);
      if (events.some((event, index) => event.sequence !== index)) throw new Error('The expected event set has missing responses');
      const expected = { expectedEventCount: events.length, expectedLastSequence: events.length - 1,
        eventsHash: await _publicHash(events) };
      const response = await fetch(${JSON.stringify(DATA_API_URL)}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeSession', experimentID: ${JSON.stringify(experimentID)}, sessionId: trialSessionId, ...expected })
      });
      if (!response.ok) throw new Error('Completion was not confirmed: ' + await response.text());
      const result = await response.json(), receipt = result?.completion;
      if (result?.success !== true || result.experimentID !== ${JSON.stringify(experimentID)} || result.sessionId !== trialSessionId
          || receipt?.confirmed !== true || Object.keys(expected).some(key => receipt[key] !== expected[key])
          || publicResponses.length !== generation) throw new Error('The storage receipt does not confirm the complete event set');
      return receipt;
    }
`;
}
