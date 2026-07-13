import useLoopCode from "../../components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import { Loop } from "../../components/ConfigurationPanel/types";
import { getMergePointIds, isMergePoint } from "../branchGraphUtils";
import { generateTrialCode } from "./generateTrialCode";
import {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
  TrialWithCode,
  UploadedFile,
} from "./types";

export async function generateLoopCode(
  loop: Loop,
  experimentID: string,
  uploadedFiles: UploadedFile[] = [],
  getTrial: GetTrialFn,
  getLoopTimeline: GetLoopTimelineFn,
  getLoop: GetLoopFn,
  parentScopeMergePointIds: Set<string> = new Set(),
): Promise<string> {
  try {
    // Fetch full loop data (including loopConditions and isConditionalLoop)
    const fullLoop = await getLoop(loop.id);

    if (!fullLoop) {
      console.error(`Failed to fetch loop ${loop.id}`);
      return "";
    }

    // Fetch trials metadata within the loop using getLoopTimeline.
    // ARCHITECTURE NOTE: We pass `updateState: false` here because this function is called by
    // ExperimentPreview whenever a loop is selected to generate its code. If we update the global
    // UI state (loopTimeline) here, it would force the Canvas to render this loop's contents,
    // causing an unexpected visual "auto-open" behavior when clicking a nested loop node.
    const trialsMetadata = await getLoopTimeline(loop.id, false);
    const loopMergePointIds = getMergePointIds(trialsMetadata);

    // Generate code for each trial/loop in the loop
    const trialsWithCode = (await Promise.all(
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
            } as TrialWithCode;
          }

          // Generate trial code with isInLoop = true
          const trialResult = await generateTrialCode(
            fullTrial,
            uploadedFiles,
            experimentID,
            getTrial,
            true, // isInLoop = true
            fullLoop?.csvJson,
            isMergePoint(loopMergePointIds, item.id),
          );

          return {
            id: fullTrial.id,
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
            loopMergePointIds,
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
    )) as TrialWithCode[];

    // Combine all mappedJson from trials to create unifiedStimuli
    // Each row in unifiedStimuli should contain ALL properties from ALL trials
    const maxRows = Math.max(
      ...trialsWithCode
        .filter((t) => t.mappedJson && Array.isArray(t.mappedJson))
        .map((t) => t.mappedJson?.length || 0),
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
      parentLoopId: fullLoop.parentLoopId
        ? String(fullLoop.parentLoopId)
        : null,
      mergePointIds: Array.from(loopMergePointIds),
      isMergePoint: isMergePoint(parentScopeMergePointIds, fullLoop.id),
    });

    return genLoopCode();
  } catch (error) {
    console.error(`Error generating code for loop ${loop.id}:`, error);
    return "";
  }
}
