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
}: Props) {
  const activeParameters = parameters.filter(
    (p) => columnMapping[p.key]?.source !== "none"
  );
  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>, idx?: number) => {
      const result: Record<string, any> = {};

      activeParameters.forEach((param) => {
        const { key } = param;

        const mediaKeys = ["stimulus", "images", "audio", "video"];

        if (mediaKeys.includes(key) && needsFileUpload) {
          const value = getColumnValue(columnMapping[key], row, undefined, key);

          let stimulusValue;
          if (Array.isArray(value)) {
            // Si es un array, procesar cada valor individualmente
            stimulusValue = value.map((v) => {
              if (v && !/^https?:\/\//.test(v)) {
                const found = filteredFiles.find((f) => f.name.endsWith(v));
                return found ? found.url : v;
              } else {
                return v ?? "";
              }
            });
          } else {
            // let val: string[];
            // val = value.split(", ");
            // stimulusValue = val.forEach((v) => {
            //   if (v && !/^https?:\/\//.test(v)) {
            //     const found = filteredFiles.find((f) => f.name.endsWith(v));
            //     return found ? found.url : v;
            //   } else {
            //     return v ?? "";
            //   }
            // });
            if (value && !/^https?:\/\//.test(value)) {
              const found = filteredFiles.find((f) => f.name.endsWith(value));
              stimulusValue = found ? found.url : value;
            } else {
              stimulusValue = value ?? filteredFiles[idx ?? 0]?.url ?? "";
            }
          }

          // let stimulusValue;
          // if (Array.isArray(val)) {
          //   // Si es un array, procesar cada valor individualmente
          //   stimulusValue = val.map((v) => {
          //     if (v && !/^https?:\/\//.test(v)) {
          //       const found = filteredFiles.find((f) => f.name.endsWith(v));
          //       return found ? found.url : v;
          //     } else {
          //       return v ?? "";
          //     }
          //   });
          // } else {
          //   if (val && !/^https?:\/\//.test(val)) {
          //     const found = filteredFiles.find((f) => f.name.endsWith(val));
          //     stimulusValue = found ? found.url : val;
          //   } else {
          //     stimulusValue = val ?? filteredFiles[idx ?? 0]?.url ?? "";
          //   }
          // }

          // Si es video, envolver en array
          // result[key] = isVideoPlugin ? [stimulusValue] : stimulusValue;
          result[key] = stimulusValue;
          // console.log(result);
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

    // let stimulusValue: string = "";
    // let values: string[] = [""];
    // let urls: string[] = [];
    // let names: string[] = [];
    // let value = "";

    // activeParameters.forEach((param) => {
    //   if (param.key === "stimulus" && filteredFiles.length > 0) {
    //     stimulusValue = getColumnValue(columnMapping[param.key]);
    //     value = stimulusValue;
    //     values = stimulusValue.split(", ");

    //     values.forEach((val) => {
    //       if (val && !/^https?:\/\//.test(val)) {
    //         const foundFile = filteredFiles.find((f) => f.name.endsWith(val));
    //         if (foundFile) {
    //           urls.push(foundFile.url);
    //           names.push(foundFile.name);
    //         } else {
    //           urls.push(val);
    //         }
    //       } else {
    //         urls.push(val ?? "");
    //       }
    //     });
    //   }
    // });
    // console.log(value);
    // console.log(urls);

    if (csvJson.length > 0) {
      return csvJson.map((row, idx) => mapRow(row, idx));
    }
    // else if (filteredFiles.length > 0 && needsFileUpload) {
    //   return filteredFiles.map((_, idx) => mapRow(undefined, idx));
    // }
    else {
      return [mapRow()];
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
    code += `
    const test_stimuli_${trialNameSanitized} = [${testStimuliCode.join(",")}];`;

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
