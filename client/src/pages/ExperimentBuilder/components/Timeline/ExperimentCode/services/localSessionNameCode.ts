import type { LocalExperimentCodeOptions } from "./localCodeTypes";

export function buildLocalSessionNameCode({
  experimentID,
  sessionNameSeparator,
  sessionNameTokens,
}: LocalExperimentCodeOptions): string {
  return `
  const _SESSION_NAME_TOKENS = ${JSON.stringify(sessionNameTokens)};
  const _SESSION_NAME_SEPARATOR = ${JSON.stringify(sessionNameSeparator)};

  function _generateSessionName(participantNumber) {
    if (!_SESSION_NAME_TOKENS || _SESSION_NAME_TOKENS.length === 0) return null;
    const now = new Date();
    const pad = function(value, length) {
      return String(value).padStart(length == null ? 2 : length, '0');
    };
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    const second = pad(now.getSeconds());
    const parts = _SESSION_NAME_TOKENS.map(function(token) {
      switch (token.type) {
        case 'date':
          if (token.dateFormat === 'YYYYMMDD') return year + '' + month + day;
          if (token.dateFormat === 'DD-MM-YYYY') return day + '-' + month + '-' + year;
          if (token.dateFormat === 'MM-DD-YYYY') return month + '-' + day + '-' + year;
          return year + '-' + month + '-' + day;
        case 'time':
          if (token.timeFormat === 'HH-mm') return hour + '-' + minute;
          if (token.timeFormat === 'HHmmss') return hour + '' + minute + second;
          return hour + '-' + minute + '-' + second;
        case 'randomAlpha': {
          const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          return Array.from({ length: token.randomLength || 6 }, function() {
            return characters[Math.floor(Math.random() * characters.length)];
          }).join('');
        }
        case 'customText': return token.customValue || '';
        case 'counter':
          return Number.isInteger(participantNumber) && participantNumber > 0
            ? pad(participantNumber, token.counterDigits || 3)
            : '';
        default: return '';
      }
    }).filter(function(part) { return part !== ''; });
    const hasUniqueToken = _SESSION_NAME_TOKENS.some(function(token) {
      return token.type === 'randomAlpha' || token.type === 'counter';
    });
    if (!hasUniqueToken && parts.length > 0) {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      parts.push(Array.from({ length: 6 }, function() {
        return characters[Math.floor(Math.random() * characters.length)];
      }).join(''));
    }
    return parts.length > 0 ? parts.join(_SESSION_NAME_SEPARATOR) : null;
  }

  function _sessionNameHasDynamic() {
    return _SESSION_NAME_TOKENS.some(function(t) { return t.type === 'counter'; });
  }

  async function _renameSessionIfNeeded(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return oldId;
    try {
      const _r = await fetch('/api/rename-session/${experimentID}', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSessionId: oldId, newSessionId: newId })
      });
      if (_r.ok) return newId;
    } catch (_e) {}
    return oldId;
  }

  async function _setSessionDisplayName(sessionId, displayName) {
    if (!displayName) return;
    try {
      const response = await fetch('/api/rename-session/${experimentID}', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sessionId: sessionId, displayName: displayName })
      });
      const body = await response.json().catch(function() { return null; });
      if (!response.ok || !body || body.success !== true) {
        console.warn('[session-persistence] display name was not saved', {
          experimentID: ${JSON.stringify(experimentID)},
          sessionId: sessionId,
          status: response.status
        });
      }
    } catch (_error) {
      console.warn('[session-persistence] display name request failed', {
        experimentID: ${JSON.stringify(experimentID)},
        sessionId: sessionId
      });
    }
  }
`;
}
