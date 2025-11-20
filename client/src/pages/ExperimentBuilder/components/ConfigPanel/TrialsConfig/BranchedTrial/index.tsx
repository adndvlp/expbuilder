import { useState, useEffect } from "react";
import useTrials from "../../../../hooks/useTrials";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import { BranchCondition, RepeatCondition } from "../../types";
import ParamsOverride from "../ParamsOverride";
import {
  Condition,
  RepeatConditionState,
  Props,
  Parameter,
  TabType,
} from "./types";
import BranchConditions from "./BranchConditions";
import RepeatConditions from "./RepeatConditions";

function BranchedTrial({ selectedTrial, onClose }: Props) {
  const { trials, setTrials } = useTrials();

  const [activeTab, setActiveTab] = useState<TabType>("branch");
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

  // Load existing branch conditions when selectedTrial changes
  useEffect(() => {
    if (selectedTrial && selectedTrial.branchConditions) {
      const loadedConditions = selectedTrial.branchConditions.map(
        (bc: BranchCondition) => ({
          ...bc,
          customParameters: bc.customParameters || {},
        })
      );
      setConditions(loadedConditions);

      // Load parameters for each condition with a nextTrialId
      loadedConditions.forEach((condition: Condition) => {
        if (condition.nextTrialId) {
          console.log("Loading parameters for trial:", condition.nextTrialId);
          loadTargetTrialParameters(condition.nextTrialId);
        }
      });
    } else {
      setConditions([]);
    }

    // Load existing repeat conditions
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
        console.log(
          "Loading parameters for newly selected trial:",
          condition.nextTrialId
        );
        loadTargetTrialParameters(condition.nextTrialId);
      }
    });
  }, [conditions]);

  // Load parameters for target trial
  const loadTargetTrialParameters = async (trialId: string | number) => {
    const targetTrial = findTrialById(trialId);
    console.log("loadTargetTrialParameters called for:", trialId, targetTrial);

    if (!targetTrial) {
      console.log("Target trial not found");
      return;
    }

    // Check if it's a Loop - loops have different parameters
    if ("trials" in targetTrial) {
      console.log("Target is a Loop, setting loop-specific parameters");
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

    // Type guard to ensure we have a plugin property (for regular trials)
    console.log("Checking plugin property:", {
      hasPlugin: "plugin" in targetTrial,
      pluginValue: targetTrial.plugin,
      targetTrial,
    });

    if ("plugin" in targetTrial && targetTrial.plugin) {
      try {
        console.log("Loading plugin parameters for:", targetTrial.plugin);
        const result = await loadPluginParameters(targetTrial.plugin);
        console.log("Loaded parameters:", result.parameters);
        setTargetTrialParameters((prev) => {
          const updated = {
            ...prev,
            [trialId]: result.parameters,
          };
          console.log("Updated targetTrialParameters:", updated);
          return updated;
        });
      } catch (err) {
        console.error("Error loading target trial parameters:", err);
      }
    } else {
      console.log("Target trial has no plugin property or plugin is null", {
        hasPlugin: "plugin" in targetTrial,
        plugin: targetTrial.plugin,
      });
    }
  };

  // Find trial by ID
  // Find trial by ID recursively at any depth
  const findTrialById = (trialId: string | number): any => {
    console.log("Finding trial:", trialId, "in trials:", trials);

    const findRecursive = (items: any[]): any => {
      for (const item of items) {
        // Check direct ID match
        if (item.id === trialId || String(item.id) === String(trialId)) {
          console.log("Found trial:", item);
          return item;
        }
        // If it's a loop, search recursively in its trials
        if ("trials" in item && Array.isArray(item.trials)) {
          const found = findRecursive(item.trials);
          if (found) return found;
        }
      }
      return null;
    };

    const result = findRecursive(trials);
    if (!result) {
      console.log("Trial not found!");
    }
    return result;
  };

  // Save conditions to the trial
  const handleSaveConditions = () => {
    if (!selectedTrial) return;

    const branchConditions: BranchCondition[] = conditions.map((condition) => ({
      id: condition.id,
      rules: condition.rules,
      nextTrialId: condition.nextTrialId,
      customParameters: condition.customParameters,
    }));

    const repeatConditionsToSave: RepeatCondition[] = repeatConditions.map(
      (condition) => ({
        id: condition.id,
        rules: condition.rules,
        jumpToTrialId: condition.jumpToTrialId,
      })
    );

    // Recursive function to find and update the trial
    const updateTrialRecursive = (items: any[]): any[] => {
      return items.map((item) => {
        // Check if this is the trial we're looking for
        if (
          item.id === selectedTrial.id ||
          String(item.id) === String(selectedTrial.id)
        ) {
          return {
            ...item,
            branchConditions,
            repeatConditions: repeatConditionsToSave,
          };
        }

        // If it's a loop, recursively update its trials
        if ("trials" in item && Array.isArray(item.trials)) {
          return {
            ...item,
            trials: updateTrialRecursive(item.trials),
          };
        }

        return item;
      });
    };

    const updatedTrials = updateTrialRecursive(trials);

    setTrials(updatedTrials);
    console.log("Branch conditions saved:", branchConditions);

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
      // Close modal after showing indicator
      if (onClose) {
        onClose();
      }
    }, 1500);
  };

  return (
    <div
      className="rounded-lg shadow-2xl"
      style={{
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
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10000,
          backgroundColor: "rgba(34, 197, 94, 0.95)",
          padding: "16px 32px",
          borderRadius: "12px",
          fontSize: "18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          border: "2px solid white",
          pointerEvents: "none",
        }}
      >
        ✓ Branch Conditions Saved!
      </div>

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
            Branch Trials
          </button>
          <button
            onClick={() => setActiveTab("repeat")}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${
              activeTab === "repeat"
                ? "shadow-lg"
                : "opacity-60 hover:opacity-80"
            }`}
            style={{
              backgroundColor:
                activeTab === "repeat"
                  ? "var(--primary-blue)"
                  : "var(--neutral-mid)",
              color:
                activeTab === "repeat"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "repeat" ? "3px solid var(--gold)" : "none",
            }}
          >
            Repeat/Jump
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
            selectedTrial={selectedTrial}
            data={data}
          />
        )}

        {/* REPEAT/JUMP TAB CONTENT */}
        {!loading && !error && activeTab === "repeat" && (
          <RepeatConditions
            selectedTrial={selectedTrial}
            repeatConditions={repeatConditions}
            setRepeatConditions={setRepeatConditions}
            data={data}
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
