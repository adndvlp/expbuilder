import { getBranchEvaluatorRuntimeCode } from "../../../modules/experiment-runtime/branchEvaluator";
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
  ${getNavigationCoordinatorRuntimeCode(navigationStorageKeys)}
  function _createResumeCheckpoint(trialData) {
    const data = trialData || {};
    const checkpoint = {
      completed: {
        builderId: data.builder_id ?? data.trial_id ?? null,
        trialIndex: data.trial_index ?? null
      }
    };
    return window.ExpBuilderNavigation.checkpointTrialComplete(data, checkpoint);
  }
  function _resolveResumeBranch(resumeRaw) {
    if (!resumeRaw) return null;
    try {
      const d = JSON.parse(resumeRaw);
      if (d.version === 3) {
        const cursor = d.cursor;
        if (typeof d.experimentRevision !== 'string' || !d.experimentRevision ||
            !cursor || cursor.targetId === undefined || cursor.targetId === null ||
            !Array.isArray(cursor.loops) || !cursor.globalRouting ||
            cursor.loops.some(frame => typeof frame.loopId !== 'string' ||
              !Array.isArray(frame.order) || frame.order.length === 0 ||
              frame.order.some(index => !Number.isInteger(index) || index < 0) ||
              new Set(frame.order).size !== frame.order.length ||
              !Number.isInteger(frame.cursor) || frame.cursor < 0 ||
              frame.cursor >= frame.order.length ||
              !Number.isInteger(frame.repetition) || frame.repetition < 0 ||
              !Array.isArray(frame.cycleRows) || !frame.routing)) return null;
        return {
          kind: 'cursor',
          sourceId: d.completed?.builderId ?? null,
          targetId: String(cursor.targetId),
          experimentRevision: d.experimentRevision,
          afterCompleted: Boolean(cursor.afterCompleted),
          loops: cursor.loops,
          globalRouting: cursor.globalRouting
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }
`;
}
