import type { LocalExperimentCodeOptions } from "./localCodeTypes";

export function buildLocalExtraOptions({
  customCode,
  localParams,
}: LocalExperimentCodeOptions): string {
  const reserved = ["on_trial_start", "on_data_update", "on_finish"];
  const functionParams: Record<string, string> = {
    on_trial_finish: "function(data) {\n  ${code}\n}",
    on_interaction_data_update: "function(data) {\n  ${code}\n}",
    on_close: "function() {\n  ${code}\n}",
  };
  const pairs = Object.entries(localParams)
    .filter(([key, value]) => !reserved.includes(key) && value?.trim())
    .map(([key, value]) => {
      const trimmed = value.trim();
      const template = functionParams[key];
      return template
        ? `  ${key}: ${template.replace("${code}", trimmed)}`
        : `  ${key}: ${trimmed}`;
    })
    .join(",\n");
  const extra = pairs
    ? `,\n\n  // --- User-added initJsPsych params ---\n${pairs}`
    : "";
  const custom = customCode?.trim()
    ? `,\n\n  // --- Global Custom Code (initJsPsych options) ---\n  ${customCode}`
    : "";
  return extra + custom;
}
