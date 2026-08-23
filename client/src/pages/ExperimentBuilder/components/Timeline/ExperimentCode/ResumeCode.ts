import { getBranchEvaluatorRuntimeCode } from "../../../modules/experiment-runtime/branchEvaluator";
import { getNavigationCoordinatorRuntimeCode } from "../../../modules/experiment-runtime/navigationCoordinator";
import { getPersistenceCoordinatorRuntimeCode } from "../../../modules/experiment-runtime/persistenceCoordinator";

export function resumeCode(): string {
  return `
  ${getBranchEvaluatorRuntimeCode()}
  ${getPersistenceCoordinatorRuntimeCode()}
  ${getNavigationCoordinatorRuntimeCode()}
  function _resolveResumeBranch(resumeRaw) {
    if (!resumeRaw) return null;
    try {
      const d = JSON.parse(resumeRaw);
      const branches = d.branches || [];
      const branchConditions = d.branchConditions || [];
      const trialData = d.trialData || {};

      if (branches.length === 0) return null;
      const decision = window.ExpBuilderBranching.decide(
        trialData,
        branches,
        branchConditions
      );
      return decision.targetId === null ? null : String(decision.targetId);
    } catch (error) {
      return null;
    }
  }
`;
}
