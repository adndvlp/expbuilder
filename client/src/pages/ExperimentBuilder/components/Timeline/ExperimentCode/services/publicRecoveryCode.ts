import type { PublicExperimentCodeOptions } from './publicCodeTypes';

export function publicRecoveryCode({ DATA_API_URL, experimentID }: PublicExperimentCodeOptions): string {
  return `
    function _publicRecoveryIds() {
      try { const ids = JSON.parse(localStorage.getItem(_publicStorageKeys.recoverySessions) || '[]');
        return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []; } catch (_) { return []; }
    }
    function _showPublicExpiredNotice() {
      if (_publicSessionState.lifecycle !== 'expired') return;
      let panel = document.getElementById('expbuilder-expired-session');
      if (!panel) {
        panel = document.createElement('div'); panel.id = 'expbuilder-expired-session';
        panel.style.cssText = 'position:fixed;top:20px;left:20px;right:20px;z-index:2147483647;padding:16px;background:white;color:#222;font-family:sans-serif';
        panel.textContent = 'This session has ended. Earlier responses are being recovered and saved to their original session.';
        document.body.append(panel);
      }
      _offerNewPublicSession(panel);
    }
    function _offerNewPublicSession(panel) {
      if (_publicSessionState.lifecycle !== 'expired') return;
      const existing = panel.querySelector('[data-new-session]');
      if (existing) { existing.disabled = publicResponses.some(item => !item.persisted); return; }
      const button = document.createElement('button'); button.dataset.newSession = 'true';
      button.textContent = 'Start a new participation';
      button.disabled = publicResponses.some(item => !item.persisted);
      button.onclick = () => {
        if (publicResponses.some(item => !item.persisted)) return;
        const ids = [...new Set([..._publicRecoveryIds(), trialSessionId])];
        localStorage.setItem(_publicStorageKeys.recoverySessions, JSON.stringify(ids));
        localStorage.setItem(_publicStorageKeys.sessionId, crypto.randomUUID());
        localStorage.removeItem(_publicStorageKeys.participant);
        localStorage.removeItem(_publicStorageKeys.resumeTrial);
        sessionStorage.removeItem(_publicStorageKeys.captchaPassed);
        const target = typeof _publicEntryLocation === 'function' ? _publicEntryLocation(_publicSessionState.entryUrl)
          : new URL(_publicSessionState.entryUrl || window.location.href);
        target.search = window.location.search; target.hash = window.location.hash;
        window.location.assign(target.href);
      };
      panel.append(document.createElement('br'), button);
    }
    async function _recoverOlderPublicSessions() {
      for (const sessionId of _publicRecoveryIds()) {
        if (sessionId === trialSessionId) continue;
        const post = async body => {
          const response = await fetch(${JSON.stringify(DATA_API_URL)}, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ experimentID: ${JSON.stringify(experimentID)}, sessionId, ...body }) });
          if (!response.ok) throw new Error('Earlier session recovery remains pending');
          const result = await response.json();
          if (!result.success || result.experimentID !== ${JSON.stringify(experimentID)} || result.sessionId !== sessionId) throw new Error('Invalid earlier session receipt');
          return result;
        };
        const status = await post({ action: 'sessionStatus' });
        if (!['completed', 'expired'].includes(status.lifecycle)) continue;
        const rows = await TrialDB.getAll(sessionId);
        for (let offset = 0; offset < rows.length;) {
          const selected = []; let bytes = 0;
          while (offset < rows.length && selected.length < 100) {
            const row = rows[offset], length = new TextEncoder().encode(JSON.stringify(row)).byteLength + 256;
            if (selected.length && bytes + length > 900000) break;
            selected.push(row); bytes += length; offset++;
          }
          const events = await Promise.all(selected.map(_publicEventEnvelope));
          const result = await post({ action: 'recoverEvents', data: { protocolVersion: 1, events } });
          const expected = new Map(events.map(event => [event.eventId, event]));
          if (!Array.isArray(result.acknowledged) || result.acknowledged.length !== events.length) throw new Error('Invalid recovery acknowledgement');
          for (const receipt of result.acknowledged) {
            const event = expected.get(receipt.eventId);
            if (!event || event.sequence !== receipt.sequence || event.payloadHash !== receipt.payloadHash) throw new Error('Recovery acknowledgement mismatch');
            expected.delete(receipt.eventId);
          }
          await TrialDB.deleteIds(selected.map(row => row.id));
        }
        const result = await post({ action: 'sessionStatus' });
        if (result.export?.confirmed && result.export.confirmedRevision === result.export.requestedRevision) {
          localStorage.setItem(_publicStorageKeys.recoverySessions, JSON.stringify(_publicRecoveryIds().filter(id => id !== sessionId)));
        }
      }
    }
`;
}
