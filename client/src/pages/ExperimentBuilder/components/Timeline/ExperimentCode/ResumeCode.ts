import { getBranchEvaluatorRuntimeCode } from "../../../modules/experiment-runtime/branchEvaluator";
import { getJumpRequestRuntimeCode } from "../../../modules/experiment-runtime/jumpRequest";
import {
  getNavigationCoordinatorRuntimeCode,
  type NavigationStorageKeys,
} from "../../../modules/experiment-runtime/navigationCoordinator";
import { getPersistenceCoordinatorRuntimeCode } from "../../../modules/experiment-runtime/persistenceCoordinator";

export function resumeCode(
  navigationStorageKeys: Partial<NavigationStorageKeys> = {},
): string {
  return `
  ${getBranchEvaluatorRuntimeCode()}
  ${getPersistenceCoordinatorRuntimeCode()}
  ${getJumpRequestRuntimeCode()}
  ${getNavigationCoordinatorRuntimeCode(navigationStorageKeys)}
  function _createResumeCheckpoint(trialData) {
    const data = trialData || {};
    const branches = data.branches || [];
    const branchConditions = data.branchConditions || [];
    const completedId = data.builder_id ?? data.trial_id ?? null;
    const decision = branches.length > 0
      ? window.ExpBuilderBranching.decide(data, branches, branchConditions)
      : null;
    const sequentialTarget = completedId === null
      ? null
      : window.ExpBuilderExecutionAddresses?.nextBySource?.[
          String(completedId)
        ] ?? null;
    return {
      version: 1,
      completed: {
        builderId: completedId,
        trialIndex: data.trial_index ?? null
      },
      route: decision && decision.targetId !== null
        ? {
            kind: 'branch',
            targetId: String(decision.targetId),
            conditionId: decision.conditionId ?? null,
            customParameters: decision.customParameters ?? null,
            usedDefault: Boolean(decision.usedDefault)
          }
        : sequentialTarget !== null
          ? {
              kind: 'sequential',
              targetId: String(sequentialTarget),
              conditionId: null,
              customParameters: null,
              usedDefault: false
            }
          : null
    };
  }
  function _resolveResumeBranch(resumeRaw) {
    if (!resumeRaw) return null;
    try {
      const d = JSON.parse(resumeRaw);
      if (d.version === 1) {
        if (!d.route || d.route.targetId === undefined ||
            d.route.targetId === null) {
          return null;
        }
        return {
          kind: d.route.kind === 'sequential' ? 'sequential' : 'branch',
          sourceId: d.completed?.builderId ?? null,
          targetId: String(d.route.targetId),
          conditionId: d.route.conditionId ?? null,
          customParameters: d.route.customParameters ?? null,
          usedDefault: Boolean(d.route.usedDefault)
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
`;
}
