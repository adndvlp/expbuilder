import { useState, useEffect, useCallback } from "react";
import useTrials from "../../../../hooks/useTrials";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import {
  ParamsOverrideCondition,
  ParamsOverrideRule,
  Parameter,
  LoadedTrial,
} from "./types";
import { DataDefinition } from "../../types";

export const useParamsOverride = (selectedTrial: unknown) => {
  const { timeline, getTrial, updateTrial, setSelectedTrial } = useTrials();

  const [conditions, setConditions] = useState<ParamsOverrideCondition[]>([]);
  const [trialDataFields, setTrialDataFields] = useState<
    Record<string, DataDefinition[]>
  >({});
  const [loadingData, setLoadingData] = useState<Record<string, boolean>>({});
  const [currentTrialParameters, setCurrentTrialParameters] = useState<
    Parameter[]
  >([]);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [loadedTrials, setLoadedTrials] = useState<Record<string, LoadedTrial>>(
    {},
  );

  // Load data fields for the current trial's parameters
  useEffect(() => {
    const loadCurrentTrialParams = async () => {
      const trial = selectedTrial as { plugin?: string };
      if (!selectedTrial || !trial.plugin) {
        setCurrentTrialParameters([]);
        return;
      }

      try {
        const result = await loadPluginParameters(trial.plugin);
        setCurrentTrialParameters(result.parameters);
      } catch (err) {
        console.error("Error loading current trial parameters:", err);
        setCurrentTrialParameters([]);
      }
    };

    loadCurrentTrialParams();
  }, [selectedTrial]);

  // Load existing params override conditions
  useEffect(() => {
    if (
      selectedTrial &&
      (selectedTrial as { paramsOverride?: ParamsOverrideCondition[] })
        .paramsOverride
    ) {
      const trial = selectedTrial as {
        paramsOverride: ParamsOverrideCondition[];
      };
      setConditions(trial.paramsOverride);

      // Load data fields for each trial that appears in the conditions
      trial.paramsOverride.forEach((condition: ParamsOverrideCondition) => {
        condition.rules.forEach((rule: ParamsOverrideRule) => {
          if (rule.trialId) {
            loadTrialDataFields(rule.trialId);
          }
        });
      });
    } else {
      setConditions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrial]);

  // Load data fields for a specific trial
  const loadTrialDataFields = async (trialId: string | number) => {
    if (trialDataFields[trialId] || loadingData[trialId]) {
      return;
    }

    try {
      const trial = await getTrial(trialId);
      if (!trial || !trial.plugin) {
        console.log("Trial not found or has no plugin:", trialId);
        return;
      }

      // Store the loaded trial
      setLoadedTrials((prev) => ({ ...prev, [trialId]: trial }));

      setLoadingData((prev) => ({ ...prev, [trialId]: true }));

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

  // Get available trials to reference (trials that come before the current trial)
  const getAvailableTrials = (): { id: string | number; name: string }[] => {
    const trial = selectedTrial as { id?: string | number };
    if (!selectedTrial) return [];

    const allTrials: { id: string | number; name: string }[] = [];

    // Find position of current trial in timeline
    const currentIndex = timeline.findIndex(
      (item) => item.id === trial.id || String(item.id) === String(trial.id),
    );

    if (currentIndex === -1) return [];

    // Get all trials/loops that come before
    for (let i = 0; i < currentIndex; i++) {
      const item = timeline[i];
      allTrials.push({ id: item.id, name: item.name });
    }

    return allTrials;
  };

  // Get used trial IDs in a condition
  const getUsedTrialIds = (conditionId: number): (string | number)[] => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition
      ? condition.rules.map((r) => r.trialId).filter(Boolean)
      : [];
  };

  // Get available trials for a specific condition (excluding already used)
  const getAvailableTrialsForCondition = (conditionId: number) => {
    const usedIds = getUsedTrialIds(conditionId);
    const allAvailable = getAvailableTrials();

    return allAvailable.filter(
      (t) => !usedIds.includes(t.id) && !usedIds.includes(String(t.id)),
    );
  };

  // Get CSV columns for the current trial
  const getCurrentTrialCsvColumns = (): string[] => {
    const trial = selectedTrial as { csvColumns?: string[] };
    if (!selectedTrial) return [];

    if (trial.csvColumns && trial.csvColumns.length > 0) {
      return trial.csvColumns;
    }

    return [];
  };

  // Save conditions
  const handleSaveConditions = async (
    conditionsToSave?: ParamsOverrideCondition[],
  ) => {
    const trial = selectedTrial as { id?: string | number };
    if (!selectedTrial || !trial.id) return;

    const dataToSave = conditionsToSave || conditions;

    try {
      const updatedTrial = await updateTrial(trial.id, {
        paramsOverride: dataToSave,
      });

      console.log("Params override conditions saved:", dataToSave);

      // Update selectedTrial with the new data so changes reflect immediately
      if (updatedTrial) {
        setSelectedTrial(updatedTrial);
      }

      // Show save indicator
      setSaveIndicator(true);
      setTimeout(() => {
        setSaveIndicator(false);
      }, 1500);
    } catch (error) {
      console.error("Error saving params override conditions:", error);
    }
  };

  // Wrapper for setConditions with auto-save (like BranchConditions)
  const setConditionsWrapper = (
    newConditions: ParamsOverrideCondition[],
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
    currentTrialParameters,
    saveIndicator,
    loadTrialDataFields,
    findTrialByIdSync,
    getAvailableTrials,
    getAvailableTrialsForCondition,
    getCurrentTrialCsvColumns,
    handleSaveConditions,
  };
};
