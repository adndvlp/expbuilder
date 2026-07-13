import type { LoadedItem, LoopConditionRule } from "./types";

export const getPropValue = (prop: unknown): unknown => {
  if (prop && typeof prop === "object" && "source" in prop && "value" in prop) {
    return (prop as { value: unknown }).value;
  }
  return prop;
};

export function getRuleComponentContext(
  selectedTrial: LoadedItem | null,
  rule: LoopConditionRule,
) {
  const isTrial = selectedTrial && "plugin" in selectedTrial;
  const isDynamicPlugin = isTrial && selectedTrial.plugin === "plugin-dynamic";
  const fieldType = rule.fieldType || "";
  const componentIdx = rule.componentIdx ?? "";
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
          (component) => getPropValue(component.name) === componentIdx,
        )
      : null;
  return { comp, compArr, componentIdx, fieldType, isDynamicPlugin };
}
