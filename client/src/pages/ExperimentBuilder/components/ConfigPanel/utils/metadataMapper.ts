import type { FieldDefinition, FieldType, DataDefinition } from "../types";

// Mapea tipos base como 'int' → 'number', y arrays tipo 'number_array' → 'string_array', etc.
function resolveFieldType(type: string): FieldType {
  const baseMap: Record<string, FieldType> = {
    string: "string",
    html_string: "html_string",
    audio: "string",
    image: "string",
    number: "number",
    boolean: "boolean",
    function: "function",
    object: "object",
    coordinates: "coordinates",
    undefined: "undefined",
    null: "null",
  };

  const arrayMatch = type.match(/^(.+)_array$/);
  if (arrayMatch) {
    const baseType = baseMap[arrayMatch[1]] || "string";
    // if (baseType === "string") return "string_array";
    // si quieres soportar number_array y boolean_array explícitamente en el futuro:
    return `${baseType}_array` as FieldType;
    // return "string_array"; // fallback general para arrays
  }

  return (baseMap[type] as FieldType) || (type as FieldType);
}

export function mapMetadataToFields(
  parameters: Record<string, any>
): FieldDefinition[] {
  return Object.entries(parameters).map(([key, param]) => ({
    label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    key,
    type: resolveFieldType(param.type),
    default:
      param.default === "__undefined__" ? undefined : (param.default ?? null),
  }));
}

export function mapMetadataToData(data: Record<string, any>): DataDefinition[] {
  return Object.entries(data).map(([key, param]) => ({
    label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    key,
    type: resolveFieldType(param.type),
  }));
}
