import { Props, ParamsOverrideRule, LoadedTrial } from "./types";
import { useParamsOverride } from "./useParamsOverride";
import { FaCog } from "react-icons/fa";
import {
  addCondition as addConditionAction,
  removeCondition as removeConditionAction,
  addRuleToCondition as addRuleToConditionAction,
  removeRuleFromCondition as removeRuleFromConditionAction,
  updateRule as updateRuleAction,
  addParameterToOverride as addParameterToOverrideAction,
} from "./ConditionActions";
import { ConditionBlock } from "./ConditionBlock/ConditionBlock";

function ParamsOverride({ selectedTrial }: Props) {
  const {
    conditions,
    setConditions,
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
    setConditionsWrapper,
  } = useParamsOverride(selectedTrial);

  // Action handlers with autosave
  const addCondition = () => {
    setConditionsWrapper(addConditionAction(conditions));
  };

  const removeCondition = (conditionId: number) => {
    setConditionsWrapper(removeConditionAction(conditions, conditionId));
  };

  const addRuleToCondition = (conditionId: number) => {
    setConditionsWrapper(addRuleToConditionAction(conditions, conditionId));
  };

  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditionsWrapper(
      removeRuleFromConditionAction(conditions, conditionId, ruleIndex),
    );
  };

  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: keyof ParamsOverrideRule,
    value: string | number,
    shouldSave: boolean = true,
  ) => {
    setConditionsWrapper(
      updateRuleAction(
        conditions,
        conditionId,
        ruleIndex,
        field,
        value,
        loadTrialDataFields,
      ),
      shouldSave,
    );
  };

  const addParameterToOverride = (conditionId: number) => {
    // Determine if current trial is dynamic plugin
    const trial = selectedTrial as { plugin?: string };
    const isDynamic = trial?.plugin === "plugin-dynamic";
    setConditionsWrapper(
      addParameterToOverrideAction(
        conditions,
        conditionId,
        currentTrialParameters,
        isDynamic,
      ),
      true, // trigger autosave
    );
  };

  const availableTrials = getAvailableTrials();

  return (
    <>
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

      {/* Scrollable Content */}
      <div
        className="px-6 pb-6 pt-4"
        style={{
          maxHeight: "calc(85vh - 180px)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {conditions.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              borderRadius: "16px",
              border: "2px dashed var(--neutral-mid)",
              backgroundColor: "var(--background)",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 16px",
                borderRadius: "50%",
                backgroundColor: "var(--neutral-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--gold)",
              }}
            >
              <FaCog size={32} />
            </div>
            <p
              style={{
                marginBottom: "24px",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-dark)",
              }}
            >
              No override conditions configured
            </p>
            <button
              onClick={addCondition}
              style={{
                padding: "12px 32px",
                borderRadius: "10px",
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
              + Add first condition
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {conditions.map((condition, condIdx) => {
              const availableTrialsForCondition =
                getAvailableTrialsForCondition(condition.id);
              const paramKeys = condition.paramsToOverride
                ? Object.keys(condition.paramsToOverride)
                : [];
              const canAddMoreParams =
                currentTrialParameters.length > 0 &&
                paramKeys.length < currentTrialParameters.length;

              // Check if any rule references a dynamic plugin trial
              const hasDynamicTrial = condition.rules.some((rule) => {
                if (!rule.trialId) return false;
                const referencedTrial = findTrialByIdSync(rule.trialId);
                const refTrial = referencedTrial as { plugin?: string };
                return refTrial?.plugin === "plugin-dynamic";
              });

              // Check if current trial is dynamic
              const currentTrialIsDynamic =
                (selectedTrial as { plugin?: string })?.plugin ===
                "plugin-dynamic";

              return (
                <ConditionBlock
                  key={condition.id}
                  condition={condition}
                  condIdx={condIdx}
                  availableTrialsForCondition={availableTrialsForCondition}
                  currentTrialParameters={currentTrialParameters}
                  canAddMoreParams={canAddMoreParams}
                  removeCondition={removeCondition}
                  updateRule={updateRule}
                  removeRuleFromCondition={removeRuleFromCondition}
                  addRuleToCondition={addRuleToCondition}
                  addParameterToOverride={addParameterToOverride}
                  findTrialByIdSync={findTrialByIdSync}
                  trialDataFields={trialDataFields}
                  loadingData={loadingData}
                  getCurrentTrialCsvColumns={getCurrentTrialCsvColumns}
                  setConditions={setConditions}
                  setConditionsWrapper={setConditionsWrapper}
                  conditions={conditions}
                  hasDynamicTrial={hasDynamicTrial}
                  currentTrial={
                    currentTrialIsDynamic
                      ? (selectedTrial as LoadedTrial)
                      : null
                  }
                />
              );
            })}
          </div>
        )}

        {/* Add Condition (OR) Button */}
        {conditions.length > 0 && availableTrials.length > 0 && (
          <button
            onClick={addCondition}
            className="mt-6 px-6 py-3 rounded-lg w-full font-semibold shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
            style={{
              marginTop: 12,
              marginBottom: 12,
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
            }}
          >
            <span className="text-xl">+</span> Add condition (OR)
          </button>
        )}
      </div>

      {/* Footer with Save Button */}
      <div className="px-6 pb-4">
        <button
          onClick={() => handleSaveConditions()}
          style={{
            width: "100%",
            padding: "14px 32px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
            background:
              "linear-gradient(135deg, var(--gold), var(--dark-gold))",
            color: "white",
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
          Save Params Override
        </button>
      </div>
    </>
  );
}

export default ParamsOverride;
