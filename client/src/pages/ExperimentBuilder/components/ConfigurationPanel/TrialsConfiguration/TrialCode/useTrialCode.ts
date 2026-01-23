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

  // DEBUG: Log incoming props
  console.log(`=== useTrialCode DEBUG for ${trialName} ===`);
  console.log("orders:", orders);
  console.log("categories:", categories);
  console.log("stimuliOrders:", stimuliOrders);
  console.log("safeStimuliOrders:", safeStimuliOrders);
  console.log("categoryData:", categoryData);
  console.log("safeCategoryData:", safeCategoryData);
  console.log("csvJson.length:", csvJson?.length);
  console.log("isInLoop:", isInLoop);
  console.log("pluginName:", pluginName);

  const activeParameters = parameters.filter(
    (p) => columnMapping[p.key] && columnMapping[p.key].source !== "none",
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

  // DEBUG: Log mappedJson
  console.log(`mappedJson for ${trialName}:`, mappedJson);
  console.log(`mappedJson.length for ${trialName}:`, mappedJson?.length);

  // Generación del template del trial/ensayo
  const generateTrialProps = (
    params: any[],
    data: any,
    hasData: boolean = true,
  ): string => {
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

      // If no data, don't use timelineVariable
      if (!hasData && !isInLoop) {
        return `data: {
        ${dataProps}
        trial_id: ${id},
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
    const dataProps = data
      .map(({ key }: { key: string }) => {
        const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        return `${key}: "${propKey}",`;
      })
      .join("\n");

    // Incluir branches tanto para trials en loop como fuera de loop
    const hasBranches = branches && branches.length > 0;

    // If no data and not in loop, don't use timelineVariable for parameters
    if (!hasData && !isInLoop) {
      return `data: {
        ${dataProps}
        trial_id: ${id},
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

    const paramProps = params
      .map(({ key }: { key: string }) => {
        const propKey = isInLoop ? `${key}_${trialNameSanitized}` : key;
        return `${key}: jsPsych.timelineVariable("${propKey}"),`;
      })
      .join("\n");

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
    // Solo incluir keys que existan en values
    // No forzar la inclusión de todos los params si no están en values
    const allKeys = Object.keys(values);

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

    // Check if all mapped rows are empty objects
    const hasAnyData = mappedJson.some((row) => Object.keys(row).length > 0);

    const timelineProps = generateTrialProps(
      activeParameters,
      data,
      hasAnyData,
    );
    if (!isInLoop) {
      if (orders || categories) {
        code += `
    let test_stimuli_${trialNameSanitized} = [];
    
    console.log("=== DEBUG ${trialNameSanitized}: Starting orders/categories logic ===");
    console.log("Trial name: ${trialNameSanitized}");
    console.log("Trial ID: ${id}");
    console.log("orders flag:", ${orders});
    console.log("categories flag:", ${categories});
    console.log("typeof participantNumber:", typeof participantNumber);
    console.log("participantNumber value:", participantNumber);
    console.log("isNaN(participantNumber):", isNaN(participantNumber));
    console.log("Condition check (typeof participantNumber === 'number' && !isNaN(participantNumber)):", (typeof participantNumber === "number" && !isNaN(participantNumber)));
    
    if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
      console.log("✓ INSIDE participantNumber check - condition passed");
      const stimuliOrders = ${JSON.stringify(safeStimuliOrders)};
      const categoryData = ${JSON.stringify(safeCategoryData)};
      const test_stimuli_previous_${trialNameSanitized} = [${testStimuliCode.join(",")}];
      
      console.log("participantNumber:", participantNumber);
      console.log("stimuliOrders:", stimuliOrders);
      console.log("stimuliOrders.length:", stimuliOrders.length);
      console.log("categoryData:", categoryData);
      console.log("categoryData.length:", categoryData.length);
      console.log("test_stimuli_previous_${trialNameSanitized}.length:", test_stimuli_previous_${trialNameSanitized}.length);
      
      if (categoryData.length > 0) {
        console.log("ENTERING categoryData.length > 0 branch");
        // Obtener todas las categorías únicas
        const allCategories = [...new Set(categoryData)];
        console.log("allCategories:", allCategories);
        
        // Determinar qué categoría le corresponde a este participante
        const categoryIndex = (participantNumber - 1) % allCategories.length;
        const participantCategory = allCategories[categoryIndex];
        console.log("categoryIndex:", categoryIndex);
        console.log("participantCategory:", participantCategory);
        
        // Encontrar los índices que corresponden a esta categoría
        const categoryIndices = [];
        categoryData.forEach((category, index) => {
          if (category === participantCategory) {
            categoryIndices.push(index);
          }
        });
        console.log("categoryIndices:", categoryIndices);
        
        // Filtrar los estímulos por categoría
        const categoryFilteredStimuli = categoryIndices.map(index => 
          test_stimuli_previous_${trialNameSanitized}[index]
        );
        console.log("categoryFilteredStimuli.length:", categoryFilteredStimuli.length);

        // Aplicar el orden si existe
        if (stimuliOrders.length > 0) {
          console.log("ENTERING stimuliOrders.length > 0 sub-branch");
          const orderIndex = (participantNumber - 1) % stimuliOrders.length;
          const index_order = stimuliOrders[orderIndex];
          console.log("orderIndex:", orderIndex);
          console.log("index_order:", index_order);
          
          // Crear mapeo de índices originales a índices filtrados
          const indexMapping = {};
          categoryIndices.forEach((originalIndex, filteredIndex) => {
            indexMapping[originalIndex] = filteredIndex;
          });
          console.log("indexMapping:", indexMapping);
          
          // Aplicar el orden solo a los índices que existen en la categoría filtrada
          const orderedIndices = index_order
            .filter(i => indexMapping.hasOwnProperty(i))
            .map(i => indexMapping[i]);
          console.log("orderedIndices:", orderedIndices);
          
          test_stimuli_${trialNameSanitized} = orderedIndices
            .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
            .map(i => categoryFilteredStimuli[i]);
        } else {
          console.log("ENTERING else (no orders) sub-branch");
          test_stimuli_${trialNameSanitized} = categoryFilteredStimuli;
        }
        
        console.log("Participant:", participantNumber, "Category:", participantCategory);
        console.log("Category indices:", categoryIndices);
        console.log("Filtered stimuli:", test_stimuli_${trialNameSanitized});
        console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);
      } else if (stimuliOrders.length > 0) {
        console.log("ENTERING stimuliOrders.length > 0 branch (no categories)");
        // Lógica original sin categorías pero con órdenes
        const orderIndex = (participantNumber - 1) % stimuliOrders.length;
        const index_order = stimuliOrders[orderIndex];
        console.log("orderIndex:", orderIndex);
        console.log("index_order:", index_order);
        
        test_stimuli_${trialNameSanitized} = index_order
          .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${trialNameSanitized}.length)
          .map((i) => test_stimuli_previous_${trialNameSanitized}[i]);
          
        console.log(test_stimuli_${trialNameSanitized});
        console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);
      } else {
        console.log("ENTERING else branch (no categories, no orders)");
        // Sin categorías ni órdenes, usar todos los estímulos
        test_stimuli_${trialNameSanitized} = test_stimuli_previous_${trialNameSanitized};
        console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);
      }
    } else {
      console.log("✗ FAILED participantNumber check");
      console.log("Reason: typeof participantNumber !== 'number' OR isNaN(participantNumber)");
      console.log("test_stimuli_${trialNameSanitized} will be empty array!");
    }
    console.log("=== END DEBUG ${trialNameSanitized} ===");
    console.log("Final test_stimuli_${trialNameSanitized}:", test_stimuli_${trialNameSanitized});
    console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);`;
      } else if (hasAnyData) {
        // Only generate timeline_variables if there's actual data
        code += `
    const test_stimuli_${trialNameSanitized} = [${testStimuliCode.join(",")}];`;
      }
      // If !hasAnyData, don't generate test_stimuli at all - trial will use plugin defaults
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
    console.log("=== PROCEDURE SETUP ${trialNameSanitized} ===");
    console.log("test_stimuli_${trialNameSanitized} before procedure:", test_stimuli_${trialNameSanitized});
    console.log("test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized} ? test_stimuli_${trialNameSanitized}.length : 'undefined');
    
    const ${trialNameSanitized}_procedure = {
    timeline: 
    [${trialNameSanitized}_timeline],`;

      // Only add timeline_variables if there's data
      if (hasAnyData || orders || categories) {
        code += `
    timeline_variables: test_stimuli_${trialNameSanitized},`;
      }

      code += `
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
