import {
  BranchCondition,
  RepeatCondition,
  ColumnMapping,
  ColumnMappingEntry,
  ParamsOverrideCondition,
} from "../../types";
import MappedJson from "./MappedJson";
import {
  generateOnStartCode,
  generateOnFinishCode,
  generateConditionalFunctionCode,
} from "./TrialCodeGenerators";

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
    key?: string,
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

  const safeStimuliOrders = stimuliOrders || [];
  const safeCategoryData = categoryData || [];

  const activeParameters = parameters.filter(
    (p) => columnMapping[p.key]?.source !== "none",
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

  const { mappedJson } = MappedJson({
    isInLoop,
    uploadedFiles,
    pluginName,
    columnMapping,
    trialNameSanitized,
    activeParameters,
    csvJson,
    parameters,
    getColumnValue,
  });

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
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
      )
      .join("");
  }

  const pluginNameImport = toCamelCase(pluginName);

  function stringifyWithFunctions(
    params: { key: string; type: string }[],
    values: Record<string, any>,
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
      stringifyWithFunctions(activeParameters, row),
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
