import { useCallback, useMemo, useState } from "react";
import useTrials from "../../../hooks/useTrials";
import type { Trial } from "../../ConfigurationPanel/types";
import {
  addScopedBranchTrial,
  addScopedParentTrial,
} from "../actions";
import type {
  CanvasActionDependencies,
  CanvasActionScope,
} from "../actions";
import { useExperimentID } from "../../../hooks/useExperimentID";
import {
  createLoopBranch,
  loadLoopBranchLevels,
} from "../features/loop-branching/loopBranchApi";
import type {
  SelectedLoopBranchLevel,
  StartedLoopBranchIntent,
} from "../../../modules/experiment-authoring/intents/loopBranch";
import {
  commitLoopBranchIntent,
  selectLoopBranchLevel,
  startLoopBranchIntent,
} from "../../../modules/experiment-authoring/intents/loopBranch";
import { isRevisionConflict } from "../../../modules/experiment-authoring/http";

export function useCanvasBranchActions(
  trials: ReturnType<typeof useTrials>,
  actionScope?: CanvasActionScope,
) {
  const experimentId = useExperimentID();
  const [showAddTrialModal, setShowAddTrialModal] = useState(false);
  const [showLoopBranchLevelModal, setShowLoopBranchLevelModal] =
    useState(false);
  const [startedLoopBranchIntent, setStartedLoopBranchIntent] =
    useState<StartedLoopBranchIntent | null>(null);
  const [selectedLoopBranchLevel, setSelectedLoopBranchLevel] =
    useState<SelectedLoopBranchLevel | null>(null);
  const [isCreatingLoopBranch, setIsCreatingLoopBranch] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<
    string | number | null
  >(null);
  const { setSelectedLoop, setSelectedTrial } = trials;
  const loopBranchIntentDependencies = useMemo(
    () => ({
      loadLevels: loadLoopBranchLevels,
      createBranch: createLoopBranch,
    }),
    [],
  );
  const loopBranchLevels = startedLoopBranchIntent?.levels ?? [];
  const scope = useMemo<CanvasActionScope>(
    () =>
      actionScope ?? {
        kind: "root",
        items: trials.timeline,
      },
    [actionScope, trials.timeline],
  );
  const dependencies = useMemo<CanvasActionDependencies>(
    () => ({
      createTrial: trials.createTrial,
      createLoop: trials.createLoop,
      getTrial: trials.getTrial,
      getLoop: trials.getLoop,
      updateTrial: trials.updateTrial,
      updateLoop: trials.updateLoop,
      updateTrialField: trials.updateTrialField,
      updateTimeline: trials.updateTimeline,
    }),
    [
      trials.createLoop,
      trials.createTrial,
      trials.getLoop,
      trials.getTrial,
      trials.updateLoop,
      trials.updateTimeline,
      trials.updateTrial,
      trials.updateTrialField,
    ],
  );

  const selectTrial = useCallback(
    (trial: Trial) => {
      setSelectedTrial(trial);
      setSelectedLoop(null);
    },
    [setSelectedLoop, setSelectedTrial],
  );

  const addBranch = useCallback(
    (parentId: string | number) =>
      addScopedBranchTrial({
        scope,
        dependencies,
        parentId,
        onSelectTrial: selectTrial,
      }),
    [dependencies, scope, selectTrial],
  );

  const addParent = useCallback(
    (parentId: string | number) =>
      addScopedParentTrial({
        scope,
        dependencies,
        parentId,
        onSelectTrial: selectTrial,
      }),
    [dependencies, scope, selectTrial],
  );

  const resetLoopBranchFlow = useCallback(() => {
    setShowLoopBranchLevelModal(false);
    setShowAddTrialModal(false);
    setStartedLoopBranchIntent(null);
    setSelectedLoopBranchLevel(null);
    setPendingParentId(null);
  }, []);

  const submitLoopBranch = useCallback(
    async (
      placement: "parallel" | "sequential",
      selection: SelectedLoopBranchLevel,
    ) => {
      if (!startedLoopBranchIntent) return;
      setIsCreatingLoopBranch(true);
      setShowAddTrialModal(false);
      setShowLoopBranchLevelModal(false);
      try {
        const result = await commitLoopBranchIntent({
          intent: startedLoopBranchIntent,
          selection,
          placement,
          dependencies: loopBranchIntentDependencies,
        });
        trials.applyGraphSnapshot(result.graph);
        selectTrial(result.trial);
        resetLoopBranchFlow();
      } catch (error: unknown) {
        console.error("Error creating loop branch:", error);
        if (isRevisionConflict(error)) {
          try {
            const refreshed = await startLoopBranchIntent({
              experimentId: startedLoopBranchIntent.experimentId,
              sourceTrialId: startedLoopBranchIntent.sourceTrialId,
              dependencies: loopBranchIntentDependencies,
            });
            setStartedLoopBranchIntent(refreshed);
            setSelectedLoopBranchLevel(null);
          } catch (refreshError) {
            console.error("Error refreshing loop branch levels:", refreshError);
          }
        }
        setShowLoopBranchLevelModal(true);
      } finally {
        setIsCreatingLoopBranch(false);
      }
    },
    [
      loopBranchIntentDependencies,
      resetLoopBranchFlow,
      selectTrial,
      startedLoopBranchIntent,
      trials,
    ],
  );

  const onAddBranch = useCallback(
    async (parentId: string | number) => {
      const parent = scope.items.find(
        (item) => String(item.id) === String(parentId),
      );
      if (!parent) return;
      if (
        scope.kind === "loop" &&
        parent.type === "trial" &&
        experimentId
      ) {
        try {
          const intent = await startLoopBranchIntent({
            experimentId,
            sourceTrialId: parentId,
            dependencies: loopBranchIntentDependencies,
          });
          setPendingParentId(parentId);
          setStartedLoopBranchIntent(intent);
          setSelectedLoopBranchLevel(null);
          setShowLoopBranchLevelModal(true);
        } catch (error: unknown) {
          console.error("Error loading loop branch levels:", error);
        }
        return;
      }
      if ((parent.branches ?? []).length === 0) {
        try {
          await addBranch(parentId);
        } catch (error: unknown) {
          console.error("Error adding branch:", error);
        }
        return;
      }
      setPendingParentId(parentId);
      setShowAddTrialModal(true);
    },
    [addBranch, experimentId, loopBranchIntentDependencies, scope],
  );

  const handleLoopBranchLevelConfirm = useCallback(
    async (scopeId: string | null) => {
      if (!startedLoopBranchIntent) return;
      const selection = selectLoopBranchLevel(startedLoopBranchIntent, scopeId);
      if (!selection) return;
      setShowLoopBranchLevelModal(false);
      setSelectedLoopBranchLevel(selection);
      if (selection.requiresPlacement) {
        setShowAddTrialModal(true);
        return;
      }
      await submitLoopBranch("parallel", selection);
    },
    [startedLoopBranchIntent, submitLoopBranch],
  );

  const handleAddTrialConfirm = useCallback(
    async (addAsBranch: boolean) => {
      if (pendingParentId === null) return;
      if (selectedLoopBranchLevel) {
        await submitLoopBranch(
          addAsBranch ? "parallel" : "sequential",
          selectedLoopBranchLevel,
        );
        return;
      }
      setShowAddTrialModal(false);
      try {
        if (addAsBranch) await addBranch(pendingParentId);
        else await addParent(pendingParentId);
      } catch (error: unknown) {
        console.error(
          addAsBranch
            ? "Error adding branch:"
            : "Error adding trial as parent:",
          error,
        );
      } finally {
        setPendingParentId(null);
      }
    },
    [
      addBranch,
      addParent,
      pendingParentId,
      selectedLoopBranchLevel,
      submitLoopBranch,
    ],
  );

  return {
    showAddTrialModal,
    setShowAddTrialModal,
    showLoopBranchLevelModal,
    loopBranchLevels,
    isCreatingLoopBranch,
    pendingParentId,
    setPendingParentId,
    onAddBranch,
    handleLoopBranchLevelConfirm,
    handleAddTrialConfirm,
    cancelLoopBranchFlow: resetLoopBranchFlow,
  };
}
