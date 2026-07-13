export function toCamelCase(str: string): string {
  if (!str) return "";
  return str
    .replace(/^plugin/, "jsPsych") // elimina el prefijo "plugin-" y agrega "jsPsych"
    .split("-") // divide el string por guiones
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
}

export function stringifyWithFunctions(
  params: { key: string; type: string }[],
  values: Record<string, any>,
) {
  // Solo incluir keys que existan en values
  // No forzar la inclusión de todos los params si no están en values
  const allKeys = Object.keys(values);

  // Helper para stringify recursivo que preserva funciones
  const stringifyValue = (val: any, key?: string): string => {
    // Check if this is a function parameter or if value looks like a function
    const paramType = key ? params.find((p) => p.key === key)?.type : undefined;
    const isFunction = paramType === "function" || paramType === "FUNCTION";
    const looksLikeFunction =
      typeof val === "string" &&
      val.trim() &&
      (val.trim().startsWith("(") ||
        val.trim().startsWith("function") ||
        val.trim().match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/));

    // If it's a function type or looks like a function, output it without quotes
    if (
      (isFunction || looksLikeFunction) &&
      typeof val === "string" &&
      val.trim()
    ) {
      return val;
    }

    // Handle arrays (like components in DynamicPlugin)
    if (Array.isArray(val)) {
      const items = val
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            // Process objects within arrays (like component configs)
            const objKeys = Object.keys(item);
            const objProps = objKeys
              .map((objKey) => {
                const objVal = item[objKey];

                // Special handling for button_html in components
                if (objKey === "button_html") {
                  // If it's a function, convert to string
                  if (typeof objVal === "function") {
                    return `${objKey}: ${objVal.toString()}`;
                  }
                  // If it's a string that looks like a function
                  if (typeof objVal === "string" && objVal.trim()) {
                    const trimmed = objVal.trim();
                    if (
                      trimmed.startsWith("(") ||
                      trimmed.startsWith("function") ||
                      trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/)
                    ) {
                      return `${objKey}: ${objVal}`;
                    }
                  }
                }

                return `${objKey}: ${stringifyValue(objVal)}`;
              })
              .join(", ");
            return `{ ${objProps} }`;
          }
          return stringifyValue(item);
        })
        .join(", ");
      return `[${items}]`;
    }

    // Default JSON stringify
    return JSON.stringify(val);
  };

  return (
    "{" +
    allKeys
      .map((key) => {
        const val = values[key];
        return `${key}: ${stringifyValue(val, key)}`;
      })
      .join(",\n") +
    "}"
  );
}
