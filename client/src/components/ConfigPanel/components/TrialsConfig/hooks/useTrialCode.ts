import { ColumnMapping, ColumnMappingEntry } from "../../../types";

type Props = {
  pluginName: string;
  parameters: any[];
  data: any[];
  getColumnValue: (
    mapping: ColumnMappingEntry | undefined,
    row?: Record<string, any>,
    defaultValue?: any,
    key?: string
  ) => any;
  needsFileUpload: boolean;
  columnMapping: ColumnMapping;
  filteredFiles: any[];
  includeFixation: boolean;
  csvJson: any[];
  fieldGroups: { pluginParameters: any[]; fixation: any[] };
  trialName: string;
  repetitions: number;
  randomize: boolean;
  extensions: string;
  includesExtensions: boolean;
  orders: boolean;
  stimuliOrders: any[];
  categoryColumn: string;
};

export function useTrialCode({
  pluginName,
  parameters,
  getColumnValue,
  needsFileUpload,
  columnMapping,
  filteredFiles,
  includeFixation,
  csvJson,
  fieldGroups,
  trialName,
  data,
  repetitions,
  randomize,
  extensions,
  includesExtensions,
  orders,
  stimuliOrders,
}: Props) {
  const activeParameters = parameters.filter(
    (p) => columnMapping[p.key]?.source !== "none"
  );

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>, idx?: number) => {
      const result: Record<string, any> = {};

      activeParameters.forEach((param) => {
        const { key } = param;

        // const mediaKeys = ["stimulus", "images", "audio", "video"];
        const isMediaParameter = (key: string) => {
          const keyLower = key.toLowerCase();
          return (
            keyLower.includes("img") ||
            keyLower.includes("image") ||
            keyLower.includes("stimulus") ||
            keyLower.includes("audio") ||
            keyLower.includes("video") ||
            keyLower.includes("sound") ||
            keyLower.includes("media")
          );
        };

        if (
          // mediaKeys.includes(key)
          isMediaParameter(key) &&
          needsFileUpload
        ) {
          // Si row tiene el valor específico para este parámetro (viene de mockRow), usarlo
          // Si no, obtener el valor original del columnMapping
          const value =
            row && row[key] !== undefined
              ? row[key]
              : getColumnValue(columnMapping[key], row, undefined, key);

          let stimulusValue;

          if (Array.isArray(value)) {
            // Si ya es un array, procesar cada valor individualmente
            stimulusValue = value.map((v) => {
              if (v && !/^https?:\/\//.test(v)) {
                const found = filteredFiles.find((f) => f.name.endsWith(v));
                return found ? found.url : v;
              } else {
                return v ?? "";
              }
            });
          } else {
            // Valor único (ya procesado por la lógica de múltiples inputs)
            if (value && !/^https?:\/\//.test(value)) {
              const found = filteredFiles.find((f) => f.name.endsWith(value));
              stimulusValue = found ? found.url : value;
            } else {
              stimulusValue = value ?? filteredFiles[idx ?? 0]?.url ?? "";
            }
          }

          result[key] = stimulusValue;
        } else {
          result[key] = getColumnValue(columnMapping[key], row, undefined, key);
        }
      });

      if (includeFixation) {
        fieldGroups.fixation.forEach((fixParam) => {
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
      return csvJson.map((row, idx) => mapRow(row, idx));
    } else {
      // Verificar si hay múltiples archivos separados por comas en algún parámetro
      const multipleInputsParams: { [key: string]: string[] } = {};
      let hasMultipleInputs = false;

      activeParameters.forEach((param) => {
        // const mediaKeys = ["stimulus", "images", "audio", "video"];
        const isMediaParameter = (key: string) => {
          const keyLower = key.toLowerCase();
          return (
            keyLower.includes("img") ||
            keyLower.includes("image") ||
            keyLower.includes("stimulus") ||
            keyLower.includes("audio") ||
            keyLower.includes("video") ||
            keyLower.includes("sound") ||
            keyLower.includes("media")
          );
        };
        if (
          // mediaKeys.includes(param.key)
          isMediaParameter(param.key) &&
          needsFileUpload
        ) {
          const value = getColumnValue(
            columnMapping[param.key],
            undefined,
            undefined,
            param.key
          );
          if (typeof value === "string" && value.includes(",")) {
            const values = value
              .split(",")
              .map((v) => v.trim())
              .filter((v) => v.length > 0);
            multipleInputsParams[param.key] = values;
            hasMultipleInputs = true;
          }
        }
      });

      if (hasMultipleInputs) {
        // Encontrar el parámetro con más elementos para determinar el número de trials
        let maxTrials = 1;
        Object.values(multipleInputsParams).forEach((values) => {
          maxTrials = Math.max(maxTrials, values.length);
        });

        // Generar un trial por cada archivo detectado en el input
        return Array.from({ length: maxTrials }, (_, idx) => {
          const mockRow: Record<string, any> = {};

          // Para cada parámetro con múltiples inputs, usar solo el valor correspondiente al índice actual
          Object.keys(multipleInputsParams).forEach((key) => {
            const values = multipleInputsParams[key];
            // Usar solo UN archivo por trial
            mockRow[key] = values[idx] || values[values.length - 1];
          });

          // Para parámetros que no tienen múltiples inputs, usar el valor normal
          activeParameters.forEach((param) => {
            if (!multipleInputsParams[param.key]) {
              const value = getColumnValue(
                columnMapping[param.key],
                undefined,
                undefined,
                param.key
              );
              if (value !== undefined) {
                mockRow[param.key] = value;
              }
            }
          });

          return mapRow(mockRow, idx);
        });
      } else {
        // Si no hay múltiples inputs, generar un solo trial
        return [mapRow()];
      }
    }
  })();

  // Generación del template del trial/ensayo
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

    return `${paramProps}
    data: {
      ${dataProps}
    },`;
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
          // Si es función, no poner comillas
          if (
            params.find((p) => p.key === key)?.type === "function" &&
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

  const genTrialCode = () => {
    const trialNameSanitized = trialName.replace(/\s+/g, "_");

    let code = "";

    if (needsFileUpload && pluginName != "plugin-preload") {
      code += `
    const preload${trialNameSanitized} = {
        type: jsPsychPreload,
       files: ${JSON.stringify(filteredFiles.map((f) => f.url))},
    }
    timeline.push(preload${trialNameSanitized});
    `;
    }

    const testStimuliCode = mappedJson.map((row) =>
      stringifyWithFunctions(activeParameters, row)
    );

    if (orders) {
      code += `
    let test_stimuli_${trialNameSanitized} = [];
    
    if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
    const stimuliOrders = ${JSON.stringify(stimuliOrders)}
    const orederIndex = (participantNumber - 1) % stimuliOrders.length;
    const index_order = stimuliOrders[orederIndex]; // Orden deseado de los índices

    const test_stimuli_previous_${trialNameSanitized} = [${testStimuliCode.join(",")}];


    test_stimuli_${trialNameSanitized} = index_order
      .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${trialNameSanitized}.length)
      .map((i) => test_stimuli_previous_${trialNameSanitized}[i]);

    console.log(test_stimuli_${trialNameSanitized})

    }`;
    } else {
      code += `
    const test_stimuli_${trialNameSanitized} = [${testStimuliCode.join(",")}];`;
    }

    if (includeFixation) {
      code += `
      const ${trialNameSanitized}_fixation = {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: jsPsych.timelineVariable("fixation"),
      choices: "NO_KEYS",
      trial_duration: jsPsych.timelineVariable("fixation_duration"),
      data: {
        task: "fixation",
      },
    };
    `;
    }

    const timelineProps = generateTrialProps(activeParameters, data);

    code += `
    const ${trialNameSanitized}_timeline = {
    type: ${pluginNameImport}, ${timelineProps}};
    `;

    code += `
    const ${trialNameSanitized}_procedure = {
    timeline: 
    [${
      includeFixation ? `${trialNameSanitized}_fixation, ` : ""
    }${trialNameSanitized}_timeline],
    timeline_variables: test_stimuli_${trialNameSanitized},
    repetitions: ${repetitions},
    randomize_order: ${randomize},
    `;
    if (includesExtensions && extensions !== "") {
      code += `
    extensions: ${extensions}
    };
    timeline.push(${trialNameSanitized}_procedure);
    `;
    } else {
      code += `
    };
    timeline.push(${trialNameSanitized}_procedure);
  `;
    }

    return code;
  };

  return { genTrialCode };
}
