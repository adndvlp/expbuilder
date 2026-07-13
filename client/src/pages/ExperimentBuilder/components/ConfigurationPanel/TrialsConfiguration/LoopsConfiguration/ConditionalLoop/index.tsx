import { FaCog } from "react-icons/fa";
import { Props } from "./types";
import { useConditionalLoop } from "./useConditionalLoop";
import {
  addCondition as addConditionAction,
  removeCondition as removeConditionAction,
  addRuleToCondition as addRuleToConditionAction,
  removeRuleFromCondition as removeRuleFromConditionAction,
  updateRule as updateRuleAction,
} from "./ConditionActions";
import ConditionsList from "./ConditionsList";

function ConditionalLoop({ loop, onSave }: Props) {
  const {
    conditions,
    setConditionsWrapper,
    trialDataFields,
    loadingData,
    saveIndicator,
    loadTrialDataFields,
    loadTrialOrLoop,
    findTrialByIdSync,
    getAvailableTrials,
    handleSaveConditions,
  } = useConditionalLoop(loop, onSave);

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
    field: string,
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

      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          background:
            "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
          color: "white",
          borderBottom: "3px solid rgba(255,255,255,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FaCog size={20} />
          </div>
          <h3
            style={{
              fontSize: "22px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Conditional Loop: {loop.name}
          </h3>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            opacity: 0.95,
            paddingLeft: "52px",
          }}
        >
          Define conditions to repeat the loop based on trial data
        </p>
      </div>

      {/* Scrollable Content */}
      <div
        className="px-6 pb-6 pt-4"
        style={{
          maxHeight: "calc(85vh - 220px)",
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
                color: "var(--primary-blue)",
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
              No conditions configured
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
                  "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                color: "var(--text-light)",
                boxShadow: "0 4px 12px rgba(61, 146, 180, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 16px rgba(61, 146, 180, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(61, 146, 180, 0.3)";
              }}
            >
              + Add first condition
            </button>
          </div>
        ) : (
          <ConditionsList
            addRuleToCondition={addRuleToCondition}
            conditions={conditions}
            findTrialByIdSync={findTrialByIdSync}
            getAvailableTrials={getAvailableTrials}
            loadTrialDataFields={loadTrialDataFields}
            loadTrialOrLoop={loadTrialOrLoop}
            loadingData={loadingData}
            removeCondition={removeCondition}
            removeRuleFromCondition={removeRuleFromCondition}
            setConditionsWrapper={setConditionsWrapper}
            trialDataFields={trialDataFields}
            updateRule={updateRule}
          />
        )}

        {/* Add Condition (OR) Button */}
        {conditions.length > 0 && loop.trials.length > 0 && (
          <button
            onClick={addCondition}
            className="mt-6 px-6 py-3 rounded-lg w-full font-semibold shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
            style={{
              marginTop: 12,
              marginBottom: 12,
              background:
                "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
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
          Save Loop Conditions
        </button>
      </div>
    </div>
  );
}

export default ConditionalLoop;
