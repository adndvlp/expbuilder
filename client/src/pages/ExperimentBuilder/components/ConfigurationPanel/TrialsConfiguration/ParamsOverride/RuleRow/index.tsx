import {
  ParamsOverrideRule,
  LoadedTrial,
  ParamsOverrideCondition,
} from "../types";
import { DataDefinition } from "../../../types";
import { FaTimes } from "react-icons/fa";
import { DynamicPluginPropertyColumn } from "../../LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn";
import { RuleValueInput } from "../../LoopsConfiguration/ConditionalLoop/RuleValueInput";
import { updateFieldType, updateComponentIdx } from "../ruleUpdateHelpers";

type Props = {
  rule: ParamsOverrideRule;
  ruleIdx: number;
  conditionId: number;
  availableTrials: { id: string | number; name: string }[];
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: keyof ParamsOverrideRule,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
  findTrialByIdSync: (trialId: string | number | null) => LoadedTrial | null;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  canRemove: boolean;
  setConditionsWrapper: (
    conditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: ParamsOverrideCondition[];
};

export function RuleRow({
  rule,
  ruleIdx,
  conditionId,
  availableTrials,
  updateRule,
  removeRuleFromCondition,
  findTrialByIdSync,
  trialDataFields,
  loadingData,
  canRemove,
  setConditionsWrapper,
  conditions,
}: Props) {
  const referencedTrial = findTrialByIdSync(rule.trialId);
  const dataFields = rule.trialId ? trialDataFields[rule.trialId] || [] : [];
  const isLoadingField = rule.trialId ? loadingData[rule.trialId] : false;

  // Check if it's a dynamic plugin
  const isDynamicPlugin = referencedTrial?.plugin === "plugin-dynamic";
  const fieldType = rule.fieldType || "";
  const componentIdx = rule.componentIdx ?? "";

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

  // Safely access columnMapping
  const columnMapping = referencedTrial?.columnMapping;
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
    <>
      {/* Trial Selection */}
      <td className="px-2 py-2">
        <select
          value={rule.trialId}
          onChange={(e) => {
            const newTrialId = e.target.value;
            setConditionsWrapper(
              conditions.map((c) =>
                c.id === conditionId
                  ? {
                      ...c,
                      rules: c.rules.map(
                        (r: ParamsOverrideRule, idx: number) =>
                          idx === ruleIdx
                            ? {
                                ...r,
                                trialId: newTrialId,
                                column: "",
                                value: "",
                              }
                            : r,
                      ),
                    }
                  : c,
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
          {referencedTrial && (
            <option value={referencedTrial.id}>{referencedTrial.name}</option>
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

      {/* Column selector - CHANGE TO MATCH ConditionalLoop structure */}
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
                              (r: ParamsOverrideRule, idx: number) =>
                                idx === ruleIdx
                                  ? { ...r, prop: newValue, column: newValue }
                                  : r,
                            ),
                          }
                        : c,
                    ),
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
                <option value="">Select field</option>
                {dataFields.map((field) => (
                  <option key={field.name} value={field.name}>
                    {field.name}
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
          <option value="==">=</option>
          <option value="!=">≠</option>
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
          <option value=">=">&gt;=</option>
          <option value="<=">&lt;=</option>
        </select>
      </td>

      {/* Value Input */}
      <td className="px-2 py-2">
        <RuleValueInput
          rule={rule}
          isDynamicPlugin={isDynamicPlugin}
          comp={comp}
          getPropValue={getPropValue}
          conditionId={conditionId}
          ruleIdx={ruleIdx}
          updateRule={updateRule}
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
    </>
  );
}
