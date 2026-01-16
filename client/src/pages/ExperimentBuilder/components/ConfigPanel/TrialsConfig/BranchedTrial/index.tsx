import { useState, useEffect, useRef } from "react";
import useTrials from "../../../../hooks/useTrials";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import { BranchCondition, RepeatCondition } from "../../types";
import ParamsOverride from "../ParamsOverride";
import { Condition, RepeatConditionState, Props, Parameter } from "./types";
import BranchConditions from "./BranchConditions";

function BranchedTrial({ selectedTrial, onClose }: Props) {
  const { timeline, updateTrial, getTrial, setSelectedTrial } = useTrials();

  const [activeTab, setActiveTab] = useState<"branch" | "params">("branch");
  const [data, setData] = useState<import("../../types").DataDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [repeatConditions, setRepeatConditions] = useState<
    RepeatConditionState[]
  >([]);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [targetTrialParameters, setTargetTrialParameters] = useState<
    Record<string, Parameter[]>
  >({});
  const [targetTrialCsvColumns, setTargetTrialCsvColumns] = useState<
    Record<string, string[]>
  >({});

  // Ref to track if we are saving to avoid reloading state and causing flickers
  const isSavingRef = useRef(false);

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
  }, [selectedTrial]);

  // Load existing branch conditions and repeat conditions when selectedTrial changes
  useEffect(() => {
    // If we just saved, skip reloading to prevent flickering/state reset
    if (isSavingRef.current) {
      isSavingRef.current = false;
      return;
    }

    const allConditions: Condition[] = [];

    // Load branch conditions (within scope)
    if (selectedTrial && selectedTrial.branchConditions) {
      const loadedBranchConditions = selectedTrial.branchConditions.map(
        (bc: BranchCondition) => ({
          ...bc,
          customParameters: bc.customParameters || {},
        })
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
        })
      );
      allConditions.push(...loadedRepeatConditions);
    }

    setConditions(allConditions);

    // Keep separate repeat conditions for the old Repeat tab (will be removed later)
    if (selectedTrial && selectedTrial.repeatConditions) {
      const loadedRepeatConditions = selectedTrial.repeatConditions.map(
        (rc: RepeatCondition) => ({
          ...rc,
        })
      );
      setRepeatConditions(loadedRepeatConditions);
    } else {
      setRepeatConditions([]);
    }
  }, [selectedTrial]);

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
  }, [conditions]);

  // Load parameters for target trial
  const loadTargetTrialParameters = async (trialId: string | number) => {
    const targetTrial = await findTrialById(trialId);

    if (!targetTrial) return;

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

  // Find trial by ID using the API
  const findTrialById = async (trialId: string | number): Promise<any> => {
    try {
      const trial = await getTrial(trialId);
      return trial;
    } catch (error) {
      console.error("Error finding trial:", error);
      return null;
    }
  };

  /**
   * Helper function to check if a trialId is in the branches array
   * Branches are trials within the same scope that can have their parameters overridden
   */
  const isInBranches = (trialId: string | number | null): boolean => {
    if (!trialId || !selectedTrial?.branches) return false;
    return selectedTrial.branches.some(
      (branchId: string | number) => String(branchId) === String(trialId)
    );
  };

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

    currentConditions.forEach((condition) => {
      if (condition.nextTrialId && isInBranches(condition.nextTrialId)) {
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

    // Add existing repeat conditions from the separate tab (if any)
    repeatConditions.forEach((condition) => {
      repeatConditionsToSave.push({
        id: condition.id,
        rules: condition.rules,
        jumpToTrialId: condition.jumpToTrialId,
      });
    });

    // Update trial using the API
    const updateData = {
      branchConditions,
      repeatConditions: repeatConditionsToSave,
    };

    // Set flag to prevent useEffect from resetting state
    isSavingRef.current = true;

    updateTrial(selectedTrial.id, updateData)
      .then((updatedTrial) => {
        // Update selectedTrial with the new data so changes reflect immediately
        if (updatedTrial) {
          setSelectedTrial(updatedTrial);
        }
      })
      .catch((error) => {
        console.error("Error saving conditions:", error);
        isSavingRef.current = false; // Reset flag on error
      });

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
    }, 1500);
  };

  return (
    <div
      className="rounded-lg shadow-2xl"
      style={{
        position: "relative",
        color: "var(--text-dark)",
        minWidth: "900px",
        maxWidth: "1100px",
        maxHeight: "85vh",
        backgroundColor: "var(--neutral-light)",
        overflow: "hidden",
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
          top: "20px",
          right: "60px", // Moved left to make room for close button
          zIndex: 10000,
          backgroundColor: "rgba(34, 197, 94, 0.95)",
          padding: "8px 16px",
          borderRadius: "8px",
          fontSize: "14px",
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
          background: "transparent",
          border: "none",
          color: "var(--text-dark)",
          fontSize: "24px",
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 10001,
        }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Tab Navigation */}
      <div
        className="px-6 pt-4 pb-2"
        style={{
          borderBottom: "2px solid var(--neutral-mid)",
        }}
      >
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("branch")}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${
              activeTab === "branch"
                ? "shadow-lg"
                : "opacity-60 hover:opacity-80"
            }`}
            style={{
              backgroundColor:
                activeTab === "branch"
                  ? "var(--primary-blue)"
                  : "var(--neutral-mid)",
              color:
                activeTab === "branch"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "branch" ? "3px solid var(--gold)" : "none",
            }}
          >
            Branch & Jump Conditions
          </button>
          <button
            onClick={() => setActiveTab("params")}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${
              activeTab === "params"
                ? "shadow-lg"
                : "opacity-60 hover:opacity-80"
            }`}
            style={{
              backgroundColor:
                activeTab === "params"
                  ? "var(--primary-blue)"
                  : "var(--neutral-mid)",
              color:
                activeTab === "params"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "params" ? "3px solid var(--gold)" : "none",
            }}
          >
            Params Override
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="px-6 pb-6 pt-4"
        style={{
          maxHeight: "calc(85vh - 180px)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {loading && (
          <div
            className="text-center py-8 rounded-lg border"
            style={{
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--neutral-mid)",
            }}
          >
            <div
              className="inline-block animate-spin rounded-full h-8 w-8 border-4"
              style={{
                borderColor: "var(--primary-blue)",
                borderTopColor: "transparent",
              }}
            ></div>
            <p className="mt-3" style={{ color: "var(--text-dark)" }}>
              Loading data fields...
            </p>
          </div>
        )}
        {error && (
          <div
            className="border-2 py-4 px-4 rounded-lg"
            style={{
              backgroundColor: "rgba(207, 0, 11, 0.1)",
              borderColor: "var(--danger)",
              color: "var(--text-dark)",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && activeTab === "branch" && (
          <BranchConditions
            conditions={conditions}
            setConditions={setConditions}
            loadTargetTrialParameters={loadTargetTrialParameters}
            findTrialById={findTrialById}
            targetTrialParameters={targetTrialParameters}
            targetTrialCsvColumns={targetTrialCsvColumns}
            selectedTrial={selectedTrial}
            data={data}
            onAutoSave={handleSaveConditions}
          />
        )}

        {/* PARAMS OVERRIDE TAB CONTENT */}
        {activeTab === "params" && (
          <ParamsOverride selectedTrial={selectedTrial} onClose={onClose} />
        )}
      </div>

      {/* Footer con botón de guardar - Fixed position */}
      {/* Only show save button for branch and repeat tabs, params has its own */}
      {activeTab !== "params" && (
        <div>
          <button
            onClick={handleSaveConditions}
            className="px-8 py-3 rounded-lg font-bold w-full shadow-lg transform transition hover:scale-105"
            style={{
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
            }}
          >
            Save configuration
          </button>
        </div>
      )}
    </div>
  );
}

export default BranchedTrial;
