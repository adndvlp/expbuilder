export function buildLocalMetadataCode(): string {
  return `
  function _getSessionMetadata() {
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';
    let browserVersion = 'Unknown';
    if (userAgent.indexOf('Firefox') > -1) {
      browser = 'Firefox';
      browserVersion = userAgent.match(/Firefox\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (userAgent.indexOf('Edg') > -1) {
      browser = 'Edge';
      browserVersion = userAgent.match(/Edg\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (userAgent.indexOf('Chrome') > -1) {
      browser = 'Chrome';
      browserVersion = userAgent.match(/Chrome\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    } else if (userAgent.indexOf('Safari') > -1) {
      browser = 'Safari';
      browserVersion = userAgent.match(/Version\\/(\\d+\\.\\d+)/)?.[1] || 'Unknown';
    }

    let os = 'Unknown';
    if (userAgent.indexOf('Win') > -1) os = 'Windows';
    else if (userAgent.indexOf('Mac') > -1) os = 'macOS';
    else if (userAgent.indexOf('Android') > -1) os = 'Android';
    else if (userAgent.indexOf('iOS') > -1) os = 'iOS';
    else if (userAgent.indexOf('Linux') > -1) os = 'Linux';

    return {
      browser: browser,
      browserVersion: browserVersion,
      os: os,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      screenResolution: window.screen.width + 'x' + window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language,
      userAgent: userAgent,
      startedAt: new Date().toISOString()
    };
  }

  const metadata = _getSessionMetadata();
  let socket = null;

  function waitForSocket(timeoutMs) {
    return new Promise(function(resolve) {
      let settled = false;
      const finish = function(ready) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(ready);
      };
      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.onload = function() { finish(typeof window.io === 'function'); };
      script.onerror = function() { finish(false); };
      const timeout = setTimeout(function() { finish(false); }, timeoutMs || 5000);
      document.head.appendChild(script);
    });
  }

  function _emitPresence(eventName, payload) {
    if (!socket) return Promise.resolve(false);
    return new Promise(function(resolve) {
      let settled = false;
      const timeout = setTimeout(function() {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, 3000);
      socket.emit(eventName, payload, function(result) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(Boolean(result && result.success === true));
      });
    });
  }
`;
}
