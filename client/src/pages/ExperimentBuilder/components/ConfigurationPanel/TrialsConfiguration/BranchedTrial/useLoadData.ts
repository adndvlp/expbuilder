import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import {
  BranchCondition,
  DataDefinition,
  FieldDefinition,
  RepeatCondition,
} from "../../types";
import { Condition, Parameter, RepeatConditionState } from "./types";

type Props = {
  isOpen: boolean;
  conditions: Condition[];
  selectedTrial: any;
  targetTrialParameters: Record<string, Parameter[]>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  setData: Dispatch<SetStateAction<DataDefinition[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  loadPluginParameters(pluginName: string): Promise<{
    parameters: FieldDefinition[];
    data: DataDefinition[];
  }>;
  getLoopTimeline: (loopId: string | number) => Promise<any>;
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  setRepeatConditions: Dispatch<SetStateAction<RepeatConditionState[]>>;
};

export default function useLoadData({
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
  setRepeatConditions,
}: Props) {
  const hasLoaded = useRef(false);
  // Load data fields from the selected trial's plugin
  useEffect(() => {
    const pluginName =
      selectedTrial && "plugin" in selectedTrial
        ? (selectedTrial as any).plugin
        : undefined;
    if (!pluginName) {
      setData([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    loadPluginParameters(pluginName)
      .then((result) => {
        setData(result.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setData([]);
        setLoading(false);
      });
  }, [
    selectedTrial?.id,
    loadPluginParameters,
    selectedTrial,
    setError,
    setData,
    setLoading,
  ]);

  // Load existing branch conditions and repeat conditions when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasLoaded.current = false;
      return;
    }

    if (hasLoaded.current) return;
    hasLoaded.current = true;

    if (!selectedTrial) return;

    // Load loopTimeline if trial is inside a loop
    if (selectedTrial.parentLoopId) {
      getLoopTimeline(selectedTrial.parentLoopId);
    }

    const allConditions: Condition[] = [];

    // Load branch conditions (within scope)
    if (selectedTrial && selectedTrial.branchConditions) {
      const loadedBranchConditions = selectedTrial.branchConditions.map(
        (bc: BranchCondition) => ({
          ...bc,
          customParameters: bc.customParameters || {},
        }),
      );
      allConditions.push(...loadedBranchConditions);

      // Load parameters for each condition with a nextTrialId
      loadedBranchConditions.forEach((condition: Condition) => {
        if (condition.nextTrialId) {
          loadTargetTrialParameters(condition.nextTrialId);
        }
      });
    }

    // Load repeat conditions (jump to any trial) and convert them to Condition format
    if (selectedTrial && selectedTrial.repeatConditions) {
      const loadedRepeatConditions = selectedTrial.repeatConditions.map(
        (rc: RepeatCondition) => ({
          id: rc.id,
          rules: rc.rules,
          nextTrialId: rc.jumpToTrialId, // Map jumpToTrialId to nextTrialId
          customParameters: {}, // Jump conditions don't have custom parameters
        }),
      );
      allConditions.push(...loadedRepeatConditions);
    }

    setConditions(allConditions);

    // Keep separate repeat conditions for the old Repeat tab (will be removed later)
    if (selectedTrial && selectedTrial.repeatConditions) {
      const loadedRepeatConditions = selectedTrial.repeatConditions.map(
        (rc: RepeatCondition) => ({
          ...rc,
        }),
      );
      setRepeatConditions(loadedRepeatConditions);
    } else {
      setRepeatConditions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Also load parameters when conditions change (e.g., when nextTrialId is set)
  useEffect(() => {
    conditions.forEach((condition) => {
      if (
        condition.nextTrialId &&
        !targetTrialParameters[condition.nextTrialId]
      ) {
        loadTargetTrialParameters(condition.nextTrialId);
      }
    });
  }, [conditions, targetTrialParameters, loadTargetTrialParameters]);
}
