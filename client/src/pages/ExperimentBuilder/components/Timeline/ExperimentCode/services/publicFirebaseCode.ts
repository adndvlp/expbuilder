import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function publicFirebaseCode(
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
  // --- Recolectar metadata del sistema ---
  const getMetadata = () => {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
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

  // --- Firebase config ---
  const firebaseConfig = {
    apiKey: "${import.meta.env.VITE_FIREBASE_API_KEY}",
    authDomain: "${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}",
    databaseURL: "${FIREBASE_DATABASE_URL}",
    projectId: "${import.meta.env.VITE_FIREBASE_PROJECT_ID}",
    storageBucket: "${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${import.meta.env.VITE_FIREBASE_APP_ID}"
  };

  // --- Cargar Firebase SDK ---
  if (typeof window.firebase === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
    script.onload = () => {
      const dbScript = document.createElement('script');
      dbScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
      dbScript.onload = () => { window._firebaseReady = true; };
      document.head.appendChild(dbScript);
    };
    document.head.appendChild(script);
  } else {
    window._firebaseReady = true;
  }

  function waitForFirebase() {
    return new Promise(resolve => {
      if (window._firebaseReady) return resolve();
      const interval = setInterval(() => {
        if (window._firebaseReady) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

 
  const Uid = "${currentUid}";
`;
}
