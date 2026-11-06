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
      if (publicRecoveryMode) return _waitForPublicExport(await _publicExportStatus(), expected, true);
      const response = await fetch(${JSON.stringify(DATA_API_URL)}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completeSession', experimentID: ${JSON.stringify(experimentID)}, sessionId: trialSessionId, ...(typeof _publicWriterPermission === 'function' ? _publicWriterPermission() : {}), ...expected })
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        if (typeof _adoptPublicClosure === 'function') _adoptPublicClosure(failure);
        throw new Error(failure.message || 'Completion was not confirmed');
      }
      const receipt = await _waitForPublicExport(await response.json(), expected);
      if (publicResponses.length !== generation) throw new Error('New responses arrived during completion');
      return receipt;
    }
`;
}
