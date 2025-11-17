import {
  BranchCondition,
  RepeatCondition,
  ColumnMapping,
  ColumnMappingEntry,
  ParamsOverrideCondition,
} from "../../types";

type Props = {
  id: number | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[];
  paramsOverride?: ParamsOverrideCondition[];
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
  parentLoopId?: string | null; // ID del loop padre para generar nombres de variables dinámicos
};

export function useTrialCode({
  id,
  branches,
  branchConditions,
  repeatConditions,
  paramsOverride,
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
  parentLoopId,
}: Props) {
  const activeParameters = parameters.filter(
    (p) => columnMapping[p.key]?.source !== "none"
  );
  const trialNameSanitized = trialName.replace(/\s+/g, "_");

  // Helper para sanitizar nombres de IDs
  const sanitizeName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  // Helper para generar nombres de variables dinámicos basados en el parentLoopId
  const getVarName = (baseName: string): string => {
    if (!isInLoop || !parentLoopId) {
      // Trial fuera de loop - no debería llegar aquí si isInLoop es true
      return baseName;
    }
    // Trial dentro de un loop - usar prefijo del loop padre
    const sanitizedParentId = sanitizeName(parentLoopId);
    return `loop_${sanitizedParentId}_${baseName}`;
  };

  const mappedJson = (() => {
    const mapRow = (row?: Record<string, any>, idx?: number) => {
      const result: Record<string, any> = {};

      // Lógica especial para DynamicPlugin
      if (pluginName === "DynamicPlugin") {
        // Para DynamicPlugin, extraer components y responses desde columnMapping
        const componentsValue = getColumnValue(
          columnMapping["components"],
          row,
          undefined,
          "components"
        );
        const responsesValue = getColumnValue(
          columnMapping["responses"],
          row,
          undefined,
          "responses"
        );

        // Helper para procesar componentes - solo remover valores undefined/null
        const processComponentFunctions = (components: any[]) => {
          if (!Array.isArray(components)) return components;

          return components.map((comp: any) => {
            if (!comp || typeof comp !== "object") return comp;

            const processedComp = { ...comp };

            // Eliminar button_html si es undefined o null para no contaminar el objeto
            if ("button_html" in processedComp) {
              if (
                processedComp.button_html === undefined ||
                processedComp.button_html === null
              ) {
                delete processedComp.button_html;
              }
              // Si es función o string, dejarla como está - stringifyWithFunctions la manejará
            }

            return processedComp;
          });
        };

        const prefixedComponents = isInLoop
          ? `components_${trialNameSanitized}`
          : "components";
        const prefixedResponses = isInLoop
          ? `responses_${trialNameSanitized}`
          : "responses";

        result[prefixedComponents] = processComponentFunctions(
          componentsValue || []
        );
        result[prefixedResponses] = processComponentFunctions(
          responsesValue || []
        );

        return result;
      }

      // Lógica normal para otros plugins
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
    // Lógica especial para DynamicPlugin
    if (pluginName === "DynamicPlugin") {
      const componentsKey = isInLoop
        ? `components_${trialNameSanitized}`
        : "components";
      const responsesKey = isInLoop
        ? `responses_${trialNameSanitized}`
        : "responses";

      const dataProps = data
        .map(({ key }: { key: string }) => {
          const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
          return `${key}: "${propKey}",`;
        })
        .join("\n");

      const hasBranches = branches && branches.length > 0;
      return `components: jsPsych.timelineVariable("${componentsKey}"),
      responses: jsPsych.timelineVariable("${responsesKey}"),
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
    }

    // Lógica normal para otros plugins
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

    // Helper para stringify recursivo que preserva funciones
    const stringifyValue = (val: any, key?: string): string => {
      // Check if this is a function parameter or if value looks like a function
      const paramType = key
        ? params.find((p) => p.key === key)?.type
        : undefined;
      const isFunction = paramType === "function" || paramType === "FUNCTION";
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
        return val;
      }

      // Handle arrays (like components in DynamicPlugin)
      if (Array.isArray(val)) {
        const items = val
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              // Process objects within arrays (like component configs)
              const objKeys = Object.keys(item);
              const objProps = objKeys
                .map((objKey) => {
                  const objVal = item[objKey];

                  // Special handling for button_html in components
                  if (objKey === "button_html") {
                    // If it's a function, convert to string
                    if (typeof objVal === "function") {
                      return `${objKey}: ${objVal.toString()}`;
                    }
                    // If it's a string that looks like a function
                    if (typeof objVal === "string" && objVal.trim()) {
                      const trimmed = objVal.trim();
                      if (
                        trimmed.startsWith("(") ||
                        trimmed.startsWith("function") ||
                        trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=>/)
                      ) {
                        return `${objKey}: ${objVal}`;
                      }
                    }
                  }

                  return `${objKey}: ${stringifyValue(objVal)}`;
                })
                .join(", ");
              return `{ ${objProps} }`;
            }
            return stringifyValue(item);
          })
          .join(", ");
        return `[${items}]`;
      }

      // Default JSON stringify
      return JSON.stringify(val);
    };

    return (
      "{" +
      allKeys
        .map((key) => {
          const val = values[key];
          return `${key}: ${stringifyValue(val, key)}`;
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

    // Para DynamicPlugin, usar directamente "DynamicPlugin" sin convertir
    const pluginTypeForCode =
      pluginName === "plugin-dynamic" ? "DynamicPlugin" : pluginNameImport;

    code += `
    const ${trialNameSanitized}_timeline = {
    type: ${pluginTypeForCode}, ${timelineProps}
    on_start: function(trial) {
      // First, evaluate and apply params override conditions (if any)
      ${
        paramsOverride && paramsOverride.length > 0
          ? `
      const paramsOverrideConditions = ${JSON.stringify(paramsOverride)};
      
      // Evaluate params override conditions
      for (const condition of paramsOverrideConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Get data from all previous trials
        const allData = jsPsych.data.get().values();
        
        // Check if all rules match (AND logic within condition)
        const allRulesMatch = condition.rules.every(rule => {
          if (!rule.trialId || !rule.prop) {
            return false;
          }
          
          // Find data from the referenced trial
          const trialData = allData.filter(d => {
            // Compare both as strings to handle type mismatches
            return String(d.trial_id) === String(rule.trialId) || d.trial_id === rule.trialId;
          });
          if (trialData.length === 0) {
            return false;
          }
          
          // Use the most recent data if multiple exist
          const data = trialData[trialData.length - 1];
          const propValue = data[rule.prop];
          const compareValue = rule.value;
          
          // Convert values for comparison
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
        
        // If all rules match, apply parameter overrides
        if (allRulesMatch && condition.paramsToOverride) {
          Object.entries(condition.paramsToOverride).forEach(([key, param]) => {
            if (param && param.source !== 'none') {
              if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
                trial[key] = param.value;
              } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
                // For CSV source, param.value contains the column name, get the actual value from trial
                trial[key] = trial[param.value];
              }
            }
          });
          // Break after first matching condition (OR logic between conditions)
          break;
        }
      }
      `
          : ""
      }
      // Then apply custom parameters from branching conditions (higher priority)
      ${
        isInLoop
          ? `
      // For trials in loops, use loop-specific BranchCustomParameters
      if (typeof ${getVarName("BranchCustomParameters")} !== 'undefined' && ${getVarName("BranchCustomParameters")} && typeof ${getVarName("BranchCustomParameters")} === 'object') {
        console.log('Applying custom parameters to loop trial:', ${getVarName("BranchCustomParameters")});
        Object.entries(${getVarName("BranchCustomParameters")}).forEach(([key, param]) => {
          if (param && param.source !== 'none') {
            // Handle different parameter sources
            if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
              // For typed values, use them directly
              trial[key] = param.value;
              console.log(\`Set trial.\${key} = \${param.value}\`);
            } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
              // For CSV values, param.value contains the column name, get the actual value from trial
              trial[key] = trial[param.value];
              console.log(\`Set trial.\${key} = \${trial[param.value]} (from CSV column: \${param.value})\`);
            }
          }
        });
        // Clear the custom parameters after applying them
        ${getVarName("BranchCustomParameters")} = null;
      }
      `
          : `
      // For trials outside loops, use window.branchCustomParameters
      if (window.branchCustomParameters && typeof window.branchCustomParameters === 'object') {
        console.log('Applying custom parameters to trial:', window.branchCustomParameters);
        Object.entries(window.branchCustomParameters).forEach(([key, param]) => {
          if (param && param.source !== 'none') {
            // Handle different parameter sources
            if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
              // For typed values, use them directly
              trial[key] = param.value;
              console.log(\`Set trial.\${key} = \${param.value}\`);
            } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
              // For CSV values, param.value contains the column name, get the actual value from trial
              trial[key] = trial[param.value];
              console.log(\`Set trial.\${key} = \${trial[param.value]} (from CSV column: \${param.value})\`);
            }
          }
        });
        // Clear the custom parameters after applying them
        window.branchCustomParameters = null;
      }
      `
      }
    },
    `;

    // Lógica de branching
    if (isInLoop) {
      // Trial dentro de un loop: usar variables locales del loop para branching
      const hasBranches = branches && branches.length > 0;
      const hasBranchConditions =
        branchConditions && branchConditions.length > 0;
      const hasRepeatConditions =
        repeatConditions && repeatConditions.length > 0;

      if (hasBranches || hasRepeatConditions) {
        // Si tiene branches o repeat conditions, agregar lógica completa
        if (hasRepeatConditions) {
          // Si tiene repeat conditions, generar on_finish completo
          code += `
    on_finish: function(data) {
      // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
      const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
      
      let shouldRepeat = false;
      for (const condition of repeatConditionsArray) {
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
        
        if (allRulesMatch && condition.jumpToTrialId) {
          console.log('Repeat condition matched in loop! Jumping to trial:', condition.jumpToTrialId);
          // Guardar el trial objetivo en localStorage
          localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
          shouldRepeat = true;
          break;
        }
      }
      
      if (shouldRepeat) {
        // Limpiar el contenedor de jsPsych (jspsych-container es el display_element)
        const container = document.getElementById('jspsych-container');
        if (container) {
          // Limpiar todo el contenido del container
          container.innerHTML = '';
        }
        // Reiniciar el timeline
        setTimeout(() => {
          jsPsych.run(timeline);
        }, 100);
        return;
      }
      
      ${
        hasBranches
          ? !hasBranchConditions
            ? `
      // Branching automático al primer branch (dentro del loop)
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        ${getVarName("NextTrialId")} = branches[0];
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
      }
      `
            : `
      // Evaluar condiciones del trial para branching interno del loop
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      
      let nextTrialId = null;
      let matchedCustomParameters = null;
      
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
          // Store custom parameters if they exist
          if (condition.customParameters) {
            matchedCustomParameters = condition.customParameters;
            console.log('Loop branching: matched custom parameters:', matchedCustomParameters);
          }
          break;
        }
      }
      
      // Si se encontró match, activar branching
      if (nextTrialId) {
        ${getVarName("NextTrialId")} = nextTrialId;
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
        // Store custom parameters for the next trial in the loop
        if (matchedCustomParameters) {
          ${getVarName("BranchCustomParameters")} = matchedCustomParameters;
        }
      }
      `
          : `
      // Este trial no tiene branches, verificar si el loop padre tiene branches
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        // El loop tiene branches, activar branching del loop al terminar
        // Esto se manejará en el on_finish del loop
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
        // Ni el trial ni el loop tienen branches - trial terminal
        // Si llegamos aquí después de un branching global, terminar el experimento
        if (window.branchingActive) {
          jsPsych.abortExperiment('', {});
        }
      }
      `
      }
    },`;
        } else if (hasBranches) {
          // Si tiene branches pero NO repeat conditions
          if (!hasBranchConditions) {
            // Si NO hay condiciones, seguir automáticamente al primer branch
            code += `
    on_finish: function(data) {
      // Branching automático al primer branch (dentro del loop)
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        ${getVarName("NextTrialId")} = branches[0];
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
      }
    },`;
          } else {
            // Si hay condiciones, evaluar las condiciones (siempre)
            code += `
    on_finish: function(data) {
      // Evaluar condiciones del trial para branching interno del loop
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      
      let nextTrialId = null;
      let matchedCustomParameters = null;
      
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
          // Store custom parameters if they exist
          if (condition.customParameters) {
            matchedCustomParameters = condition.customParameters;
            console.log('Loop branching: matched custom parameters:', matchedCustomParameters);
          }
          break;
        }
      }
      
      // Si se encontró match, activar branching
      if (nextTrialId) {
        ${getVarName("NextTrialId")} = nextTrialId;
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
        // Store custom parameters for the next trial in the loop
        if (matchedCustomParameters) {
          ${getVarName("BranchCustomParameters")} = matchedCustomParameters;
        }
      }
    },`;
          }
        }
      } else {
        // Trial terminal dentro del loop: no tiene branches ni repeat conditions
        // Verificar si el loop padre tiene branches
        code += `
    on_finish: function(data) {
      // Este trial no tiene branches ni repeat conditions, verificar si el loop padre tiene branches
      if (typeof ${getVarName("HasBranches")} !== 'undefined' && ${getVarName("HasBranches")}) {
        // El loop tiene branches, activar branching del loop al terminar
        // Esto se manejará en el on_finish del loop
        ${getVarName("ShouldBranchOnFinish")} = true;
      } else if (!${getVarName("HasBranches")}) {
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
      const hasRepeatConditions =
        repeatConditions && repeatConditions.length > 0;

      if (hasBranches || hasRepeatConditions) {
        // Si tiene branches o repeat conditions, generar on_finish completo
        code += `
    on_finish: function(data) {
      ${
        hasRepeatConditions
          ? `
      // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
      const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
      
      for (const condition of repeatConditionsArray) {
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
        
        if (allRulesMatch && condition.jumpToTrialId) {
          console.log('Repeat condition matched! Jumping to trial:', condition.jumpToTrialId);
          // Guardar el trial objetivo en localStorage
          localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
          // Limpiar el contenedor de jsPsych (jspsych-container es el display_element)
          const container = document.getElementById('jspsych-container');
          if (container) {
            // Limpiar todo el contenido del container
            container.innerHTML = '';
          }
          // Reiniciar el timeline
          setTimeout(() => {
            jsPsych.run(timeline);
          }, 100);
          return;
        }
      }
      `
          : ""
      }
      ${
        hasBranches
          ? hasMultipleBranches && hasBranchConditions
            ? `
      // Si hay múltiples branches Y condiciones, la lógica se maneja en Timeline.tsx
      `
            : `
      // Branching automático al primer branch
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
      }
      `
          : `
      // Este trial no tiene branches, es un trial terminal
      // Si llegamos aquí después de un branching, terminar el experimento
      if (window.branchingActive) {
        jsPsych.abortExperiment('', {});
      }
      `
      }
    },
    `;
      } else {
        // Trial terminal: no tiene branches ni repeat conditions
        code += `
    on_finish: function(data) {
      // Este trial no tiene branches ni repeat conditions, es un trial terminal
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
      
      // Verificar si hay un trial objetivo guardado en localStorage (para repeat/jump)
      const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
      if (jumpToTrial) {
        if (String(currentId) === String(jumpToTrial)) {
          // Encontramos el trial objetivo para repeat/jump
          console.log('Repeat/jump: Found target trial', currentId);
          localStorage.removeItem('jsPsych_jumpToTrial');
          return true;
        }
        // No es el objetivo, saltar
        console.log('Repeat/jump: Skipping trial', currentId);
        return false;
      }
      
      // Si skipRemaining está activo (branching normal), verificar si este es el trial objetivo
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
