import { Dispatch, SetStateAction, useEffect, useRef } from "react";
import {
  BranchCondition,
  DataDefinition,
  FieldDefinition,
  Trial,
  Loop,
} from "../../types";
import { Condition, Parameter } from "./types";
import type { TimelineItem } from "../../../../contexts/TrialsContext";

type Props = {
  isOpen: boolean;
  conditions: Condition[];
  selectedTrial: Trial | Loop | null;
  targetTrialParameters: Record<string, Parameter[]>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  setData: Dispatch<SetStateAction<DataDefinition[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  loadPluginParameters(pluginName: string): Promise<{
    parameters: FieldDefinition[];
    data: DataDefinition[];
  }>;
  getLoopTimeline: (loopId: string | number) => Promise<TimelineItem[]>;
  setConditions: Dispatch<SetStateAction<Condition[]>>;
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
}: Props) {
  const hasLoaded = useRef(false);
  const requestedTargetIds = useRef<Set<string>>(new Set());

  const requestTargetTrialParameters = (trialId: string | number) => {
    const targetKey = String(trialId);
    if (requestedTargetIds.current.has(targetKey)) return;
    if (targetTrialParameters[trialId]) return;

    requestedTargetIds.current.add(targetKey);
    loadTargetTrialParameters(trialId).catch(() => {
      requestedTargetIds.current.delete(targetKey);
    });
  };

  // Load data fields from the selected trial's plugin
  useEffect(() => {
    const pluginName =
      selectedTrial && "plugin" in selectedTrial
        ? selectedTrial.plugin
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
  }, [selectedTrial?.id]);

  // Load branch conditions when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasLoaded.current = false;
      requestedTargetIds.current.clear();
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
    if (!("trials" in selectedTrial) && selectedTrial.branchConditions) {
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
          requestTargetTrialParameters(condition.nextTrialId);
        }
      });
    }

    setConditions(allConditions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Also load parameters when conditions change (e.g., when nextTrialId is set)
  useEffect(() => {
    conditions.forEach((condition) => {
      if (
        condition.nextTrialId &&
        !targetTrialParameters[condition.nextTrialId]
      ) {
        requestTargetTrialParameters(condition.nextTrialId);
      }
    });
  }, [conditions]);
}
