export function resumeStartupCode(
  resumeTrialKey = "jsPsych_resumeTrial",
): string {
  return `
    const resumeRaw = localStorage.getItem(${JSON.stringify(resumeTrialKey)});
    const resumeRouteDecision = isResuming && resumeRaw ? _resolveResumeBranch(resumeRaw) : null;
    if (isResuming && resumeRaw && !resumeRouteDecision) throw new Error('The saved navigation checkpoint is invalid');
  `;
}

export function activateResumeRouteDecisionCode(): string {
  return `
    if (resumeRouteDecision !== null) {
      window.ExpBuilderNavigation.activateResume(resumeRouteDecision);
      window.ExpBuilderRuntime?.emit('resume-route-activated', resumeRouteDecision);
    }
  `;
}
