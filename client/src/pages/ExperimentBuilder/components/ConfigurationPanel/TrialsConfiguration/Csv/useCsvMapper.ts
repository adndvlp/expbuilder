import { useCallback } from "react";
import type { ColumnMappingEntry } from "../../types";

type Parameter = {
  key: string;
  label: string;
  type: string;
  default?: any;
};

type UseParameterValueArgs = {
  fieldGroups: Record<string, Parameter[]>;
};

export function useCsvMapper({ fieldGroups }: UseParameterValueArgs) {
  const getDefaultValueForKey = useCallback(
    (key: string): any => {
      for (const group of Object.values(fieldGroups)) {
        const field = group.find((f) => f.key === key);
        if (field && "default" in field) {
          return field.default;
        }
      }
      return "";
    },
    [fieldGroups]
  );

  const getColumnValue = useCallback(
    (
      mapping: ColumnMappingEntry | undefined,
      row?: Record<string, any>,
      defaultValue?: any,
      key?: string
    ): any => {
      if (!mapping || mapping.source === "none") {
        return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
      }

      if (mapping.source === "typed") {
        return mapping.value ?? (key ? getDefaultValueForKey(key) : "");
      }

      if (mapping.source === "csv" && row && key) {
        const columnKey = mapping.value;
        if (typeof columnKey === "string" || typeof columnKey === "number") {
          let rawValue = row[columnKey];
          // const param = [...fieldGroups].find((p) => p.key === key); // params deleted
          const param = Object.values(fieldGroups)
            .flat()
            .find((p) => p.key === key);
          const type = param?.type;

          if (rawValue !== undefined && type) {
            if (type.endsWith("_array")) {
              const baseType = type.replace(/_array$/, "");
              if (
                (key === "calibration_points" || key === "validation_points") &&
                typeof rawValue === "string"
              ) {
                // Parse coordinate pairs like "[4,2], [2,4]" into [[4,2], [2,4]]
                const coordPairs = rawValue
                  .split("],")
                  .map((pair, index, array) => {
                    // Clean up the pair - remove brackets and trim
                    let cleanPair = pair.replace(/[\[\]]/g, "").trim();

                    // Add back closing bracket if this isn't the last item
                    if (index < array.length - 1) {
                      cleanPair = cleanPair;
                    }

                    // Split by comma and convert to numbers
                    const coords = cleanPair.split(",").map((coord) => {
                      const num = parseFloat(coord.trim());
                      return isNaN(num) ? coord.trim() : num;
                    });

                    return coords;
                  });

                return coordPairs;
              }
              if (typeof rawValue === "string") {
                const items = rawValue
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean);
                return items.map((item) => {
                  switch (baseType) {
                    case "number":
                    case "int":
                    case "float":
                      return isNaN(Number(item)) ? item : Number(item);
                    case "boolean":
                    case "bool":
                      const lower = item.toLowerCase();
                      if (lower === "true" || lower === "1") return true;
                      if (lower === "false" || lower === "0") return false;
                      return item;
                    default:
                      return item;
                  }
                });
              }
              return rawValue;
            }

            if (type === "object") {
              // Special case: coordinates
              if (key === "coordinates" && typeof rawValue === "string") {
                const parts = rawValue.split(",").map((p) => p.trim());
                if (parts.length === 2) {
                  const x = parseFloat(parts[0]);
                  const y = parseFloat(parts[1]);
                  if (!isNaN(x) && !isNaN(y)) {
                    return { x, y };
                  }
                }
              }

              if (typeof rawValue === "string") {
                try {
                  return JSON.parse(rawValue);
                } catch {
                  return rawValue;
                }
              }

              return rawValue;
            }

            if (type === "function") {
              return rawValue;
            }

            if (type === "boolean") {
              const lower = String(rawValue).toLowerCase();
              if (lower === "true" || lower === "1") return true;
              if (lower === "false" || lower === "0") return false;
              return rawValue;
            }

            if (type === "number" || type === "int" || type === "float") {
              return isNaN(Number(rawValue)) ? rawValue : Number(rawValue);
            }

            return rawValue;
          }

          return rawValue ?? getDefaultValueForKey(key);
        }
      }

      return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
    },
    [fieldGroups, getDefaultValueForKey]
  );

  return { getColumnValue };
}
