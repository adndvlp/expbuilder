import { loadingOverlayCode } from "../LoadingOverlay";
import { resumeCode } from "../ResumeCode";
import { LocalExperimentCodeOptions } from "./localCodeTypes";

export function buildLocalSessionPrelude({
  experimentID,
  sessionNameTokens,
  sessionNameSeparator,
}: LocalExperimentCodeOptions) {
  return `
  // --- FileUploadResponseComponent endpoint (local Express server) ---
  window.JSPSYCH_FILE_UPLOAD_ENDPOINT = '/api/participant-files/${experimentID}';

  // --- Session Name Configuration ---
  const _SESSION_NAME_TOKENS = ${JSON.stringify(sessionNameTokens)};
  const _SESSION_NAME_SEPARATOR = ${JSON.stringify(sessionNameSeparator)};
  function _generateSessionName(participantNumber) {
    if (!_SESSION_NAME_TOKENS || _SESSION_NAME_TOKENS.length === 0) return null;
    const _now = new Date();
    const _pad = (n, len) => String(n).padStart(len != null ? len : 2, '0');
    const _y = _now.getFullYear();
    const _mo = _pad(_now.getMonth() + 1);
    const _d = _pad(_now.getDate());
    const _h = _pad(_now.getHours());
    const _mi = _pad(_now.getMinutes());
    const _s = _pad(_now.getSeconds());
    const _parts = _SESSION_NAME_TOKENS.map(function(_token) {
      switch (_token.type) {
        case 'date': {
          if (_token.dateFormat === 'YYYYMMDD') return _y + '' + _mo + _d;
          if (_token.dateFormat === 'DD-MM-YYYY') return _d + '-' + _mo + '-' + _y;
          if (_token.dateFormat === 'MM-DD-YYYY') return _mo + '-' + _d + '-' + _y;
          return _y + '-' + _mo + '-' + _d;
        }
        case 'time': {
          if (_token.timeFormat === 'HH-mm') return _h + '-' + _mi;
          if (_token.timeFormat === 'HHmmss') return _h + '' + _mi + _s;
          return _h + '-' + _mi + '-' + _s;
        }
        case 'randomAlpha': {
          const _chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          return Array.from({ length: _token.randomLength || 6 }, function() {
            return _chars[Math.floor(Math.random() * _chars.length)];
          }).join('');
        }
        case 'customText': return _token.customValue || '';
        case 'counter': {
          if (participantNumber == null) return '__CNT__';
          return _pad(participantNumber, _token.counterDigits || 3);
        }
        default: return '';
      }
    }).filter(function(p) { return p !== ''; });
    // Safety net: if no randomAlpha or counter token, append a 6-char random suffix for uniqueness
    const _hasUnique = _SESSION_NAME_TOKENS.some(function(t) { return t.type === 'randomAlpha' || t.type === 'counter'; });
    if (!_hasUnique && _parts.length > 0) {
      const _rc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      _parts.push(Array.from({ length: 6 }, function() { return _rc[Math.floor(Math.random() * _rc.length)]; }).join(''));
    }
    return _parts.length > 0 ? _parts.join(_SESSION_NAME_SEPARATOR) : null;
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
    } catch(e) {}
    return oldId;
  }

  // --- Recolectar metadata del sistema ---
  const getMetadata = () => {
    const ua = navigator.userAgent;    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    
    if (ua.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Chrome') > -1) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Safari') > -1) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (ua.indexOf('Edg') > -1) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edg\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    }
    
    let osName = 'Unknown';
    if (ua.indexOf('Win') > -1) osName = 'Windows';
    else if (ua.indexOf('Mac') > -1) osName = 'macOS';
    else if (ua.indexOf('Linux') > -1) osName = 'Linux';
    else if (ua.indexOf('Android') > -1) osName = 'Android';
    else if (ua.indexOf('iOS') > -1) osName = 'iOS';
    
    return {
      browser: browserName,
      browserVersion: browserVersion,
      os: osName,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      screenResolution: \`\${window.screen.width}x\${window.screen.height}\`,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language,
      userAgent: ua,
      startedAt: new Date().toISOString()
    };
  };
  
  const metadata = getMetadata();

  // --- Socket.IO para tracking en tiempo real ---
  const socketScript = document.createElement('script');
  socketScript.src = '/socket.io/socket.io.js';
  socketScript.onload = () => {
    window._socketReady = true;
  };
  document.head.appendChild(socketScript);

  function waitForSocket() {
    return new Promise(resolve => {
      if (window._socketReady) return resolve();
      const interval = setInterval(() => {
        if (window._socketReady) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  // Recuperar sessionId de localStorage o crear uno nuevo
  let trialSessionId = localStorage.getItem('jsPsych_currentSessionId');
  let isResuming = false;

  if (!trialSessionId) {
    trialSessionId = _generateSessionName(null) || (crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10));
  } else {
    isResuming = true;
  }

  // Setear JSPSYCH_SESSION_ID inmediatamente para que FileUpload tenga siempre el sessionId
  window.JSPSYCH_SESSION_ID = trialSessionId;

  let participantNumber;
  let socket;

  async function saveSession(trialSessionId) {
   
   const res = await fetch("/api/append-result/${experimentID}", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({
        sessionId: trialSessionId,
        metadata: metadata
      }),
    });
  
    const result = await res.json();
    participantNumber = result.participantNumber;
    return participantNumber;
    
  }

  ${loadingOverlayCode()}
  ${resumeCode()}
`;
}
