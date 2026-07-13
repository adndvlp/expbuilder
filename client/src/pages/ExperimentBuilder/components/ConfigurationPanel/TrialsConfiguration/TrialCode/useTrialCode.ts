import {
  BranchCondition,
  RepeatCondition,
  ColumnMapping,
  ColumnMappingEntry,
  ParamsOverrideCondition,
} from "../../types";
import MappedJson from "./MappedJson";
import {
  generateInitializeCode,
  generateOnStartCode,
  generateOnLoadCode,
  generateOnFinishCode,
  generateConditionalFunctionCode,
} from "./TrialCodeGenerators";
import { generateStimuliSetupCode } from "./services/generateStimuliSetupCode";
import { generateTrialProps } from "./services/generateTrialProps";
import {
  stringifyWithFunctions,
  toCamelCase,
} from "./utils/trialCodeFormatting";

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
  isMergePoint?: boolean;
  parentLoopId?: string | null; // ID del loop padre para generar nombres de variables dinámicos
  customInitialize?: string;
  customOnStart?: string;
  customOnLoad?: string;
  customOnFinish?: string;
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
  isMergePoint,
  parentLoopId,
  customInitialize,
  customOnStart,
  customOnLoad,
  customOnFinish,
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

  const pluginNameImport = toCamelCase(pluginName);

  const genTrialCode = () => {
    let code = "";

    // Preload is now handled globally from Timeline, not per trial
    // Individual trial preloads have been removed

    const testStimuliCode = mappedJson.map((row) =>
      stringifyWithFunctions(activeParameters, row),
    );

    // Check if all mapped rows are empty objects
    const hasAnyData = mappedJson.some((row) => Object.keys(row).length > 0);

    const timelineProps = generateTrialProps({
      branchConditions,
      branches,
      columnMapping,
      data,
      hasData: hasAnyData,
      id,
      isInLoop,
      params: activeParameters,
      pluginName,
      trialName,
      trialNameSanitized,
    });
    code += generateStimuliSetupCode({
      categories,
      categoryData: safeCategoryData,
      hasAnyData,
      id,
      isInLoop,
      orders,
      stimuliOrders: safeStimuliOrders,
      testStimuliCode,
      trialNameSanitized,
    });

    // Para DynamicPlugin, usar directamente "DynamicPlugin" sin convertir
    const pluginTypeForCode =
      pluginName === "plugin-dynamic" ? "DynamicPlugin" : pluginNameImport;

    const initializeCode = generateInitializeCode(customInitialize);
    const onStartCode = generateOnStartCode({
      paramsOverride,
      isInLoop,
      getVarName,
      customOnStart,
    });
    const onLoadCode = generateOnLoadCode(customOnLoad);

    code += `
    const ${trialNameSanitized}_timeline = {
    type: ${pluginTypeForCode}, ${timelineProps}
    ${initializeCode}
    ${onStartCode}
    ${onLoadCode}
    `;

    // Generate on_finish code using the modular generator
    const onFinishCode = generateOnFinishCode({
      branches,
      branchConditions,
      repeatConditions,
      isInLoop,
      isMergePoint,
      getVarName,
      customOnFinish,
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
