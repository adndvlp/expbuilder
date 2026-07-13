export function generateTrialProps(
  pluginName: string,
  params: Array<{ key: string }>,
  data: Array<{ key: string }>,
): string {
  const paramProps = params
    .map(({ key }) => `${key}: jsPsych.timelineVariable("${key}"),`)
    .join("\n");
  const dataProps = data.map(({ key }) => `${key}: "${key}",`).join("\n");

  if (pluginName === "plugin-webgazer-validate") {
    return `${paramProps}
    data: {
      task: 'validate'
    },
    on_finish: function(data) { delete data.raw_gaze; },`;
  }

  return `
    ${paramProps}
    data: {
      ${dataProps}
    },`;
}

export function toCamelCase(pluginName: string): string {
  return pluginName
    .replace(/^plugin/, "jsPsych")
    .split("-")
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
}

export function stringifyWithFunctions(
  params: Array<{ key: string; type: string }>,
  values: Record<string, unknown>,
) {
  const allKeys = [
    ...params.map((param) => param.key),
    ...Object.keys(values).filter(
      (key) => !params.some((param) => param.key === key),
    ),
  ];

  return (
    "{" +
    allKeys
      .map((key) => {
        const value = values[key];
        const paramType = params.find((param) => param.key === key)?.type;
        const isFunction = paramType === "function" || paramType === "FUNCTION";
        const trimmed = typeof value === "string" ? value.trim() : "";
        const looksLikeFunction =
          !!trimmed &&
          (trimmed.startsWith("(") ||
            trimmed.startsWith("function") ||
            /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/.test(trimmed));

        if ((isFunction || looksLikeFunction) && trimmed) {
          return `${key}: ${value}`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      })
      .join(",\n") +
    "}"
  );
}
