import { getNavigationCoordinatorKernelCode } from "./navigationCoordinatorKernel";
import { getLoopResumeRuntimeCode } from "./loopResumeRuntimeCode";
import { getNativeTimelineNavigationCode } from "./nativeTimelineNavigation";

export type NavigationStorageKeys = { resumeTrial: string };

export function getNavigationCoordinatorRuntimeCode(
  storageKeys: Partial<NavigationStorageKeys> = {},
): string {
  return `
  (() => {
    const RESUME_TRIAL_KEY = ${JSON.stringify(storageKeys.resumeTrial ?? "jsPsych_resumeTrial")};
    let pendingBranch = null;
    let deferredResume = null;
${getNavigationCoordinatorKernelCode()}
${getLoopResumeRuntimeCode()}
${getNativeTimelineNavigationCode()}
    window.ExpBuilderNavigation = Object.freeze({
      registerTrial, registerLoop, attach, attachPreview, requestBranch,
      takeParameters, decisionFor: data => branchDecisions.get(data),
      sampleLoop, remainingLoopRepetitions, startLoop, finishLoop,
      finishLoopRow, finishLoopCycle, loopResults,
      checkpointTrialStart, checkpointTrialComplete,
      activateResume(decision) {
        if (decision?.kind !== "cursor" || decision.targetId == null || deferredResume || pendingBranch) return false;
        restoreCursor(decision);
        deferredResume = { ...decision, targetId: String(decision.targetId) };
        return true;
      },
      onTrialPersisted(data) { acknowledgeBranch(data); },
      isTransitionPending() { return pendingBranch !== null; },
      clearTransientState() {
        nativeScopes.length = 0;
        nativeTransition = null;
        loopFrames.length = 0;
        preparedLoops.clear();
        restoredLoops.clear();
        cursorCheckpointsEnabled = false;
        pendingBranch = null;
        deferredResume = null;
        localStorage.removeItem(RESUME_TRIAL_KEY);
      }
    });
  })();
`;
}
