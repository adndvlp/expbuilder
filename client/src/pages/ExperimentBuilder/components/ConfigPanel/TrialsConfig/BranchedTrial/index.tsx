import { useState, useEffect, useRef } from "react";
import useTrials from "../../../../hooks/useTrials";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import { BranchCondition, RepeatCondition } from "../../types";
import ParamsOverride from "../ParamsOverride";
import { Condition, RepeatConditionState, Props, Parameter } from "./types";
import BranchConditions from "./BranchConditions";
import Modal from "../ParameterMapper/Modal";
import { FaTimes } from "react-icons/fa";

function BranchedTrial({ selectedTrial, onClose, isOpen = true }: Props) {
  const {
    timeline,
    updateTrial,
    updateTrialField,
    getTrial,
    getLoop,
    setSelectedTrial,
  } = useTrials();

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
  const [loadedTrials, setLoadedTrials] = useState<Record<string, any>>({});
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
  }, [selectedTrial?.id]);

  // Load existing branch conditions and repeat conditions when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasLoaded.current = false;
      return;
    }

    if (hasLoaded.current) return;
    hasLoaded.current = true;

    if (!selectedTrial) return;

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
  }, [conditions]);

  // Load parameters for target trial
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
   * Helper function to check if a trialId is in the branches array
   * Branches are trials within the same scope that can have their parameters overridden
   */
  const isInBranches = (trialId: string | number | null): boolean => {
    if (!trialId || !selectedTrial?.branches) return false;
    return selectedTrial.branches.some(
      (branchId: string | number) => String(branchId) === String(trialId),
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

    // Update backend and selectedTrial
    Promise.all([
      updateTrialField(selectedTrial.id, "branchConditions", branchConditions),
      updateTrialField(
        selectedTrial.id,
        "repeatConditions",
        repeatConditionsToSave,
      ),
    ]).catch((error) => {
      console.error("Error saving conditions:", error);
    });

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
    }, 1500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
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

          {/* Tab Navigation */}
          <div
            style={{
              borderBottom: "2px solid var(--neutral-mid)",
              padding: "16px 24px 8px",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setActiveTab("branch")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px 8px 0 0",
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  backgroundColor:
                    activeTab === "branch"
                      ? "var(--primary-blue)"
                      : "var(--neutral-light)",
                  color:
                    activeTab === "branch"
                      ? "var(--text-light)"
                      : "var(--text-dark)",
                  borderBottom:
                    activeTab === "branch" ? "3px solid var(--gold)" : "none",
                  opacity: activeTab === "branch" ? 1 : 0.7,
                  boxShadow:
                    activeTab === "branch"
                      ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                      : "none",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "branch") {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.backgroundColor =
                      "var(--neutral-mid)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "branch") {
                    e.currentTarget.style.opacity = "0.7";
                    e.currentTarget.style.backgroundColor =
                      "var(--neutral-light)";
                  }
                }}
              >
                Branch & Jump Conditions
              </button>
              <button
                onClick={() => setActiveTab("params")}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px 8px 0 0",
                  fontWeight: 600,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  backgroundColor:
                    activeTab === "params"
                      ? "var(--primary-blue)"
                      : "var(--neutral-light)",
                  color:
                    activeTab === "params"
                      ? "var(--text-light)"
                      : "var(--text-dark)",
                  borderBottom:
                    activeTab === "params" ? "3px solid var(--gold)" : "none",
                  opacity: activeTab === "params" ? 1 : 0.7,
                  boxShadow:
                    activeTab === "params"
                      ? "0 4px 12px rgba(61, 146, 180, 0.3)"
                      : "none",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== "params") {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.backgroundColor =
                      "var(--neutral-mid)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== "params") {
                    e.currentTarget.style.opacity = "0.7";
                    e.currentTarget.style.backgroundColor =
                      "var(--neutral-light)";
                  }
                }}
              >
                Params Override
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div
            style={{
              flex: 1,
              padding: "24px",
              overflowY: "auto",
              overflowX: "hidden",
              backgroundColor: "var(--background)",
            }}
          >
            {loading && (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px",
                  borderRadius: "12px",
                  border: "1px solid var(--neutral-mid)",
                  backgroundColor: "var(--neutral-light)",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    width: "32px",
                    height: "32px",
                    border: "4px solid var(--primary-blue)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                <p
                  style={{
                    marginTop: "12px",
                    color: "var(--text-dark)",
                    fontSize: "14px",
                  }}
                >
                  Loading data fields...
                </p>
              </div>
            )}
            {error && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "2px solid var(--danger)",
                  backgroundColor: "rgba(207, 0, 11, 0.05)",
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
                findTrialById={findTrialByIdSync}
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

          {/* Footer con botón de guardar */}
          {activeTab !== "params" && (
            <div
              style={{
                padding: "16px 24px",
                borderTop: "2px solid var(--neutral-mid)",
                backgroundColor: "var(--background)",
              }}
            >
              <button
                onClick={handleSaveConditions}
                style={{
                  width: "100%",
                  padding: "12px 32px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  background:
                    "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                  color: "var(--text-light)",
                  boxShadow: "0 4px 12px rgba(212, 175, 55, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 16px rgba(212, 175, 55, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(212, 175, 55, 0.3)";
                }}
              >
                Save configuration
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default BranchedTrial;
