import { useEffect, useState } from "react";
import { usePluginParameters } from "../../hooks/usePluginParameters"; // Make sure path is correct
import { useCsvMapper } from "./useCsvMapper";
import { ColumnMapping, Trial } from "../../types";

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

export const usePhase = ({
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
  useEffect(() => {
    if (selectedTrial) {
      setIsLoadingTrial(true);
      setTrialName(selectedTrial.name || "");
      const include = selectedTrial.parameters?.include_instructions ?? false;
      setIncludeInstructions(!!include[pluginName]);
      setMinimumPercentAcceptable(
        selectedTrial.parameters.minimum_percent ?? 50
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
            fixParam.key
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

  const generateTrialProps = (params: any[], data: any): string => {
    const paramProps = params
      .map(({ key }: { key: string }) => {
        return `${key}: jsPsych.timelineVariable("${key}"),`;
      })
      .join("\n");

    const dataProps = data
      .map(({ key }: { key: string }) => {
        return `${key}: "${key}",`;
      })
      .join("\n");

    if (pluginName !== "plugin-webgazer-validate") {
      return `
    ${paramProps}
    data: {
      ${dataProps}
    },`;
    } else {
      return `${paramProps}
    data: {
      task: 'validate'
    }`;
    }
  };

  function toCamelCase(str: string): string {
    return str
      .replace(/^plugin/, "jsPsych") // elimina el prefijo "plugin-" y agrega "jsPsych"
      .split("-") // divide el string por guiones
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join("");
  }

  const pluginNameImport = toCamelCase(pluginName);

  function stringifyWithFunctions(
    params: { key: string; type: string }[],
    values: Record<string, any>
  ) {
    const allKeys = [
      ...params.map((p) => p.key),
      ...Object.keys(values).filter((k) => !params.some((p) => p.key === k)),
    ];
    return (
      "{" +
      allKeys
        .map((key) => {
          const val = values[key];
          // Check if this is a function parameter or if value looks like a function
          const paramType = params.find((p) => p.key === key)?.type;
          const isFunction =
            paramType === "function" || paramType === "FUNCTION";
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
            return `${key}: ${val}`;
          }
          return `${key}: ${JSON.stringify(val)}`;
        })
        .join(",\n") +
      "}"
    );
  }

  const pluginNameRefactor = pluginName.replace(/-/g, "_");

  const genTrialCode = () => {
    let code = "";

    if (includeInstructions) {
      code += `const ${pluginNameRefactor}_instructions = {
      type: jsPsychHtmlButtonResponse,
      stimulus: jsPsych.timelineVariable("${pluginNameRefactor}_instructions"),
      choices: jsPsych.timelineVariable("${pluginNameRefactor}_choices"),
    };`;
    }
    const timelineProps = generateTrialProps(parameters, data);

    const testStimuliCodeInit = mappedJson.map((row) =>
      stringifyWithFunctions(parameters, row)
    );
    code += `
    const test_stimuli_${pluginNameRefactor} = [${testStimuliCodeInit.join(",")}];
`;
    const pluginRecal = pluginName === "plugin-webgazer-recalibrate";

    code += `
    ${
      !pluginRecal
        ? `
    const ${pluginNameRefactor}_timeline = {
    type: ${pluginNameImport}, ${timelineProps}};`
        : ""
    };
    `;

    code += `
    const ${pluginNameRefactor}_procedure = {
    timeline: 
    [
    ${includeInstructions ? `${pluginNameRefactor}_instructions,` : ""}
    
    ${!pluginRecal ? `${pluginNameRefactor}_timeline ` : ""}
    ],
    timeline_variables: test_stimuli_${pluginNameRefactor},
  };
    timeline.push(${pluginNameRefactor}_procedure);
  ;`;

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

      code += ` \n const recalibrateWebGazer_procedure = {
    timeline: 
    [${
      includeInstructions ? `plugin_webgazer_recalibrate_instructions,` : ""
    }recalibrate_timeline],
    timeline_variables: test_stimuli_plugin_webgazer_recalibrate,
  };
    timeline.push(recalibrateWebGazer_procedure);
  ;`;

      code += `const calibration_done = {
        type: jsPsychHtmlButtonResponse,
        stimulus: \`
          <p>Great, we're done with calibration!</p>
        \`,
        choices: ['OK']
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
