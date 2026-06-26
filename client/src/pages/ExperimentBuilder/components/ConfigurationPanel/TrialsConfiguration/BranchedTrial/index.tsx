import { useState } from "react";
import useTrials from "../../../../hooks/useTrials";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import { BranchCondition, Loop, RepeatCondition, Trial } from "../../types";
import { Condition, Props, Parameter } from "./types";
import Modal from "../ParameterMapper/Modal";
import useLoadData from "./useLoadData";
import BranchedTrialLayout from "./BranchedTrialLayout";
import { FaTimes } from "react-icons/fa";
import {
  idsEqual,
  includesId,
  isForwardSameScopeTarget,
  itemIdKey,
} from "../../../../utils/branchGraphUtils";

function BranchedTrial({ selectedTrial, onClose, isOpen = true }: Props) {
  const {
    updateTrial,
    updateLoop,
    getTrial,
    getLoop,
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
  const [loadedTrials, setLoadedTrials] = useState<Record<string, any>>({});

  const loadTargetTrialParameters = async (trialId: string | number) => {
    const targetTrial = await findTrialById(trialId);

    if (!targetTrial) return;

    // Store the loaded trial
    setLoadedTrials((prev) => ({ ...prev, [trialId]: targetTrial }));

    // Load CSV columns if available
    if (targetTrial.csvColumns && targetTrial.csvColumns.length > 0) {
      setTargetTrialCsvColumns((prev) => ({
        ...prev,
        [trialId]: targetTrial.csvColumns,
      }));
    }

    // Check if it's a Loop - loops have different parameters
    if ("trials" in targetTrial) {
      // Define loop-specific parameters
      const loopParameters: Parameter[] = [
        { label: "Repetitions", key: "repetitions", type: "number" },
        { label: "Randomize", key: "randomize", type: "boolean" },
        { label: "Categories", key: "categories", type: "boolean" },
        { label: "Category Column", key: "categoryColumn", type: "string" },
        { label: "Orders", key: "orders", type: "boolean" },
      ];
      setTargetTrialParameters((prev) => ({
        ...prev,
        [trialId]: loopParameters,
      }));
      return;
    }

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
    setRepeatConditions: () => {}, // Empty function since it is not used
  });

  // Find trial or loop by ID using the API
  const findTrialById = async (trialId: string | number): Promise<any> => {
    try {
      // Check if it's a loop (IDs start with "loop_")
      const isLoop = String(trialId).startsWith("loop_");

      if (isLoop) {
        const loop = await getLoop(trialId);
        return loop;
      } else {
        const trial = await getTrial(trialId);
        return trial;
      }
    } catch (error) {
      console.error("Error finding trial/loop:", error);
      return null;
    }
  };

  // Find trial or loop by ID synchronously from loaded trials
  const findTrialByIdSync = (trialId: string | number): any => {
    return loadedTrials[trialId] || null;
  };

  /**
   * Get available trials to reference (trials that come before the current trial)
   * If trial is inside a loop (has parentLoopId):
   *   - Show trials from same loop (loopTimeline) that come before
   *   - Show ALL trials from main timeline (to allow jumping out of the loop)
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

      // 2. Add ALL trials from main timeline (to allow jumping out)
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

  const getTopLevelLoopTrialIds = () =>
    new Set(
      timeline
        .filter((item) => item.type === "loop")
        .flatMap((loop) => loop.trials || [])
        .map((id) => itemIdKey(id)),
    );

  const getBranchScopeTimeline = () =>
    selectedTrial?.parentLoopId ? loopTimeline : timeline;

  const isBranchTarget = (trialId: string | number | null): boolean => {
    if (!trialId || !selectedTrial) return false;

    if (includesId(selectedTrial.branches, trialId)) {
      return true;
    }

    const scopeTimeline = getBranchScopeTimeline();
    const target = scopeTimeline.find((item) => idsEqual(item.id, trialId));
    if (!target) return false;

    if (
      !selectedTrial.parentLoopId &&
      target.type === "trial" &&
      (target.parentLoopId ||
        getTopLevelLoopTrialIds().has(itemIdKey(target.id)))
    ) {
      return false;
    }

    return isForwardSameScopeTarget(scopeTimeline, selectedTrial.id, trialId);
  };

  const appendBranchTarget = (
    branchIds: (string | number)[],
    branchId: string | number,
  ) => {
    if (!includesId(branchIds, branchId)) {
      branchIds.push(branchId);
    }
  };

  const areSameBranchTargets = (
    a: (string | number)[] = [],
    b: (string | number)[] = [],
  ) =>
    a.length === b.length &&
    a.every((branchId, index) => idsEqual(branchId, b[index]));

  /**
   * Save conditions to the trial
   *
   * This function separates conditions into two categories:
   * 1. branchConditions: Conditions where nextTrialId is in branches[] (same scope, can override params)
   * 2. repeatConditions: Conditions where nextTrialId is NOT in branches[] (jump to any trial, no param override)
   */
  const handleSaveConditions = (conditionsToSave?: Condition[]) => {
    if (!selectedTrial) return;

    const currentConditions = conditionsToSave || conditions;

    // Separate conditions into branch conditions and repeat conditions
    const branchConditions: BranchCondition[] = [];
    const repeatConditionsToSave: RepeatCondition[] = [];
    const branchTargets: (string | number)[] = [];

    currentConditions.forEach((condition) => {
      if (condition.nextTrialId && isBranchTarget(condition.nextTrialId)) {
        appendBranchTarget(branchTargets, condition.nextTrialId);
        // It's a branch condition (within scope)
        branchConditions.push({
          id: condition.id,
          rules: condition.rules,
          nextTrialId: condition.nextTrialId,
          customParameters: condition.customParameters,
        });
      } else if (condition.nextTrialId) {
        // It's a jump/repeat condition (outside scope)
        repeatConditionsToSave.push({
          id: condition.id,
          rules: condition.rules,
          jumpToTrialId: condition.nextTrialId,
        });
      }
    });

    // Note: Don't add existing repeatConditions again - they're already included in currentConditions
    // The conditions array from state already contains ALL conditions (both branch and jump)

    // Update backend and selectedTrial
    const hadSavedConditions =
      Boolean(selectedTrial.branchConditions?.length) ||
      Boolean(selectedTrial.repeatConditions?.length);
    const shouldSyncBranches = currentConditions.length > 0 || hadSavedConditions;

    const saveBranchingConfiguration = async () => {
      const updates: {
        branches?: (string | number)[];
        branchConditions: BranchCondition[];
        repeatConditions: RepeatCondition[];
      } = {
        branchConditions,
        repeatConditions: repeatConditionsToSave,
      };

      if (
        shouldSyncBranches &&
        !areSameBranchTargets(selectedTrial.branches || [], branchTargets)
      ) {
        updates.branches = branchTargets;
      }

      if ("trials" in selectedTrial) {
        await updateLoop(selectedTrial.id, updates as Partial<Loop>);
      } else {
        await updateTrial(selectedTrial.id, updates as Partial<Trial>);
      }
    };

    saveBranchingConfiguration().catch((error) => {
      console.error("Error saving conditions:", error);
    });

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose || (() => {})}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            minWidth: "900px",
            maxWidth: "1100px",
            minHeight: "60vh",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            backgroundColor: "var(--background)",
            borderRadius: "12px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {/* Save Indicator */}
          <div
            style={{
              opacity: saveIndicator ? 1 : 0,
              transition: "opacity 0.3s",
              color: "white",
              fontWeight: "600",
              position: "absolute",
              top: "10px",
              right: "10px",
              zIndex: 10000,
              backgroundColor: "rgba(34, 197, 94, 0.95)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              border: "1px solid white",
              pointerEvents: "none",
            }}
          >
            ✓ Saved
          </div>
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "2px solid var(--neutral-mid)",
              backgroundColor: "var(--background)",
              color: "var(--text-dark)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-blue)";
              e.currentTarget.style.color = "white";
              e.currentTarget.style.borderColor = "var(--primary-blue)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--background)";
              e.currentTarget.style.color = "var(--text-dark)";
              e.currentTarget.style.borderColor = "var(--neutral-mid)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <FaTimes size={18} />
          </button>
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
        </div>
      </div>
    </Modal>
  );
}

export default BranchedTrial;
