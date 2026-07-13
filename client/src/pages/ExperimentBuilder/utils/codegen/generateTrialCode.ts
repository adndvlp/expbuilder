import { useTrialCode } from "../../components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode";
import { Trial } from "../../components/ConfigurationPanel/types";
import { generateExtensionCode } from "../generateExtensionCode";
import { resolveColumnValue } from "./columnValues";
import { GeneratedTrialResult, GetTrialFn, UploadedFile } from "./types";

export async function generateTrialCode(
  trial: Trial,
  uploadedFiles: UploadedFile[],
  _experimentID: string,
  getTrial: GetTrialFn,
  isInLoop: boolean = false,
  loopCsvJson?: Record<string, any>[],
  isMergePointInScope: boolean = false,
): Promise<GeneratedTrialResult> {
  try {
    // Fetch full trial data using getTrial
    const fullTrial = await getTrial(trial.id);

    if (!fullTrial) {
      console.error(`Failed to fetch trial ${trial.id}`);
      return {
        code: "",
        mappedJson: [],
      };
    }

    if (!fullTrial.plugin) {
      console.error(`Trial ${trial.id} has no plugin`);
      return {
        code: "",
        mappedJson: [],
      };
    }

    // WebGazer is complex - use saved code instead of generating it
    // IMPORTANT: Check this BEFORE trying to load plugin parameters
    if (fullTrial.plugin === "webgazer") {
      return {
        code: fullTrial.trialCode || "",
        mappedJson: fullTrial.csvJson || [],
      };
    }

    // Load plugin parameters directly without hook
    const { loadPluginParameters } = await import(
      "../../components/ConfigurationPanel/utils/pluginParameterLoader"
    );

    const { parameters, data } = await loadPluginParameters(fullTrial.plugin);

    // Generate extension code if needed
    const extensionsCode =
      fullTrial.parameters?.includesExtensions &&
      fullTrial.parameters?.extensionType
        ? generateExtensionCode(
            fullTrial.parameters.extensionType,
            fullTrial.plugin,
            parameters,
          )
        : "";

    const getColumnValue = (
      mapping: Record<string, unknown> | undefined,
      row?: Record<string, unknown>,
      defaultValue?: unknown,
      key?: string,
    ) => resolveColumnValue(parameters, mapping, row, defaultValue, key);

    // Determine which CSV data to use
    // If trial is set to use loop CSV and loop CSV is provided, use it
    const effectiveCsvJson =
      fullTrial.csvFromLoop && loopCsvJson && loopCsvJson.length > 0
        ? loopCsvJson
        : fullTrial.csvJson || [];

    // Generate code using useTrialCode (which is actually just a function, not a React hook)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { genTrialCode, mappedJson } = useTrialCode({
      id: fullTrial.id,
      branches: fullTrial.branches,
      branchConditions: fullTrial.branchConditions,
      repeatConditions: fullTrial.repeatConditions,
      paramsOverride: fullTrial.paramsOverride,
      pluginName: fullTrial.plugin,
      parameters,
      getColumnValue,
      columnMapping: fullTrial.columnMapping || {},
      uploadedFiles,
      csvJson: effectiveCsvJson,
      trialName: fullTrial.name,
      data,
      includesExtensions: fullTrial.parameters?.includesExtensions || false,
      extensions: extensionsCode,
      orders: fullTrial.orders || false,
      stimuliOrders: fullTrial.stimuliOrders || [],
      categories: fullTrial.categories || false,
      categoryData: fullTrial.categoryData || [],
      isInLoop: isInLoop,
      isMergePoint: isMergePointInScope,
      parentLoopId: fullTrial.parentLoopId || null,
      customInitialize: fullTrial.customInitialize,
      customOnStart: fullTrial.customOnStart,
      customOnLoad: fullTrial.customOnLoad,
      customOnFinish: fullTrial.customOnFinish,
    });

    console.log(
      "🔍 [generateTrialCode] Trial:",
      fullTrial.name,
      "| ID:",
      fullTrial.id,
    );
    console.log("  orders:", fullTrial.orders);
    console.log("  stimuliOrders:", fullTrial.stimuliOrders);
    console.log("  categories:", fullTrial.categories);
    console.log("  categoryData:", fullTrial.categoryData);
    console.log(
      "🔍 [TRIAL MAPPED JSON] Trial:",
      fullTrial.name,
      "mappedJson:",
      mappedJson,
    );

    // Return both code and mappedJson
    return {
      code: genTrialCode(),
      mappedJson: mappedJson,
    };
  } catch (error) {
    console.error(`Error generating code for trial ${trial.id}:`, error);
    return {
      code: "",
      mappedJson: [],
    };
  }
}
