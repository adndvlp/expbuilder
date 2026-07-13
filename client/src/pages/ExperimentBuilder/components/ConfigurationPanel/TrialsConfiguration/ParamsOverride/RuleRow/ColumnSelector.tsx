import { LoadedTrial, ParamsOverrideRule } from "../types";
import { DataDefinition, ParamsOverrideCondition } from "../../../types";
import { getAvailableColumns } from "./services/getAvailableColumns";

type Props = {
  rule: ParamsOverrideRule;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  referencedTrial: LoadedTrial | null;
  conditions: ParamsOverrideCondition[];
  conditionId: number;
  ruleIdx: number;
  getPropValue: (prop: unknown) => unknown;
  setConditionsWrapper: (
    conditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
};

function ColumnSelector({
  rule,
  trialDataFields,
  loadingData,
  referencedTrial,
  conditions,
  conditionId,
  ruleIdx,
  getPropValue,
  setConditionsWrapper,
}: Props) {
  const dataFields = rule.trialId ? trialDataFields[rule.trialId] || [] : [];
  const isLoadingField = rule.trialId ? loadingData[rule.trialId] : false;

  const availableColumns = getAvailableColumns({
    dataFields,
    getPropValue,
    referencedTrial,
  });

  return (
    <td className="px-2 py-2">
      {isLoadingField ? (
        <div className="text-xs text-gray-500">Loading...</div>
      ) : (
        <select
          value={rule.column || ""}
          onChange={(e) => {
            const newColumn = e.target.value;
            setConditionsWrapper(
              conditions.map((c) =>
                c.id === conditionId
                  ? {
                      ...c,
                      rules: c.rules.map(
                        (r: ParamsOverrideRule, idx: number) =>
                          idx === ruleIdx
                            ? { ...r, column: newColumn, value: "" }
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
          <option value="">
            {rule.trialId ? "Select column" : "Select trial first"}
          </option>
          {/* Group columns by category */}
          {availableColumns
            .reduce<
              Array<{
                name: string;
                columns: Array<{
                  value: string;
                  label: string;
                  group: string;
                }>;
              }>
            >((acc, col) => {
              // Find or create group
              let group = acc.find((g) => g.name === col.group);
              if (!group) {
                group = { name: col.group, columns: [] };
                acc.push(group);
              }
              group.columns.push(col);
              return acc;
            }, [])
            .map((group) => (
              <optgroup key={group.name} label={group.name}>
                {group.columns.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label}
                  </option>
                ))}
              </optgroup>
            ))}
        </select>
      )}
    </td>
  );
}

export default ColumnSelector;
