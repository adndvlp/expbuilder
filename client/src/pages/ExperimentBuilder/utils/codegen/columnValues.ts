import { PluginParameterDefinition } from "./types";

export function getPluginDefaultValue(
  parameters: PluginParameterDefinition[],
  key: string,
) {
  const field = parameters.find((candidate) => candidate.key === key);
  return field && "default" in field ? field.default : "";
}

export function resolveColumnValue(
  parameters: PluginParameterDefinition[],
  mapping: Record<string, unknown> | undefined,
  row?: Record<string, unknown>,
  defaultValue?: unknown,
  key?: string,
) {
  if (!mapping || mapping.source === "none") {
    return defaultValue ?? (key ? getPluginDefaultValue(parameters, key) : "");
  }

  if (mapping.source === "typed") {
    return mapping.value ?? (key ? getPluginDefaultValue(parameters, key) : "");
  }

  if (mapping.source === "csv" && row && key) {
    const columnKey = mapping.value;
    if (typeof columnKey === "string" || typeof columnKey === "number") {
      const rawValue = row[columnKey];
      const param = parameters.find((candidate) => candidate.key === key);

      if (!param) return rawValue;

      if (param.type && /int|number/i.test(String(param.type))) {
        const parsed = parseInt(String(rawValue));
        return isNaN(parsed) ? 0 : parsed;
      }
      if (param.type && /float|decimal/i.test(String(param.type))) {
        const parsed = parseFloat(String(rawValue));
        return isNaN(parsed) ? 0 : parsed;
      }
      if (param.type && /bool/i.test(String(param.type))) {
        if (typeof rawValue === "boolean") return rawValue;
        const str = String(rawValue).toLowerCase();
        return str === "true" || str === "1";
      }
      return rawValue;
    }
  }

  return key ? getPluginDefaultValue(parameters, key) : "";
}
