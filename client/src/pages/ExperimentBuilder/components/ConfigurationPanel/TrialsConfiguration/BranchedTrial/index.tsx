import { useState } from "react";
import useTrials from "../../../../hooks/useTrials";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import { Condition, Props, Parameter } from "./types";
import useLoadData from "./useLoadData";
import BranchedTrialLayout from "./BranchedTrialLayout";
import {
  isBranchTargetFromUserContext,
  saveBranchingIntent,
} from "../../../../modules/experiment-authoring/intents/branching";

import BranchedTrialModalFrame from "./components/BranchedTrialModalFrame";
import type { Trial, Loop } from "../../types";

function BranchedTrial({ selectedTrial, onClose, isOpen = true }: Props) {
  const {
    updateTrial,
    updateLoop,
    getTrial,
    graph,
    timeline,
    loopTimeline,
    getLoopTimeline,
  } = useTrials();
  const [data, setData] = useState<import("../../types").DataDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [targetTrialParameters, setTargetTrialParameters] = useState<
    Record<string, Parameter[]>
  >({});
  const [targetTrialCsvColumns, setTargetTrialCsvColumns] = useState<
    Record<string, string[]>
  >({});
  const [loadedTrials, setLoadedTrials] = useState<
    Record<string, Trial | Loop>
  >({});

  const loadTargetTrialParameters = async (trialId: string | number) => {
    const targetTrial = await findTrialById(trialId);

    if (!targetTrial) return;

    // Store the loaded trial
    setLoadedTrials((prev) => ({ ...prev, [trialId]: targetTrial }));

    // Load CSV columns if available
    const csvColumns = targetTrial.csvColumns;
    if (csvColumns && csvColumns.length > 0) {
      setTargetTrialCsvColumns((prev) => ({
        ...prev,
        [trialId]: csvColumns,
      }));
    }

    if ("trials" in targetTrial) return;

    if ("plugin" in targetTrial && targetTrial.plugin) {
      try {
        const result = await loadPluginParameters(targetTrial.plugin);
        setTargetTrialParameters((prev) => ({
          ...prev,
          [trialId]: result.parameters,
        }));
      } catch (err) {
        console.error("Error loading target trial parameters:", err);
      }
    }
  };

  useLoadData({
    isOpen,
    conditions,
    selectedTrial,
    targetTrialParameters,
    loadTargetTrialParameters,
    setData,
    setError,
    setLoading,
    loadPluginParameters,
    getLoopTimeline,
    setConditions,
  });

  // Find trial or loop by ID using the API
  const findTrialById = async (
    trialId: string | number,
  ): Promise<Trial | Loop | null> => {
    try {
      return await getTrial(trialId);
    } catch (error) {
      console.error("Error finding trial/loop:", error);
      return null;
    }
  };

  // Find trial or loop by ID synchronously from loaded trials
  const findTrialByIdSync = (trialId: string | number): Trial | Loop | null => {
    return loadedTrials[trialId] || null;
  };

  /**
   * Get available trials to reference (trials that come before the current trial)
   * If trial is inside a loop (has parentLoopId):
   *   - Show trials from same loop (loopTimeline) that come before
   *   - Show ALL trials from main timeline (to reference parent data of the loop)
   * If trial is outside a loop, show all trials from main timeline
   */
  const getAvailableTrials = (): { id: string | number; name: string }[] => {
    if (!selectedTrial) return [];

    const allTrials: { id: string | number; name: string }[] = [];

    // Check if trial is inside a loop
    if (selectedTrial.parentLoopId) {
      // Trial is inside a loop

      // 1. Add trials from the same loop that come before
      const currentIndex = loopTimeline.findIndex(
        (item) =>
          item.id === selectedTrial.id ||
          String(item.id) === String(selectedTrial.id),
      );

      if (currentIndex !== -1) {
        for (let i = 0; i < currentIndex; i++) {
          const item = loopTimeline[i];
          allTrials.push({
            id: item.id,
            name: `${item.name} (Loop)`,
          });
        }
      }

      // 2. Add ALL trials from main timeline (to reference parent data)
      timeline.forEach((item) => {
        // Only add if not already in the list (avoid duplicates)
        if (!allTrials.some((t) => String(t.id) === String(item.id))) {
          allTrials.push({
            id: item.id,
            name: `${item.name} (Main)`,
          });
        }
      });
    } else {
      // Trial is outside a loop - show all trials from main timeline
      const currentIndex = timeline.findIndex(
        (item) =>
          item.id === selectedTrial.id ||
          String(item.id) === String(selectedTrial.id),
      );

      if (currentIndex === -1) return [];

      // Get all trials/loops that come before
      for (let i = 0; i < currentIndex; i++) {
        const item = timeline[i];
        allTrials.push({ id: item.id, name: item.name });
      }
    }

    return allTrials;
  };

  const isBranchTarget = (trialId: string | number | null): boolean => {
    if (!selectedTrial || trialId == null) return false;
    const items = graph
      ? [graph.root, ...Object.values(graph.scopes)].flatMap(
          (scope) => scope.items,
        )
      : [...timeline, ...loopTimeline];
    return isBranchTargetFromUserContext({
      selectedItem: selectedTrial,
      targetId: trialId,
      scopeTimeline: items,
    });
  };

  const handleSaveConditions = (conditionsToSave?: Condition[]) => {
    if (!selectedTrial) return;

    const currentConditions = conditionsToSave || conditions;
    void saveBranchingIntent({
      item: selectedTrial,
      conditions: currentConditions,
      isBranchTarget,
      dependencies: { updateTrial, updateLoop },
    })
      .then(() => {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1500);
      })
      .catch((error) => {
        setError(error instanceof Error ? error.message : String(error));
      });
  };

  return (
    <BranchedTrialModalFrame
      isOpen={isOpen}
      onClose={onClose}
      saveIndicator={saveIndicator}
    >
      <BranchedTrialLayout
        data={data}
        conditions={conditions}
        selectedTrial={selectedTrial}
        error={error}
        loading={loading}
        targetTrialParameters={targetTrialParameters}
        targetTrialCsvColumns={targetTrialCsvColumns}
        onClose={onClose}
        handleSaveConditions={handleSaveConditions}
        setConditions={setConditions}
        loadTargetTrialParameters={loadTargetTrialParameters}
        findTrialByIdSync={findTrialByIdSync}
        getAvailableTrials={getAvailableTrials}
      />
    </BranchedTrialModalFrame>
  );
}

export default BranchedTrial;
