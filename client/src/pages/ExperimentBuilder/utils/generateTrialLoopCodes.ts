/**
 * @fileoverview Utility to generate trial and loop codes dynamically
 * This avoids storing generated code in the database - code is generated on-demand
 */

import { useTrialCode } from "../components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode";
import useLoopCode from "../components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { Trial, Loop } from "../components/ConfigurationPanel/types";
import type { TimelineItem } from "../contexts/TrialsContext";

type GetTrialFn = (id: string | number) => Promise<Trial | null>;
type GetLoopTimelineFn = (loopId: string | number) => Promise<TimelineItem[]>;
type GetLoopFn = (id: string | number) => Promise<Loop | null>;

/**
 * Generates JavaScript code for all trials and loops in a timeline
 * @param experimentID - The experiment ID
 * @param uploadedFiles - Files uploaded to the timeline (for URL mapping)
 * @param getTrial - Function to fetch trial data
 * @param getLoopTimeline - Function to fetch loop timeline
 * @returns Array of generated JavaScript code strings
 */
export async function generateAllCodes(
  experimentID: string,
  uploadedFiles: UploadedFile[] = [],
  getTrial: GetTrialFn,
  getLoopTimeline: GetLoopTimelineFn,
  getLoop: GetLoopFn,
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
        const result = await generateTrialCode(
          item as unknown as Trial,
          uploadedFiles,
          experimentID,
          getTrial,
        );
        if (result.code) codes.push(result.code);
      } else if (item.type === "loop") {
        // It's a loop
        const code = await generateLoopCode(
          item as unknown as Loop,
          experimentID,
          uploadedFiles,
          getTrial,
          getLoopTimeline,
          getLoop,
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
  getTrial: GetTrialFn,
  isInLoop: boolean = false,
): Promise<string> {
  try {
    // Fetch full trial data using getTrial
    const fullTrial = await getTrial(trial.id);

    if (!fullTrial) {
      console.error(`Failed to fetch trial ${trial.id}`);
      return "";
    }

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
      csvJson: fullTrial.csvJson || [],
      trialName: fullTrial.name,
      data,
      includesExtensions: fullTrial.parameters?.includesExtensions || false,
      extensions: fullTrial.parameters?.extensionType || "",
      orders: fullTrial.orders || false,
      stimuliOrders: fullTrial.stimuliOrders || [],
      categories: fullTrial.categories || false,
      categoryData: fullTrial.categoryData || [],
      isInLoop: isInLoop,
      parentLoopId: fullTrial.parentLoopId || null,
    });

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

/**
 * Generates code for a single loop
 */
async function generateLoopCode(
  loop: Loop,
  experimentID: string,
  uploadedFiles: UploadedFile[] = [],
  getTrial: GetTrialFn,
  getLoopTimeline: GetLoopTimelineFn,
  getLoop: GetLoopFn,
): Promise<string> {
  try {
    // Fetch full loop data (including loopConditions and isConditionalLoop)
    const fullLoop = await getLoop(loop.id);

    if (!fullLoop) {
      console.error(`Failed to fetch loop ${loop.id}`);
      return "";
    }

    // Fetch trials metadata within the loop using getLoopTimeline
    const trialsMetadata = await getLoopTimeline(loop.id);

    // Generate code for each trial/loop in the loop
    const trialsWithCode = await Promise.all(
      trialsMetadata.map(async (item) => {
        if (item.type === "trial") {
          // Fetch full trial data using getTrial
          const fullTrial = await getTrial(item.id);

          if (!fullTrial) {
            console.error(`Failed to fetch trial ${item.id}`);
            return {
              trialName: item.name,
              pluginName: "",
              timelineProps: "",
              mappedJson: [],
            };
          }

          // Generate trial code with isInLoop = true
          const trialResult = await generateTrialCode(
            fullTrial,
            uploadedFiles,
            experimentID,
            getTrial,
            true, // isInLoop = true
          );

          return {
            trialName: fullTrial.name,
            pluginName: fullTrial.plugin,
            timelineProps: trialResult.code,
            mappedJson: trialResult.mappedJson,
          };
        } else if (item.type === "loop") {
          // Recursively generate nested loop code
          console.log(
            `🔁 [GENERATE LOOP] Generating nested loop code for:`,
            item.id,
          );

          // Fetch full loop data using getLoop
          const fullNestedLoop = await getLoop(item.id);

          if (!fullNestedLoop) {
            console.error(
              `🔁 [GENERATE LOOP] Failed to fetch nested loop ${item.id}`,
            );
            return {
              ...item,
              timelineProps: "",
              isLoop: true,
            };
          }

          const nestedLoopCode = await generateLoopCode(
            fullNestedLoop,
            experimentID,
            uploadedFiles,
            getTrial,
            getLoopTimeline,
            getLoop,
          );

          console.log(
            `🔁 [GENERATE LOOP] Nested loop code generated, length:`,
            nestedLoopCode?.length || 0,
          );

          return {
            ...item,
            timelineProps: nestedLoopCode,
            isLoop: true,
          };
        }
        return item;
      }),
    );

    // Combine all mappedJson from trials to create unifiedStimuli
    // Each row in unifiedStimuli should contain ALL properties from ALL trials
    const maxRows = Math.max(
      ...trialsWithCode
        .filter((t) => t.mappedJson && Array.isArray(t.mappedJson))
        .map((t) => t.mappedJson.length),
      0,
    );

    const unifiedStimuli = [];
    for (let i = 0; i < maxRows; i++) {
      const row: Record<string, any> = {};

      trialsWithCode.forEach((trial) => {
        if (
          trial.mappedJson &&
          Array.isArray(trial.mappedJson) &&
          trial.mappedJson[i]
        ) {
          // Merge all properties from this trial's mappedJson[i] into the row
          Object.assign(row, trial.mappedJson[i]);
        }
      });

      unifiedStimuli.push(row);
    }

    console.log("🔍 [ANALYSIS] Loop:", fullLoop.id);
    console.log(
      "🔍 [ANALYSIS] Combined unifiedStimuli from trials:",
      unifiedStimuli,
    );
    console.log("🔍 [ANALYSIS] trialsWithCode.length:", trialsWithCode?.length);

    // Validar que trialsWithCode no esté vacío
    if (!trialsWithCode || trialsWithCode.length === 0) {
      console.error("ERROR: trialsWithCode is empty or undefined!");
      return "";
    }

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
      trials: trialsWithCode as unknown as any,
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
  getTrial: GetTrialFn,
): Promise<string> {
  const result = await generateTrialCode(
    trial,
    uploadedFiles,
    experimentID,
    getTrial,
  );
  return result.code;
}

export async function generateSingleLoopCode(
  loop: Loop,
  experimentID: string,
  uploadedFiles: UploadedFile[],
  getTrial: GetTrialFn,
  getLoopTimeline: GetLoopTimelineFn,
  getLoop: GetLoopFn,
): Promise<string> {
  return generateLoopCode(
    loop,
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
  );
}
