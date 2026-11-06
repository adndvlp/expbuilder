export function publicResponsePersistenceCode(): string {
  return `
    const publicResponses = [];
    let publicResponseTail = Promise.resolve();
    let publicClosing = false;
    let publicFinishHandler;
    let publicOwnsPause = false;
    let publicPreparationError = null;
    let publicExportRetryRequested = false;
    let publicFinishInFlight = null;
    let publicFinished = false;
    const publicRecoveryMode = ['completed', 'expired'].includes(_publicSessionState.lifecycle);
    const publicManifest = new Map((_publicSessionState.receivedEvents || []).map(event => [event.sequence, event]));
    let publicDirectSequence = Math.max(-1, ...publicManifest.keys()) + 1;
    const publicPersistenceReady = BATCH_CONFIG.useIndexedDB
      ? TrialDB.syncManifest(_publicSessionState.receivedEvents || []) : Promise.resolve();

    function _mirrorPublicCheckpoint(checkpoint) {
      if (!checkpoint) return;
      try { localStorage.setItem(_publicStorageKeys.resumeTrial, JSON.stringify(checkpoint)); }
      catch (error) { console.error('Cannot mirror saved checkpoint:', error); }
    }
    function _resumePublicAfterBackup() {
      if (!publicOwnsPause || publicClosing || publicResponses.some(item => !item.persisted)
          || window.ExpBuilderNavigation.isTransitionPending()) return;
      publicOwnsPause = false;
      jsPsych.resumeExperiment();
    }
    function _publicPersistenceError(error) {
      console.error('Error saving trial data:', error);
      window.ExpBuilderRuntime?.reportError(error, { source: 'public-persistence' });
      _setLoadingMsg('Data could not be confirmed. Keep this page open and retry saving.');
      if (document.getElementById('expbuilder-retry-save')) return;
      const panel = document.createElement('div');
      panel.id = 'expbuilder-retry-save';
      panel.style.cssText = 'position:fixed;bottom:20px;left:20px;right:20px;z-index:2147483647;padding:16px;background:white;color:#222;box-shadow:0 2px 12px #888;font-family:sans-serif';
      panel.append('Data could not be confirmed. Keep this page open. Retry saving or contact the study team. ');
      const button = document.createElement('button'); button.textContent = 'Retry saving';
      button.onclick = async () => {
        button.disabled = true;
        try {
          await _drainPublicResponses();
          if (publicClosing) { publicExportRetryRequested = true; await publicFinishHandler(); }
          else { panel.remove(); _resumePublicAfterBackup(); }
        } catch (failure) { console.error('Retry failed:', failure); }
        finally { button.disabled = false; }
      };
      panel.append(button); document.body.append(panel);
    }
    function _drainPublicResponses() {
      const operation = publicResponseTail.then(async () => {
        if (publicPreparationError) throw publicPreparationError;
        await publicPersistenceReady;
        for (const item of publicResponses) {
          if (item.persisted) continue;
          if (BATCH_CONFIG.useIndexedDB) {
            item.record = await TrialDB.add(item.data, item.checkpoint);
          } else {
            if (!item.record) {
              item.record = { eventId: _publicEventId(), sequence: publicDirectSequence++, payload: JSON.parse(JSON.stringify(item.data)) };
              item.record.checkpoint = _bindPublicCheckpoint(item.checkpoint, item.record.eventId, item.record.sequence);
            }
            await sendBatchConcatenated([item.record], ++BATCH_CONFIG.currentBatchNumber);
          }
          const envelope = await _publicEventEnvelope(item.record);
          publicManifest.set(envelope.sequence, { eventId: envelope.eventId,
            sequence: envelope.sequence, payloadHash: envelope.payloadHash });
          item.persisted = true;
          _mirrorPublicCheckpoint(item.record.checkpoint);
          window.ExpBuilderNavigation.onTrialPersisted(item.data);
          item.data = null; item.record = null;
        }
      });
      publicResponseTail = operation.catch(() => {});
      return operation;
    }
    function _persistPublicResponse(data, checkpoint) {
      publicResponses.push({ data: JSON.parse(JSON.stringify(data)), checkpoint, persisted: false, record: null });
      return _drainPublicResponses();
    }
`;
}
