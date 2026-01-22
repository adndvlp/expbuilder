/**
 * @fileoverview Utility to generate trial and loop codes dynamically
 * This avoids storing generated code in the database - code is generated on-demand
 */

import { useTrialCode } from "../components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode";
import useLoopCode from "../components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { Trial, Loop } from "../components/ConfigurationPanel/types";
import type { TimelineItem } from "../contexts/TrialsContext";

/**
 * Generates JavaScript code for all trials and loops in a timeline
 * @param experimentID - The experiment ID
 * @param uploadedFiles - Files uploaded to the timeline (for URL mapping)
 * @returns Array of generated JavaScript code strings
 */
export async function generateAllCodes(
  experimentID: string,
  uploadedFiles: UploadedFile[] = [],
): Promise<string[]> {
  try {
    // Fetch timeline metadata
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/trials-metadata/${experimentID}`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch timeline metadata");
    }

    const data = await response.json();
    const timeline: TimelineItem[] = data.timeline || [];

    const codes: string[] = [];

    for (const item of timeline) {
      if (item.type === "trial") {
        // It's a trial
        const code = await generateTrialCode(
          item as unknown as Trial,
          uploadedFiles,
          experimentID,
        );
        if (code) codes.push(code);
      } else if (item.type === "loop") {
        // It's a loop
        const code = await generateLoopCode(
          item as unknown as Loop,
          experimentID,
        );
        if (code) codes.push(code);
      }
    }

    return codes;
  } catch (error) {
    console.error("Error generating codes:", error);
    return [];
  }
}

type UploadedFile = {
  url?: string;
  name?: string;
  type?: string;
};

/**
 * Generates code for a single trial
 */
async function generateTrialCode(
  trial: Trial,
  uploadedFiles: UploadedFile[],
  experimentID: string,
): Promise<string> {
  try {
    // Fetch full trial data if needed
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/trial/${experimentID}/${trial.id}`,
    );

    if (!response.ok) {
      console.error(`Failed to fetch trial ${trial.id}`);
      return "";
    }

    const responseData = await response.json();
    const fullTrial: Trial = responseData.trial || responseData;

    if (!fullTrial.plugin) {
      console.error(`Trial ${trial.id} has no plugin`);
      return "";
    }

    // Load plugin parameters directly without hook
    const { loadPluginParameters } = await import(
      "../components/ConfigurationPanel/utils/pluginParameterLoader"
    );

    const { parameters, data } = await loadPluginParameters(fullTrial.plugin);

    // Create getColumnValue function without hook
    const getDefaultValueForKey = (key: string) => {
      const field = parameters.find((f) => f.key === key);
      return field && "default" in field ? field.default : "";
    };

    const getColumnValue = (
      mapping: Record<string, unknown> | undefined,
      row?: Record<string, unknown>,
      defaultValue?: unknown,
      key?: string,
    ) => {
      if (!mapping || mapping.source === "none") {
        return defaultValue ?? (key ? getDefaultValueForKey(key) : "");
      }

      if (mapping.source === "typed") {
        return mapping.value ?? (key ? getDefaultValueForKey(key) : "");
      }

      if (mapping.source === "csv" && row && key) {
        const columnKey = mapping.value;
        if (typeof columnKey === "string" || typeof columnKey === "number") {
          const rawValue = row[columnKey];
          const param = parameters.find((p) => p.key === key);

          if (!param) return rawValue;

          // Handle numeric types
          if (param.type && /int|number/i.test(String(param.type))) {
            const parsed = parseInt(String(rawValue));
            return isNaN(parsed) ? 0 : parsed;
          }
          if (param.type && /float|decimal/i.test(String(param.type))) {
            const parsed = parseFloat(String(rawValue));
            return isNaN(parsed) ? 0 : parsed;
          }
          if (param.type && /bool/i.test(String(param.type))) {
            if (typeof rawValue === "boolean") return rawValue;
            const str = String(rawValue).toLowerCase();
            return str === "true" || str === "1";
          }
          return rawValue;
        }
      }

      return key ? getDefaultValueForKey(key) : "";
    };

    // Generate code using useTrialCode (which is actually just a function, not a React hook)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { genTrialCode } = useTrialCode({
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
      csvJson: fullTrial.csvJson || [],
      trialName: fullTrial.name,
      data,
      includesExtensions: fullTrial.parameters?.includesExtensions || false,
      extensions: fullTrial.parameters?.extensionType || "",
      orders: fullTrial.orders || false,
      stimuliOrders: fullTrial.stimuliOrders || [],
      categories: fullTrial.categories || false,
      categoryData: fullTrial.categoryData || [],
      isInLoop: false,
      parentLoopId: fullTrial.parentLoopId || null,
    });

    return genTrialCode();
  } catch (error) {
    console.error(`Error generating code for trial ${trial.id}:`, error);
    return "";
  }
}

/**
 * Generates code for a single loop
 */
async function generateLoopCode(
  loop: Loop,
  experimentID: string,
): Promise<string> {
  try {
    // Fetch full loop data
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/loop/${experimentID}/${loop.id}`,
    );

    if (!response.ok) {
      console.error(`Failed to fetch loop ${loop.id}`);
      return "";
    }

    const responseData = await response.json();
    const fullLoop: Loop = responseData.loop || responseData;

    // Fetch trials metadata within the loop
    const trialsResponse = await fetch(
      `${import.meta.env.VITE_API_URL}/api/loop-trials-metadata/${experimentID}/${loop.id}`,
    );

    let trialsMetadata: TimelineItem[] = [];
    if (trialsResponse.ok) {
      const trialsData = await trialsResponse.json();
      trialsMetadata = trialsData.trialsMetadata || [];
    }

    // Generate unified stimuli for the loop
    const unifiedStimuli =
      fullLoop.csvJson && fullLoop.csvJson.length > 0 ? fullLoop.csvJson : [];

    // Generate code using useLoopCode (which is actually just a function, not a React hook)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const genLoopCode = useLoopCode({
      id: fullLoop.id,
      branches: fullLoop.branches,
      branchConditions: fullLoop.branchConditions as unknown as any,
      repeatConditions: fullLoop.repeatConditions as unknown as any,
      repetitions: fullLoop.repetitions,
      randomize: fullLoop.randomize,
      orders: fullLoop.orders || false,
      stimuliOrders: fullLoop.stimuliOrders || [],
      categories: fullLoop.categories || false,
      categoryData: fullLoop.categoryData || [],
      trials: trialsMetadata as unknown as any,
      unifiedStimuli,
      loopConditions: fullLoop.loopConditions as unknown as any,
      isConditionalLoop: fullLoop.isConditionalLoop,
      parentLoopId: null,
    });

    return genLoopCode();
  } catch (error) {
    console.error(`Error generating code for loop ${loop.id}:`, error);
    return "";
  }
}

/**
 * Exported functions for generating single trial/loop codes (used in ExperimentPreview)
 */
export async function generateSingleTrialCode(
  trial: Trial,
  uploadedFiles: UploadedFile[],
  experimentID: string,
): Promise<string> {
  return generateTrialCode(trial, uploadedFiles, experimentID);
}

export async function generateSingleLoopCode(
  loop: Loop,
  experimentID: string,
): Promise<string> {
  return generateLoopCode(loop, experimentID);
}
