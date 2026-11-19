import type { Trial } from "../../components/ConfigurationPanel/types";
import InstructionsArrays from "../../components/ConfigurationPanel/TrialsConfiguration/Webgazer/InstructionsArrays";
import { renderPhaseCode } from "../../components/ConfigurationPanel/TrialsConfiguration/Webgazer/services/renderPhaseCode";
import { loadPluginParameters } from "../../components/ConfigurationPanel/utils/pluginParameterLoader";
import { resolveColumnValue } from "./columnValues";
import { toCodeIdentifier } from "./codeIdentifier";

export async function generateWebgazerCode(
  trial: Trial,
  options: { apiBaseUrl?: string; fetchImpl?: typeof fetch },
) {
  const instructions = InstructionsArrays();
  const definitions = [
    ["plugin-webgazer-init-camera", instructions.initCameraInstructions],
    ["plugin-webgazer-calibrate", instructions.calibrateInstructions],
    ["plugin-webgazer-validate", instructions.validateInstructions],
    ["plugin-webgazer-recalibrate", instructions.recalibrateInstructions],
  ] as const;
  const phases = await Promise.all(
    definitions.map(async ([pluginName, fields]) => {
      const { parameters, data } = await loadPluginParameters(
        pluginName,
        options,
      );
      const includeInstructions = Boolean(
        trial.parameters?.include_instructions?.[pluginName],
      );
      const mappedJson = (
        trial.csvJson?.length ? trial.csvJson : [undefined]
      ).map((row) => {
        const values: Record<string, unknown> = {};
        if (pluginName !== "plugin-webgazer-recalibrate")
          for (const param of parameters)
            values[param.key] = resolveColumnValue(
              parameters,
              trial.columnMapping?.[param.key],
              row,
              undefined,
              param.key,
            );
        if (includeInstructions)
          for (const field of fields)
            values[field.key] = resolveColumnValue(
              fields,
              trial.columnMapping?.[field.key],
              row,
              field.default,
              field.key,
            );
        return values;
      });
      return renderPhaseCode({
        pluginName,
        parameters,
        data,
        mappedJson,
        includeInstructions,
        minimumPercentAcceptable: trial.parameters?.minimum_percent ?? 50,
        paramsOverride: trial.paramsOverride,
        isInLoop: Boolean(trial.parentLoopId),
        getVarName: (name) =>
          trial.parentLoopId
            ? `loop_${toCodeIdentifier(trial.parentLoopId)}_${name}`
            : name,
      });
    }),
  );
  return phases.join("\n");
}
