import type { BranchCondition, ColumnMapping } from "../../../types";

interface Options {
  branchConditions?: BranchCondition[];
  branches?: (string | number)[];
  defaultNextTrialId?: string | number | null;
  columnMapping: ColumnMapping;
  data: Array<{ key: string }>;
  hasData?: boolean;
  id?: number;
  isInLoop?: boolean;
  params: Array<{ key: string }>;
  pluginName: string;
  trialName: string;
  trialNameSanitized: string;
}

export function generateTrialProps({
  branchConditions,
  branches,
  defaultNextTrialId,
  columnMapping,
  data,
  hasData = true,
  id,
  isInLoop,
  params,
  pluginName,
  trialName,
  trialNameSanitized,
}: Options): string {
  // Lógica especial para DynamicPlugin
  if (pluginName === "DynamicPlugin" || pluginName === "plugin-dynamic") {
    const componentsKey = isInLoop
      ? `components_${trialNameSanitized}`
      : "components";
    const responseComponentsKey = isInLoop
      ? `response_components_${trialNameSanitized}`
      : "response_components";

    const dataProps = data
      .map(({ key }: { key: string }) => {
        const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        return `${key}: "${propKey}",`;
      })
      .join("\n");

    const dynamicPassthroughParams = [
      "trial_duration",
      "response_ends_trial",
      "require_response_components",
      "dynamic_csv_diagnostics",
      "__canvasStyles",
    ];
    const dynamicParamProps = dynamicPassthroughParams
      .filter(
        (key) => columnMapping[key] && columnMapping[key].source !== "none",
      )
      .map((key) => {
        const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        return `${key}: jsPsych.timelineVariable("${propKey}"),`;
      })
      .join("\n");

    // If no data, don't use timelineVariable
    if (!hasData && !isInLoop) {
      return `${dynamicParamProps}
data: {
    ${dataProps}
    trial_id: ${id},
    builder_id: ${id},
    trial_name: "${trialName}",
    branches: ${JSON.stringify(branches ?? [])},
    branchConditions: ${JSON.stringify(branchConditions ?? [])},
    defaultNextTrialId: ${JSON.stringify(defaultNextTrialId ?? null)},
  },`;
    }

    return `components: jsPsych.timelineVariable("${componentsKey}"),
response_components: jsPsych.timelineVariable("${responseComponentsKey}"),
${dynamicParamProps}
data: {
    ${dataProps}
    trial_id: ${id},
    builder_id: ${id},
    trial_name: "${trialName}",
    ${isInLoop ? `isInLoop: true,` : ""}
    branches: ${JSON.stringify(branches ?? [])},
    branchConditions: ${JSON.stringify(branchConditions ?? [])},
    defaultNextTrialId: ${JSON.stringify(defaultNextTrialId ?? null)},
  },`;
  }

  // Lógica normal para otros plugins
  const dataProps = data
    .map(({ key }: { key: string }) => {
      const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
      return `${key}: "${propKey}",`;
    })
    .join("\n");

  // Incluir branches tanto para trials en loop como fuera de loop

  // If no data and not in loop, don't use timelineVariable for parameters
  if (!hasData && !isInLoop) {
    return `data: {
    ${dataProps}
    trial_id: ${id},
    builder_id: ${id},
    trial_name: "${trialName}",
    branches: ${JSON.stringify(branches ?? [])},
    branchConditions: ${JSON.stringify(branchConditions ?? [])},
    defaultNextTrialId: ${JSON.stringify(defaultNextTrialId ?? null)},
  },`;
  }

  const paramProps = params
    .map(({ key }: { key: string }) => {
      const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
      return `${key}: jsPsych.timelineVariable("${propKey}"),`;
    })
    .join("\n");

  return `${paramProps}
  data: {
    ${dataProps}
    trial_id: ${id},
    builder_id: ${id},
    trial_name: "${trialName}",
    ${isInLoop ? `isInLoop: true,` : ""}
    branches: ${JSON.stringify(branches ?? [])},
    branchConditions: ${JSON.stringify(branchConditions ?? [])},
    defaultNextTrialId: ${JSON.stringify(defaultNextTrialId ?? null)},
  },`;
}
