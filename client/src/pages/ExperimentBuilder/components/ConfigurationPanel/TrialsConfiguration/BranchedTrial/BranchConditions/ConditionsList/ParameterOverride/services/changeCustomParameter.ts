import type { ColumnMappingEntry } from "../../../../../../types";
import type { Condition } from "../../../../types";

interface Args {
  condition: Condition;
  conditions: Condition[];
  newKey?: string;
  oldKey: string;
  setConditions: (conditions: Condition[], shouldSave?: boolean) => void;
  value?: ColumnMappingEntry;
}

export function changeCustomParameter({
  condition,
  conditions,
  newKey,
  oldKey,
  setConditions,
  value,
}: Args) {
  const customParameters = { ...condition.customParameters };
  delete customParameters[oldKey];
  if (newKey && value) customParameters[newKey] = value;

  setConditions(
    conditions.map((item) =>
      item.id === condition.id ? { ...item, customParameters } : item,
    ),
    true,
  );
}
