import { LoopConditionRule, LoopCondition, LoadedItem } from "./types";
import { DataDefinition } from "../../../types";
import { FaTimes } from "react-icons/fa";
import {
  updateTrialSelection,
  updateFieldType,
  updateComponentIdx,
} from "./ruleUpdateHelpers";
import { DynamicPluginPropertyColumn } from "./DynamicPluginPropertyColumn";
import { RuleValueInput } from "./RuleValueInput";

type Props = {
  rule: LoopConditionRule;
  ruleIdx: number;
  conditionId: number;
  condition: LoopCondition;
  availableTrials: Array<{ id: string | number; name: string }>;
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
  findTrialByIdSync: (trialId: string | number | null) => LoadedItem | null;
  loadTrialOrLoop: (trialId: string | number) => Promise<LoadedItem | null>;
  loadTrialDataFields: (trialId: string | number) => Promise<void>;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  canRemove: boolean;
  setConditionsWrapper: (
    conditions: LoopCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: LoopCondition[];
};

export function RuleRow({
  rule,
  ruleIdx,
  conditionId,
  condition,
  availableTrials,
  updateRule,
  removeRuleFromCondition,
  findTrialByIdSync,
  loadTrialOrLoop,
  loadTrialDataFields,
  trialDataFields,
  loadingData,
  canRemove,
  setConditionsWrapper,
  conditions,
}: Props) {
  const selectedTrial = findTrialByIdSync(rule.trialId);
  const dataFields = rule.trialId ? trialDataFields[rule.trialId] || [] : [];
  const isLoadingField = rule.trialId ? loadingData[rule.trialId] : false;

  // Check if the selected item is a trial (has plugin) or a loop
  const isTrial = selectedTrial && "plugin" in selectedTrial;

  // Helper to get prop value
  const getPropValue = (prop: unknown): unknown => {
    if (
      prop &&
      typeof prop === "object" &&
      "source" in prop &&
      "value" in prop
    ) {
      return (prop as { value: unknown }).value;
    }
    return prop;
  };

  // For dynamic plugins, get component data
  const isDynamicPlugin = isTrial && selectedTrial?.plugin === "plugin-dynamic";
  const fieldType = rule.fieldType || "";
  const componentIdx = rule.componentIdx ?? "";

  // Safely access columnMapping
  const columnMapping = (
    selectedTrial as { columnMapping?: Record<string, unknown> }
  )?.columnMapping;
  const compArr =
    isDynamicPlugin && fieldType && columnMapping
      ? ((columnMapping[fieldType] as { value?: unknown[] })?.value as
          | unknown[]
          | undefined) || []
      : [];
  const comp =
    componentIdx !== "" && compArr.length > 0
      ? (compArr as Array<{ name?: unknown }>).find(
          (c) => getPropValue(c.name) === componentIdx,
        )
      : null;

  return (
    <tr
      key={ruleIdx}
      style={{
        borderBottom:
          ruleIdx < condition.rules.length - 1
            ? "1px solid var(--neutral-mid)"
            : "none",
      }}
    >
      {/* Trial Selection */}
      <td className="px-2 py-2">
        <select
          value={rule.trialId}
          onChange={async (e) => {
            const newTrialId = e.target.value;

            // Load the trial/loop first
            if (newTrialId) {
              await loadTrialOrLoop(newTrialId);
              // Also load the trial data fields for the dropdown
              await loadTrialDataFields(newTrialId);
            }

            // Use setConditionsWrapper for autosave
            setConditionsWrapper(
              updateTrialSelection(
                conditions,
                conditionId,
                ruleIdx,
                newTrialId,
              ),
              true,
            );
          }}
          className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
          style={{
            color: "var(--text-dark)",
            backgroundColor: "var(--neutral-light)",
            borderColor: "var(--neutral-mid)",
          }}
        >
          <option value="">Select trial...</option>
          {selectedTrial && (
            <option value={selectedTrial.id}>{selectedTrial.name}</option>
          )}
          {availableTrials
            .filter(
              (t) =>
                t.id !== rule.trialId && String(t.id) !== String(rule.trialId),
            )
            .map((trial) => (
              <option key={trial.id} value={trial.id}>
                {trial.name}
              </option>
            ))}
        </select>
      </td>

      {isDynamicPlugin ? (
        <>
          {/* Field Type Column */}
          <td className="px-2 py-2">
            <select
              value={fieldType}
              onChange={(e) => {
                const newValue = e.target.value;
                setConditionsWrapper(
                  updateFieldType(conditions, conditionId, ruleIdx, newValue),
                  true,
                );
              }}
              disabled={!rule.trialId}
              className="border rounded px-2 py-1 w-full text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            >
              <option value="">Select type</option>
              <option value="components">Stimulus</option>
              <option value="response_components">Response</option>
            </select>
          </td>

          {/* Component Column */}
          <td className="px-2 py-2">
            <select
              value={componentIdx}
              onChange={(e) => {
                const newValue = e.target.value;
                setConditionsWrapper(
                  updateComponentIdx(
                    conditions,
                    conditionId,
                    ruleIdx,
                    newValue,
                  ),
                  true,
                );
              }}
              disabled={!fieldType}
              className="border rounded px-2 py-1 w-full text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            >
              <option value="">Select component</option>
              {(compArr as Array<{ name?: unknown }>).map((c) => {
                const compName = getPropValue(c.name);
                return (
                  <option key={String(compName)} value={String(compName)}>
                    {String(compName)}
                  </option>
                );
              })}
            </select>
          </td>

          {/* Property Column */}
          <td className="px-2 py-2">
            <DynamicPluginPropertyColumn
              rule={rule}
              comp={comp}
              componentIdx={componentIdx}
              conditionId={conditionId}
              ruleIdx={ruleIdx}
              conditions={conditions}
              setConditionsWrapper={setConditionsWrapper}
              getPropValue={getPropValue}
            />
          </td>
        </>
      ) : (
        <>
          {/* Data Field Selection (normal plugin) */}
          <td className="px-2 py-2">
            {isLoadingField ? (
              <div className="text-xs text-gray-500">Loading...</div>
            ) : (
              <select
                value={rule.prop}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConditionsWrapper(
                    conditions.map((c) =>
                      c.id === conditionId
                        ? {
                            ...c,
                            rules: c.rules.map(
                              (r: LoopConditionRule, idx: number) =>
                                idx === ruleIdx ? { ...r, prop: newValue } : r,
                            ),
                          }
                        : c,
                    ),
                    true,
                  );
                }}
                disabled={!rule.trialId}
                className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                style={{
                  color: "var(--text-dark)",
                  backgroundColor: "var(--neutral-light)",
                  borderColor: "var(--neutral-mid)",
                }}
              >
                <option value="">
                  {rule.trialId ? "Select field..." : "Select trial first"}
                </option>
                {dataFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label || field.key}
                  </option>
                ))}
              </select>
            )}
          </td>
        </>
      )}

      {/* Operator Selection */}
      <td className="px-2 py-2">
        <select
          value={rule.op}
          onChange={(e) =>
            updateRule(conditionId, ruleIdx, "op", e.target.value)
          }
          className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
          style={{
            color: "var(--text-dark)",
            backgroundColor: "var(--neutral-light)",
            borderColor: "var(--neutral-mid)",
          }}
        >
          <option style={{ textAlign: "center" }} value="==">
            =
          </option>
          <option style={{ textAlign: "center" }} value="!=">
            ≠
          </option>
          <option style={{ textAlign: "center" }} value=">">
            &gt;
          </option>
          <option style={{ textAlign: "center" }} value="<">
            &lt;
          </option>
          <option style={{ textAlign: "center" }} value=">=">
            &gt;=
          </option>
          <option style={{ textAlign: "center" }} value="<=">
            &lt;=
          </option>
        </select>
      </td>

      {/* Value Input */}
      <td className="px-2 py-2">
        <RuleValueInput
          rule={rule}
          isDynamicPlugin={!!isDynamicPlugin}
          comp={comp}
          conditionId={conditionId}
          ruleIdx={ruleIdx}
          updateRule={updateRule}
          getPropValue={getPropValue}
        />
      </td>

      {/* Remove Rule Button */}
      <td className="px-1 py-2 text-center">
        {canRemove && (
          <button
            onClick={() => removeRuleFromCondition(conditionId, ruleIdx)}
            className="rounded-full w-6 h-6 flex items-center justify-center transition hover:bg-red-600 text-xs font-bold mx-auto"
            style={{
              backgroundColor: "var(--danger)",
              color: "var(--text-light)",
            }}
            title="Remove rule"
          >
            <FaTimes size={10} />
          </button>
        )}
      </td>
    </tr>
  );
}
