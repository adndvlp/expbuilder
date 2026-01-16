import {
  BranchCondition,
  RepeatCondition,
  ColumnMapping,
  ColumnMappingEntry,
  ParamsOverrideCondition,
} from "../../types";
import {
  generateOnStartCode,
  generateOnFinishCode,
  generateConditionalFunctionCode,
} from "./codeGenerators";

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
  columnMapping: ColumnMapping;
  uploadedFiles: any[]; // Archivos del Timeline para mapear nombres a URLs
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
  columnMapping,
  uploadedFiles,
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
  // Defensive checks for undefined values
  const safeCsvJson = csvJson || [];
  const safeStimuliOrders = stimuliOrders || [];
  const safeCategoryData = categoryData || [];

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
    // Helper para mapear nombres de archivos a URLs
    const mapFileToUrl = (value: any): any => {
      if (!value) return value;

      // Si es un array, procesar cada elemento
      if (Array.isArray(value)) {
        return value.map((v) => mapFileToUrl(v));
      }

      // Si es un string que no es URL, buscar en uploadedFiles
      if (
        typeof value === "string" &&
        value.trim() &&
        !/^https?:\/\//.test(value)
      ) {
        const found = uploadedFiles.find(
          (f) =>
            f.name &&
            (f.name === value || f.url === value || value.endsWith(f.name))
        );
        return found && found.url ? found.url : value;
      }

      return value;
    };

    const mapRow = (row?: Record<string, any>) => {
      const result: Record<string, any> = {};

      // Lógica especial para DynamicPlugin
      if (pluginName === "plugin-dynamic") {
        // Para DynamicPlugin, extraer components y responses desde columnMapping
        // Cuando hay CSV y el source es "typed", necesitamos replicar los valores typed en todas las filas
        const componentsMapping = columnMapping["components"];
        const responsesMapping = columnMapping["response_components"]; // ¡Corregido! Era "responses" pero el key correcto es "response_components"

        // Obtener valores base (typed o csv)
        let componentsValue = getColumnValue(
          componentsMapping,
          row,
          undefined,
          "components"
        );
        let responsesValue = getColumnValue(
          responsesMapping,
          row,
          undefined,
          "response_components"
        );

        // Si hay CSV pero el mapping es typed, usar directamente el valor typed
        if (row && componentsMapping?.source === "typed") {
          componentsValue = componentsMapping.value;
        }
        if (row && responsesMapping?.source === "typed") {
          responsesValue = responsesMapping.value;
        }

        // Helper para procesar componentes - remover valores undefined/null y mapear archivos
        const processComponentFunctions = (components: any[]) => {
          if (!Array.isArray(components)) return components;

          return components.map((comp: any) => {
            if (!comp || typeof comp !== "object") return comp;

            const processedComp = { ...comp };

            // Procesar cada propiedad que está en formato {source, value}
            // y extraer el valor real
            Object.keys(processedComp).forEach((prop) => {
              // Ignorar type y propiedades estructurales
              if (prop === "type") {
                return;
              }

              const propValue = processedComp[prop];

              // Si la propiedad está en formato {source, value}, procesarla
              if (
                propValue &&
                typeof propValue === "object" &&
                "source" in propValue &&
                "value" in propValue
              ) {
                const { source, value } = propValue;

                // Si es CSV y hay row, resolver la columna
                if (source === "csv" && row) {
                  if (Array.isArray(value)) {
                    // Si el valor es un array, mapear cada elemento
                    const resolved = value.map((item) => {
                      if (typeof item === "string" && row[item] !== undefined) {
                        return row[item];
                      }
                      return item;
                    });
                    processedComp[prop] = resolved;
                  } else if (
                    typeof value === "string" &&
                    row[value] !== undefined
                  ) {
                    // Si el valor es string y existe como columna en el CSV, resolverlo
                    // Para choices, mantenerlo como array (requerido por jsPsych)
                    const resolvedValue = row[value];
                    if (prop === "choices") {
                      processedComp[prop] = [resolvedValue];
                    } else {
                      processedComp[prop] = resolvedValue;
                    }
                  } else if (typeof value === "string") {
                    // Si el valor es string pero no existe en row
                    console.warn(
                      `CSV source for ${prop} but column "${value}" not found in row`
                    );
                    if (prop === "choices") {
                      processedComp[prop] = [value];
                    }
                  }
                } else if (source === "typed") {
                  // Si es typed, usar el valor directamente
                  processedComp[prop] = value;
                }
              }
            });

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

            // Luego, mapear archivos multimedia en componentes (stimulus, src, etc.)
            // IMPORTANTE: Esto debe ejecutarse DESPUÉS de resolver columnas CSV
            // Detectar propiedades que pueden contener rutas de archivos
            const mediaProperties = [
              "stimulus",
              "src",
              "source",
              "audio",
              "video",
              "image",
            ];

            if (uploadedFiles.length > 0) {
              mediaProperties.forEach((prop) => {
                if (prop in processedComp) {
                  const value = processedComp[prop];
                  const mappedValue = mapFileToUrl(value);

                  // VideoComponent requiere que stimulus sea un array
                  // Si el componente es VideoComponent y stimulus es string, convertir a array
                  if (
                    comp.type === "VideoComponent" &&
                    prop === "stimulus" &&
                    typeof mappedValue === "string"
                  ) {
                    processedComp[prop] = [mappedValue];
                  } else {
                    processedComp[prop] = mappedValue;
                  }
                }
              });
            }

            return processedComp;
          });
        };

        const prefixedComponents = isInLoop
          ? `components_${trialNameSanitized}`
          : "components";
        const prefixedResponseComponents = isInLoop
          ? `response_components_${trialNameSanitized}`
          : "response_components";

        result[prefixedComponents] = processComponentFunctions(
          componentsValue || []
        );
        result[prefixedResponseComponents] = processComponentFunctions(
          responsesValue || []
        );

        // Procesar response_components (also needs component processing)
        const responseComponentsMapping = columnMapping["response_components"];
        if (responseComponentsMapping) {
          const prefixedResponseComponents = isInLoop
            ? `response_components_${trialNameSanitized}`
            : "response_components";

          // Get the raw value
          let responseComponentsValue;
          if (row && responseComponentsMapping.source === "typed") {
            responseComponentsValue = responseComponentsMapping.value;
          } else {
            responseComponentsValue = getColumnValue(
              responseComponentsMapping,
              row,
              undefined,
              "response_components"
            );
          }

          // Process through processComponentFunctions if it's an array of components
          if (Array.isArray(responseComponentsValue)) {
            result[prefixedResponseComponents] = processComponentFunctions(
              responseComponentsValue
            );
          } else {
            result[prefixedResponseComponents] = responseComponentsValue;
          }
        }

        // Procesar otros parámetros del DynamicPlugin (excluding response_components)
        const additionalDynamicParams = [
          "stimuli_duration",
          "trial_duration",
          "response_ends_trial",
        ];

        additionalDynamicParams.forEach((paramKey) => {
          const paramMapping = columnMapping[paramKey];
          if (paramMapping) {
            const prefixedKey = isInLoop
              ? `${paramKey}_${trialNameSanitized}`
              : paramKey;

            // Si hay CSV pero el mapping es typed, usar directamente el valor typed
            if (row && paramMapping.source === "typed") {
              result[prefixedKey] = paramMapping.value;
            } else {
              // Obtener el valor normalmente (de CSV o typed)
              result[prefixedKey] = getColumnValue(
                paramMapping,
                row,
                undefined,
                paramKey
              );
            }
          }
        });

        return result;
      }

      // Lógica normal para otros plugins
      activeParameters.forEach((param) => {
        const { key } = param;
        const prefixedkey = isInLoop ? `${key}_${trialNameSanitized}` : key;

        // Detectar si es un parámetro de archivos multimedia
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

        if (isMediaParameter(key) && uploadedFiles.length > 0) {
          // Obtener el valor del columnMapping
          const value =
            row && row[key] !== undefined
              ? row[key]
              : getColumnValue(columnMapping[key], row, undefined, key);

          // Usar el helper mapFileToUrl para mapear archivos
          let mappedValue = mapFileToUrl(value);

          // Los plugins de video de jsPsych requieren que stimulus sea un array
          // Detectar si es un plugin de video y convertir string a array si es necesario
          const isVideoPlugin =
            pluginName.toLowerCase().includes("video") ||
            key.toLowerCase().includes("video");

          if (
            isVideoPlugin &&
            key === "stimulus" &&
            typeof mappedValue === "string"
          ) {
            mappedValue = [mappedValue];
          }

          result[prefixedkey] = mappedValue;
        } else {
          // Parámetro normal, sin procesamiento de archivos
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

    if (safeCsvJson.length > 0) {
      return safeCsvJson.map((row) => mapRow(row));
    } else {
      // Verificar si hay múltiples archivos separados por comas en algún parámetro
      const multipleInputsParams: { [key: string]: string[] } = {};
      let hasMultipleInputs = false;

      activeParameters.forEach((param) => {
        // Para valores con comas (múltiples archivos)
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

          return mapRow(mockRow);
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
      const responseComponentsKey = isInLoop
        ? `response_components_${trialNameSanitized}`
        : "response_components";

      const dataProps = data
        .map(({ key }: { key: string }) => {
          const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
          return `${key}: "${propKey}",`;
        })
        .join("\n");

      const hasBranches = branches && branches.length > 0;
      return `components: jsPsych.timelineVariable("${componentsKey}"),
      response_components: jsPsych.timelineVariable("${responseComponentsKey}"),
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

    // Preload is now handled globally from Timeline, not per trial
    // Individual trial preloads have been removed

    const testStimuliCode = mappedJson.map((row) =>
      stringifyWithFunctions(activeParameters, row)
    );

    const timelineProps = generateTrialProps(activeParameters, data);
    if (!isInLoop) {
      if (orders || categories) {
        code += `
    let test_stimuli_${trialNameSanitized} = [];
    
    if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
      const stimuliOrders = ${JSON.stringify(safeStimuliOrders)};
      const categoryData = ${JSON.stringify(safeCategoryData)};
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

    // Generate on_start code using the modular generator
    const onStartCode = generateOnStartCode({
      paramsOverride,
      isInLoop,
      getVarName,
    });

    code += `
    const ${trialNameSanitized}_timeline = {
    type: ${pluginTypeForCode}, ${timelineProps}
    ${onStartCode}
    `;

    // Generate on_finish code using the modular generator
    const onFinishCode = generateOnFinishCode({
      branches,
      branchConditions,
      repeatConditions,
      isInLoop,
      getVarName,
    });

    code += onFinishCode;

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
    ${generateConditionalFunctionCode(id)}
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
