export function resumeJumpStartupCode(): string {
  return `
    const resumeRaw = localStorage.getItem('jsPsych_resumeTrial');
    const existingJump = localStorage.getItem('jsPsych_jumpToTrial');
    const comingFromJumpReload =
      sessionStorage.getItem('jsPsych_jumpReload') === '1';
    const jumpContextRaw = sessionStorage.getItem('jsPsych_jumpContext');
    sessionStorage.removeItem('jsPsych_jumpReload');
    sessionStorage.removeItem('jsPsych_jumpContext');

    let jumpContext = {};
    if (jumpContextRaw) {
      try {
        jumpContext = JSON.parse(jumpContextRaw);
      } catch (error) {
        jumpContext = {};
      }
    }

    const startFreshRoutedSession = () => {
      localStorage.removeItem('jsPsych_resumeTrial');
      localStorage.removeItem('jsPsych_currentSessionId');
      localStorage.removeItem('jsPsych_participantNumber');
      trialSessionId = _generateSessionName(null) || (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
      isResuming = false;
    };

    if (comingFromJumpReload && existingJump) {
      // A repeat condition reloaded the page to execute this exact target.
      // The timeline wrappers own consumption, so the target must survive startup.
      startFreshRoutedSession();
      window.ExpBuilderRuntime?.emit('jump-reload-resume', {
        ...jumpContext,
        targetId: String(existingJump),
        newSessionId: String(trialSessionId)
      });
    } else if (isResuming && resumeRaw && !existingJump) {
      const resumeTarget = _resolveResumeBranch(resumeRaw);
      if (resumeTarget !== null) {
        // Resume continues in this same runtime; no reload marker is needed.
        localStorage.setItem('jsPsych_jumpToTrial', resumeTarget);
      } else {
        startFreshRoutedSession();
      }
    }
`;
}
