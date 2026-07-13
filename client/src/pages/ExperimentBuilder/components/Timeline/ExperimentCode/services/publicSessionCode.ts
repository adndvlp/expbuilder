import { captchaCode } from "../CaptchaCode";
import { loadingOverlayCode } from "../LoadingOverlay";
import { resumeCode } from "../ResumeCode";
import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicSessionCode(
  options: PublicExperimentCodeOptions,
): string {
  const {
    DATA_API_URL,
    FIREBASE_DATABASE_URL,
    experimentID,
    useStorage,
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameTokens,
    sessionNameSeparator,
    currentUid,
    evaluateCondition,
    branchingEvaluation,
    customPreInitCode,
    publicParams,
    extensions,
    progressBar,
    baseCode,
  } = options;
  void [
    DATA_API_URL,
    FIREBASE_DATABASE_URL,
    experimentID,
    useStorage,
    batchConfig,
    recruitmentConfig,
    captchaConfig,
    sessionNameTokens,
    sessionNameSeparator,
    currentUid,
    evaluateCondition,
    branchingEvaluation,
    customPreInitCode,
    publicParams,
    extensions,
    progressBar,
    baseCode,
  ];
  return `
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

  // Recuperar sessionId de localStorage o crear uno nuevo
  let trialSessionId = localStorage.getItem('jsPsych_currentSessionId');
  let storedParticipantNumber = localStorage.getItem('jsPsych_participantNumber');
  let isResuming = false;
  
  if (!trialSessionId) {
    // If there are counter tokens, use UUID as initial ID (counter needs participantNumber).
    // Otherwise use the generated name directly.
    if (_sessionNameHasDynamic()) {
      trialSessionId = (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
    } else {
      trialSessionId = _generateSessionName(null) || (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
    }
  } else {
    isResuming = true;
  }

  // Set JSPSYCH_SESSION_ID immediately so file uploads always have the current sessionId
  window.JSPSYCH_SESSION_ID = trialSessionId;

  let participantNumber;

  async function createSession() {
    try {
      const _preSessionName = !_sessionNameHasDynamic() ? _generateSessionName(null) : null;
      const res = await fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({
          experimentID: "${experimentID}",
          sessionId: trialSessionId,
          uid: Uid,
          batchSize: ${batchConfig.batchSize},
          ...(_preSessionName ? { sessionName: _preSessionName } : {})
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error creating session:', errorText);
        throw new Error(\`Failed to create session: \${res.status} - \${errorText}\`);
      }
      
      const result = await res.json();
      console.log('Session created:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to create session');
      }
      
      return result.participantNumber;
    } catch (error) {
      console.error('Error in createSession:', error);
      alert('Error creating session: ' + error.message);
      throw error;
    }
  }

  async function _updateSessionName(sessionId, sessionName) {
    try {
      await fetch("${DATA_API_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateSessionName", experimentID: "${experimentID}", sessionId, sessionName }),
      });
    } catch (e) {}
  }

  ${loadingOverlayCode()}
  ${resumeCode()}
  ${captchaCode()}
`;
}
