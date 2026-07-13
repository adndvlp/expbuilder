import { useEffect, useState } from "react";
import { usePluginParameters } from "../../hooks/usePluginParameters"; // Make sure path is correct
import { useCsvMapper } from "../Csv/useCsvMapper";
import { ColumnMapping, Trial } from "../../types";
import {
  generateOnStartCode,
  generateOnFinishCode,
} from "../TrialCode/TrialCodeGenerators";
import {
  generateTrialProps,
  stringifyWithFunctions,
  toCamelCase,
} from "./services/phaseCodeFormatting";

type PhaseProps = {
  pluginName: string;
  instructions: any[];
  csvJson: any[];
  setCsvJson: React.Dispatch<React.SetStateAction<any[]>>;
  selectedTrial: Trial | null;
  setTrialName: React.Dispatch<React.SetStateAction<string>>;
  setCsvColumns: React.Dispatch<React.SetStateAction<string[]>>;
  columnMapping: ColumnMapping;
  setColumnMapping: React.Dispatch<React.SetStateAction<ColumnMapping>>;
  setIsLoadingTrial: React.Dispatch<React.SetStateAction<boolean>>;
};

export const generatePhaseCode = ({
  pluginName,
  instructions,
  csvJson,
  setCsvJson,
  selectedTrial,
  setTrialName,
  setCsvColumns,
  columnMapping,
  setColumnMapping,
  setIsLoadingTrial,
}: PhaseProps) => {
  // Extract trial logic properties from selectedTrial
  const branches = selectedTrial?.branches;
  const branchConditions = selectedTrial?.branchConditions;
  const repeatConditions = selectedTrial?.repeatConditions;
  const paramsOverride = selectedTrial?.paramsOverride;
  const parentLoopId = (selectedTrial as any)?.parentLoopId;
  const isInLoop = Boolean(parentLoopId || (selectedTrial as any)?.isInLoop);

  // Helper for dynamic variable names
  const getVarName = (baseName: string): string => {
    if (!isInLoop || !parentLoopId) {
      return baseName;
    }
    const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, "_");
    const sanitizedParentId = sanitizeName(parentLoopId);
    return `loop_${sanitizedParentId}_${baseName}`;
  };

  useEffect(() => {
    if (selectedTrial) {
      setIsLoadingTrial(true);
      setTrialName(selectedTrial.name || "");
      const include = selectedTrial.parameters?.include_instructions ?? false;
      setIncludeInstructions(!!include[pluginName]);
      setMinimumPercentAcceptable(
        selectedTrial.parameters.minimum_percent ?? 50,
      );
      // Restaura CSV y columnas si existen
      setColumnMapping(selectedTrial.columnMapping || {});
      setCsvJson(selectedTrial.csvJson || []);
      setCsvColumns(selectedTrial.csvColumns || []);

      setTimeout(() => {
        setIsLoadingTrial(false);
      }, 100); // 500 en producción
    }
    // eslint-disable-next-line
  }, [selectedTrial]);

  const [minimumPercentAcceptable, setMinimumPercentAcceptable] =
    useState<number>(50);
  // All the logic that you were repeating is now inside this single hook
  const { parameters, data } = usePluginParameters(pluginName);
  const [includeInstructions, setIncludeInstructions] = useState(false);

  const fieldGroups = { parameters, instructions };

  const { getColumnValue } = useCsvMapper({ fieldGroups });

  // const activeParameters = fieldGroups.parameters.filter(
  //   (p) => columnMapping[p.key]?.source !== "none"
  // );

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      // obtener solo los parámetros activos(mapeados), ignora los defaults (activeParameters)
      // al momento de llevarlo al código generado
      if (pluginName !== "plugin-webgazer-recalibrate") {
        fieldGroups.parameters.forEach((param) => {
          const { key } = param;
          result[key] = getColumnValue(columnMapping[key], row, undefined, key);
        });
      }

      if (includeInstructions) {
        fieldGroups.instructions.forEach((fixParam) => {
          result[fixParam.key] = getColumnValue(
            columnMapping[fixParam.key],
            row,
            fixParam.default,
            fixParam.key,
          );
        });
      }

      return result;
    };

    if (csvJson.length > 0) {
      return csvJson.map((row) => mapRow(row));
    } else {
      return [mapRow()];
    }
  })();

  const pluginNameImport = toCamelCase(pluginName);

  const pluginNameRefactor = pluginName.replace(/-/g, "_");

  const genTrialCode = () => {
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
        ${generateOnFinishCode({
          branches,
          branchConditions,
          repeatConditions,
          isInLoop,
          getVarName,
        })}
      }
    timeline.push(calibration_done);
`;
    } else {
      code += "";
    }

    return code;
  };

  const trialCode = genTrialCode();

  // Return all the state and setters in a single, convenient object
  return {
    minimumPercentAcceptable,
    setMinimumPercentAcceptable,
    data,
    columnMapping,
    setColumnMapping,
    includeInstructions,
    setIncludeInstructions,
    fieldGroups,
    mappedJson,
    trialCode,
  };
};
