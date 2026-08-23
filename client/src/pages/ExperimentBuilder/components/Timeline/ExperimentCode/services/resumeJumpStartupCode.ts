export function resumeJumpStartupCode(): string {
  return `
    const resumeRaw = localStorage.getItem('jsPsych_resumeTrial');
    const jumpStartup =
      window.ExpBuilderNavigation.consumeReloadMarker();
    const existingJump = jumpStartup.request;
    const comingFromJumpReload = jumpStartup.status === 'ready';
    const jumpStartupInvalid =
      jumpStartup.status === 'invalid' || jumpStartup.status === 'stalled';
    let resumeRouteDecision = null;

    const startFreshRoutedSession = () => {
      localStorage.removeItem('jsPsych_resumeTrial');
      localStorage.removeItem('jsPsych_currentSessionId');
      localStorage.removeItem('jsPsych_participantNumber');
      trialSessionId = _generateSessionName(null) || (crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2, 10));
      isResuming = false;
    };

    if (existingJump) {
      startFreshRoutedSession();
      window.ExpBuilderRuntime?.emit('jump-reload-resume', {
        ...(existingJump.context || {}),
        targetId: existingJump.address.targetId,
        targetKind: existingJump.address.targetKind,
        progress: existingJump.cursor.progress,
        comingFromJumpReload,
        newSessionId: String(trialSessionId)
      });
    } else if (jumpStartupInvalid) {
      startFreshRoutedSession();
    } else if (isResuming && resumeRaw) {
      resumeRouteDecision = _resolveResumeBranch(resumeRaw);
      if (resumeRouteDecision === null) {
        startFreshRoutedSession();
      }
    }
`;
}

export function activateResumeRouteDecisionCode(): string {
  return `
    if (resumeRouteDecision !== null) {
      const resumesBranch = resumeRouteDecision.kind === 'branch';
      window.nextTrialId = resumesBranch
        ? resumeRouteDecision.targetId
        : null;
      window.skipRemaining = resumesBranch;
      window.branchingActive = resumesBranch;
      window.branchCustomParameters =
        resumesBranch
          ? resumeRouteDecision.customParameters ?? null
          : null;
      if (!resumesBranch) {
        window.ExpBuilderNavigation.activateResume(resumeRouteDecision);
      }
      window.ExpBuilderRuntime?.emit(
        'resume-route-activated',
        resumeRouteDecision
      );
    }
`;
}
