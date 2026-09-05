export function resumeJumpStartupCode(
  resumeTrialKey = "jsPsych_resumeTrial",
): string {
  return `
    const resumeRaw = localStorage.getItem(${JSON.stringify(resumeTrialKey)});
    const jumpStartup =
      window.ExpBuilderNavigation.consumeReloadMarker();
    const existingJump = jumpStartup.request;
    const comingFromJumpReload = jumpStartup.status === 'ready';
    const jumpStartupInvalid =
      jumpStartup.status === 'invalid' || jumpStartup.status === 'stalled';
    let resumeRouteDecision = null;

    if (existingJump) {
      localStorage.removeItem(${JSON.stringify(resumeTrialKey)});
      window.ExpBuilderRuntime?.emit('jump-reload-resume', {
        ...(existingJump.context || {}),
        targetId: existingJump.address.targetId,
        targetKind: existingJump.address.targetKind,
        progress: existingJump.cursor.progress,
        comingFromJumpReload,
        sessionId: String(trialSessionId)
      });
    } else if (!jumpStartupInvalid && isResuming && resumeRaw) {
      resumeRouteDecision = _resolveResumeBranch(resumeRaw);
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
