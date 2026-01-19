import { useState, useEffect, useCallback } from "react";
import useTrials from "../../../../../hooks/useTrials";
import { loadPluginParameters } from "../../../utils/pluginParameterLoader";
import { LoopCondition, Loop, LoadedTrial } from "./types";
import { DataDefinition } from "../../../types";

export const useConditionalLoop = (
  loop: Loop,
  onSave: (conditions: LoopCondition[]) => void,
) => {
  const { getTrial, loopTimeline, activeLoopId, getLoopTimeline } = useTrials();

  const [conditions, setConditions] = useState<LoopCondition[]>([]);
  const [trialDataFields, setTrialDataFields] = useState<
    Record<string, DataDefinition[]>
  >({});
  const [loadingData, setLoadingData] = useState<Record<string, boolean>>({});
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [loadedTrials, setLoadedTrials] = useState<Record<string, LoadedTrial>>(
    {},
  );

  // Load loop timeline metadata when component mounts
  useEffect(() => {
    if (loop?.id) {
      getLoopTimeline(loop.id);
    }
  }, [loop?.id, getLoopTimeline]);

  // Load existing loop conditions
  useEffect(() => {
    if (loop && loop.loopConditions) {
      setConditions(loop.loopConditions);

      // Load data fields for each trial that appears in the conditions
      loop.loopConditions.forEach((condition) => {
        condition.rules.forEach((rule: { trialId?: string | number }) => {
          if (rule.trialId) {
            loadTrialDataFields(rule.trialId);
          }
        });
      });
    } else {
      setConditions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  // Load data fields for a specific trial using API
  const loadTrialDataFields = async (trialId: string | number) => {
    // Check if already loaded or loading
    if (trialDataFields[trialId] || loadingData[trialId]) {
      return;
    }

    setLoadingData((prev) => ({ ...prev, [trialId]: true }));

    try {
      const trial = await getTrial(trialId);

      if (!trial || !("plugin" in trial) || !trial.plugin) {
        console.log("Trial not found or has no plugin:", trialId);
        return;
      }

      // Store the loaded trial
      setLoadedTrials((prev) => ({ ...prev, [trialId]: trial }));

      const result = await loadPluginParameters(trial.plugin);
      setTrialDataFields((prev) => ({
        ...prev,
        [trialId]: result.data,
      }));
    } catch (err) {
      console.error("Error loading trial data fields:", err);
    } finally {
      setLoadingData((prev) => ({ ...prev, [trialId]: false }));
    }
  };

  // Find trial by ID synchronously from loaded trials
  const findTrialByIdSync = useCallback(
    (trialId: string | number | null): LoadedTrial | null => {
      if (!trialId) return null;
      return loadedTrials[trialId] || null;
    },
    [loadedTrials],
  );

  // Get used trial IDs in a condition to prevent duplicates
  const getUsedTrialIds = useCallback(
    (conditionId: number): (string | number)[] => {
      const condition = conditions.find((c) => c.id === conditionId);
      return condition
        ? condition.rules.map((r) => r.trialId).filter(Boolean)
        : [];
    },
    [conditions],
  );

  // Get available trials for selection (using loopTimeline from context, excluding used trials)
  const getAvailableTrials = useCallback(
    (conditionId: number) => {
      const usedIds = getUsedTrialIds(conditionId);

      // Use loopTimeline from context if it matches the current loop
      const metadata =
        activeLoopId === loop.id && loopTimeline.length > 0 ? loopTimeline : [];

      // Filter only trials (type === "trial"), excluding loops
      const allTrials = metadata
        .filter((item) => item.type === "trial")
        .map((item) => ({
          id: item.id,
          name: item.name,
        }));

      return allTrials.filter(
        (t) => !usedIds.includes(t.id) && !usedIds.includes(String(t.id)),
      );
    },
    [loopTimeline, activeLoopId, loop.id, getUsedTrialIds],
  );

  // Save conditions
  const handleSaveConditions = (conditionsToSave?: LoopCondition[]) => {
    const dataToSave = conditionsToSave || conditions;

    onSave(dataToSave);

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
    }, 1500);
  };

  // Wrapper for setConditions with auto-save
  const setConditionsWrapper = (
    newConditions: LoopCondition[],
    shouldSave = true,
  ) => {
    setConditions(newConditions);
    if (shouldSave) {
      setTimeout(() => {
        handleSaveConditions(newConditions);
      }, 500);
    }
  };

  // Trigger immediate save
  const triggerSave = () => {
    handleSaveConditions();
  };

  return {
    conditions,
    setConditions,
    setConditionsWrapper,
    triggerSave,
    trialDataFields,
    loadingData,
    saveIndicator,
    loadTrialDataFields,
    findTrialByIdSync,
    getAvailableTrials,
    handleSaveConditions,
  };
};
