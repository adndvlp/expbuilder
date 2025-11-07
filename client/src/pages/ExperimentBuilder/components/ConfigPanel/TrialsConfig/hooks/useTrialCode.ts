import {
  BranchCondition,
  ColumnMapping,
  ColumnMappingEntry,
} from "../../types";

type Props = {
  id: number | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
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
  csvJson: any[];
  trialName: string;
  includesExtensions: boolean;
  extensions: string;
  orders: boolean;
  stimuliOrders: any[];
  categories: boolean;
  categoryData: any[];
  isInLoop?: boolean;
};

export function useTrialCode({
  id,
  branches,
  branchConditions,
  pluginName,
  parameters,
  getColumnValue,
  needsFileUpload,
  columnMapping,
  filteredFiles,
  csvJson,
  trialName,
  data,
  includesExtensions,
  extensions,
  orders,
  stimuliOrders,
  categories,
  categoryData,
  isInLoop,
}: Props) {
  const activeParameters = parameters.filter(
    (p) => columnMapping[p.key]?.source !== "none"
  );
  const trialNameSanitized = trialName.replace(/\s+/g, "_");

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>, idx?: number) => {
      const result: Record<string, any> = {};

      activeParameters.forEach((param) => {
        const { key } = param;
        const prefixedkey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        // const mediaKeys = ["stimulus", "images", "audio", "video"];
        const isMediaParameter = (key: string | undefined) => {
          if (typeof key !== "string") return false;
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

          // result[key] = stimulusValue;
          result[prefixedkey] = stimulusValue;
        } else {
          // result[key] = getColumnValue(columnMapping[key], row, undefined, key);
          result[prefixedkey] = getColumnValue(
            columnMapping[key],
            row,
            undefined,
            key
          );
        }
      });

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
        if (isMediaParameter(param.key) && needsFileUpload) {
          const value = getColumnValue(
            columnMapping[param.key],
            undefined,
            undefined,
            param.key
          );
          // Solo dividir si NO es html_string
          const paramType = parameters.find((p) => p.key === param.key)?.type;
          if (
            typeof value === "string" &&
            value.includes(",") &&
            paramType !== "html_string"
          ) {
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
        const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        return `${key}: jsPsych.timelineVariable("${propKey}"),`;
      })
      .join("\n");

    const dataProps = data
      .map(({ key }: { key: string }) => {
        const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        return `${key}: "${propKey}",`;
      })
      .join("\n");

    // Incluir branches tanto para trials en loop como fuera de loop
    const hasBranches = branches && branches.length > 0;
    return `${paramProps}
      data: {
        ${dataProps}
        trial_id: ${id},
        ${isInLoop ? `isInLoop: true,` : ""}
        ${
          hasBranches
            ? `
        branches: [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}],
        branchConditions: [${JSON.stringify(branchConditions)}] 
        `
            : ""
        }
      },`;
  };

  function toCamelCase(str: string): string {
    if (!str) return "";
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

    const timelineProps = generateTrialProps(activeParameters, data);
    if (!isInLoop) {
      if (orders || categories) {
        code += `
    let test_stimuli_${trialNameSanitized} = [];
    
    if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
      const stimuliOrders = ${JSON.stringify(stimuliOrders)};
      const categoryData = ${JSON.stringify(categoryData)};
      const test_stimuli_previous_${trialNameSanitized} = [${testStimuliCode.join(",")}];
      
      if (categoryData.length > 0) {
        // Obtener todas las categorías únicas
        const allCategories = [...new Set(categoryData)];
        
        // Determinar qué categoría le corresponde a este participante
        const categoryIndex = (participantNumber - 1) % allCategories.length;
        const participantCategory = allCategories[categoryIndex];
        
        // Encontrar los índices que corresponden a esta categoría
        const categoryIndices = [];
        categoryData.forEach((category, index) => {
          if (category === participantCategory) {
            categoryIndices.push(index);
          }
        });
        
        // Filtrar los estímulos por categoría
        const categoryFilteredStimuli = categoryIndices.map(index => 
          test_stimuli_previous_${trialNameSanitized}[index]
        );

        // Aplicar el orden si existe
        if (stimuliOrders.length > 0) {
          const orderIndex = (participantNumber - 1) % stimuliOrders.length;
          const index_order = stimuliOrders[orderIndex];
          
          // Crear mapeo de índices originales a índices filtrados
          const indexMapping = {};
          categoryIndices.forEach((originalIndex, filteredIndex) => {
            indexMapping[originalIndex] = filteredIndex;
          });
          
          // Aplicar el orden solo a los índices que existen en la categoría filtrada
          const orderedIndices = index_order
            .filter(i => indexMapping.hasOwnProperty(i))
            .map(i => indexMapping[i]);
          
          test_stimuli_${trialNameSanitized} = orderedIndices
            .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
            .map(i => categoryFilteredStimuli[i]);
        } else {
          test_stimuli_${trialNameSanitized} = categoryFilteredStimuli;
        }
        
        console.log("Participant:", participantNumber, "Category:", participantCategory);
        console.log("Category indices:", categoryIndices);
        console.log("Filtered stimuli:", test_stimuli_${trialNameSanitized});
        } else {
        // Lógica original sin categorías
        const orderIndex = (participantNumber - 1) % stimuliOrders.length;
        const index_order = stimuliOrders[orderIndex];
        
        test_stimuli_${trialNameSanitized} = index_order
          .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${trialNameSanitized}.length)
          .map((i) => test_stimuli_previous_${trialNameSanitized}[i]);
          
        console.log(test_stimuli_${trialNameSanitized});
      }
    }`;
      } else {
        code += `
    const test_stimuli_${trialNameSanitized} = [${testStimuliCode.join(",")}];`;
      }
    }
    code += `
    const ${trialNameSanitized}_timeline = {
    type: ${pluginNameImport}, ${timelineProps}
    `;

    // Lógica de branching
    if (isInLoop) {
      // Trial dentro de un loop: usar variables locales del loop para branching
      const hasBranches = branches && branches.length > 0;
      const hasMultipleBranches = branches && branches.length > 1;
      const hasBranchConditions =
        branchConditions && branchConditions.length > 0;

      if (hasBranches) {
        // Si tiene branches, agregar lógica de branching dentro del loop
        if (!hasMultipleBranches || !hasBranchConditions) {
          // Si solo hay un branch O no hay condiciones, seguir automáticamente al primer branch
          code += `
    on_finish: function(data) {
      // Branching automático al primer branch (dentro del loop)
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        loopNextTrialId = branches[0];
        loopSkipRemaining = true;
        loopBranchingActive = true;
      }
    },`;
        } else {
          // Si hay múltiples branches Y condiciones, evaluar las condiciones
          code += `
    on_finish: function(data) {
      // Evaluar condiciones del trial para branching interno del loop
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      
      let nextTrialId = null;
      
      // Evaluar cada condición (lógica OR entre condiciones)
      for (const condition of branchConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Todas las reglas en una condición deben ser verdaderas (lógica AND)
        const allRulesMatch = condition.rules.every(rule => {
          const propValue = data[rule.prop];
          const compareValue = rule.value;
          
          // Convertir valores para comparación
          const numPropValue = parseFloat(propValue);
          const numCompareValue = parseFloat(compareValue);
          const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);
          
          switch (rule.op) {
            case '==':
              return isNumeric ? numPropValue === numCompareValue : propValue == compareValue;
            case '!=':
              return isNumeric ? numPropValue !== numCompareValue : propValue != compareValue;
            case '>':
              return isNumeric && numPropValue > numCompareValue;
            case '<':
              return isNumeric && numPropValue < numCompareValue;
            case '>=':
              return isNumeric && numPropValue >= numCompareValue;
            case '<=':
              return isNumeric && numPropValue <= numCompareValue;
            default:
              return false;
          }
        });
        
        if (allRulesMatch) {
          nextTrialId = condition.nextTrialId;
          break;
        }
      }
      
      // Si no se encontró match, usar el primer branch por defecto
      if (!nextTrialId && branches.length > 0) {
        nextTrialId = branches[0];
      }
      
      if (nextTrialId) {
        loopNextTrialId = nextTrialId;
        loopSkipRemaining = true;
        loopBranchingActive = true;
      }
    },`;
        }
      } else {
        // Trial terminal dentro del loop: no tiene branches
        // Verificar si el loop padre tiene branches
        code += `
    on_finish: function(data) {
      // Este trial no tiene branches, verificar si el loop padre tiene branches
    if (typeof loopHasBranches !== 'undefined' && loopHasBranches) {
        // El loop tiene branches, activar branching del loop al terminar
        // Esto se manejará en el on_finish del loop
        loopShouldBranchOnFinish = true;
      } else if (!loopHasBranches) {
        // Ni el trial ni el loop tienen branches - trial terminal
        // Si llegamos aquí después de un branching global, terminar el experimento
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
      }
    },`;
      }
    } else {
      // Lógica de branching para trials que NO están en loops (timeline principal)
      const hasBranches = branches && branches.length > 0;
      const hasMultipleBranches = branches && branches.length > 1;
      const hasBranchConditions =
        branchConditions && branchConditions.length > 0;

      if (hasBranches) {
        // Si tiene branches, agregar lógica de branching
        if (!hasMultipleBranches || !hasBranchConditions) {
          // Si solo hay un branch O no hay condiciones, seguir automáticamente al primer branch
          code += `
    on_finish: function(data) {
      // Branching automático al primer branch
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
      }
    },
    `;
        }
        // Si hay múltiples branches Y condiciones, la lógica se maneja en Timeline.tsx
      } else {
        // Trial terminal: no tiene branches
        code += `
    on_finish: function(data) {
      // Este trial no tiene branches, es un trial terminal
      // Si llegamos aquí después de un branching, terminar el experimento
      if (window.branchingActive) {
        jsPsych.abortExperiment('', {});
      }
    },
    `;
      }
    }

    if (includesExtensions && extensions !== "") {
      code += `
    extensions: ${extensions}
    };
    `;
    } else {
      code += `};`;
    }

    if (isInLoop) {
      return code;
    } else {
      code += `
    const ${trialNameSanitized}_procedure = {
    timeline: 
    [${trialNameSanitized}_timeline],
    timeline_variables: test_stimuli_${trialNameSanitized},
    conditional_function: function() {
      const currentId = ${id};
      
      // Si skipRemaining está activo, verificar si este es el trial objetivo
      if (window.skipRemaining) {
        if (String(currentId) === String(window.nextTrialId)) {
          // Encontramos el trial objetivo
          window.skipRemaining = false;
          window.nextTrialId = null;
          return true;
        }
        // No es el objetivo, saltar
        return false;
      }
      
      return true;
    },
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
    }
  };

  return { genTrialCode, mappedJson };
}
