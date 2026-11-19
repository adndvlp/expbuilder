import { generateOnStartCode } from "../../TrialCode/TrialCodeGenerators";
import {
  generateTrialProps,
  stringifyWithFunctions,
  toCamelCase,
} from "./phaseCodeFormatting";
import type { ParamsOverrideCondition } from "../../../types";
type PhaseCodeOptions = {
  pluginName: string;
  parameters: Array<{ key: string; type: string }>;
  data: Array<{ key: string }>;
  mappedJson: Record<string, unknown>[];
  includeInstructions: boolean;
  minimumPercentAcceptable: number;
  paramsOverride?: ParamsOverrideCondition[];
  isInLoop?: boolean;
  getVarName: (name: string) => string;
};
export function renderPhaseCode(options: PhaseCodeOptions) {
  const {
    pluginName,
    parameters,
    data,
    mappedJson,
    includeInstructions,
    minimumPercentAcceptable,
    paramsOverride,
    isInLoop,
    getVarName,
  } = options;
  const pluginNameImport = toCamelCase(pluginName),
    pluginNameRefactor = pluginName.replace(/-/g, "_");

  let code = "";

  const pluginRecal = pluginName === "plugin-webgazer-recalibrate";

  // WebGazer phases should NOT have individual branching
  // Branching should only happen AFTER the last procedure (recalibrate)
  const onStartCode = generateOnStartCode({
    paramsOverride,
    isInLoop,
    getVarName,
  });

  if (includeInstructions) {
    if (pluginRecal) {
      // Recalibrate instructions are placed directly in the timeline (no timeline_variables),
      // so they must use static values instead of jsPsych.timelineVariable().
      const row0 = mappedJson[0];
      const stimulus = JSON.stringify(
        row0[`${pluginNameRefactor}_instructions`] ?? "",
      );
      const choices = JSON.stringify(
        row0[`${pluginNameRefactor}_choices`] ?? ["OK"],
      );
      code += `const ${pluginNameRefactor}_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: ${stimulus},
      choices: ${choices},
    };`;
    } else {
      code += `const ${pluginNameRefactor}_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: jsPsych.timelineVariable("${pluginNameRefactor}_instructions"),
      choices: jsPsych.timelineVariable("${pluginNameRefactor}_choices"),
    };`;
    }
  }
  const timelineProps = generateTrialProps(pluginName, parameters, data);

  const testStimuliCodeInit = mappedJson.map((row) =>
    stringifyWithFunctions(parameters, row),
  );
  code += `
    const test_stimuli_${pluginNameRefactor} = [${testStimuliCodeInit.join(",")}];
`;

  code += `
    ${
      !pluginRecal
        ? `
    const ${pluginNameRefactor}_timeline = {
    type: ${pluginNameImport}, ${timelineProps}
    ${onStartCode}
    };`
        : ""
    };
    `;

  if (!pluginRecal) {
    code += `
    const ${pluginNameRefactor}_procedure = {
    timeline: [
    ${includeInstructions ? `${pluginNameRefactor}_instructions,` : ""}
    ${pluginNameRefactor}_timeline
    ],
    timeline_variables: test_stimuli_${pluginNameRefactor}
  };
    timeline.push(${pluginNameRefactor}_procedure);
  ;`;
  }

  // Recalibrate

  if (pluginName === "plugin-webgazer-recalibrate") {
    code += `
    const recalibrate_timeline = {
        timeline: [`;

    if (includeInstructions) {
      code += `
        plugin_webgazer_recalibrate_instructions, `;
    }

    code += `
        plugin_webgazer_calibrate_procedure, plugin_webgazer_validate_procedure],
        conditional_function: function(){
          var validation_data = jsPsych.data.get().filter({task: 'validate'}).values()[0];
          return validation_data.percent_in_roi.some(function(x){
            var minimum_percent_acceptable = ${minimumPercentAcceptable};
            return x < minimum_percent_acceptable;
          });
        },
        data: {
          phase: 'recalibration'
        }
      }`;

    code += `\n  timeline.push(recalibrate_timeline);`;

    code += `const calibration_done = {
        type: jsPsychHtmlButtonResponse,
        stimulus: \`
          <p>Great, we're done with calibration!</p>
        \`,
        choices: ['OK'],

      }
    timeline.push(calibration_done);
`;
  } else {
    code += "";
  }

  return code;
}
