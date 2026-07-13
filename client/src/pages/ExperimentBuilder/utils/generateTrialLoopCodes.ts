import { Loop, Trial } from "../components/ConfigurationPanel/types";
import type { TimelineItem } from "../contexts/TrialsContext";
import { getMergePointIds, isMergePoint } from "./branchGraphUtils";
import { generateLoopCode } from "./codegen/generateLoopCode";
import { generateTrialCode } from "./codegen/generateTrialCode";
import {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
  UploadedFile,
} from "./codegen/types";

export {
  getPluginDefaultValue,
  resolveColumnValue,
} from "./codegen/columnValues";
export type { UploadedFile } from "./codegen/types";

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
    const topLevelMergePointIds = getMergePointIds(timeline);

    const codes: string[] = [];

    for (const item of timeline) {
      if (item.type === "trial") {
        // It's a trial
        const result = await generateTrialCode(
          item as unknown as Trial,
          uploadedFiles,
          experimentID,
          getTrial,
          false,
          undefined,
          isMergePoint(topLevelMergePointIds, item.id),
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
          topLevelMergePointIds,
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

export async function generateSingleTrialCode(
  trial: Trial,
  uploadedFiles: UploadedFile[],
  experimentID: string,
  getTrial: GetTrialFn,
  getLoopTimeline?: GetLoopTimelineFn,
  getLoop?: GetLoopFn,
): Promise<string> {
  const fullTrial = await getTrial(trial.id);

  if (!fullTrial) {
    console.error(`Failed to fetch trial ${trial.id}`);
    return "";
  }

  if (fullTrial.parentLoopId && getLoopTimeline && getLoop) {
    const parentLoop = await getLoop(fullTrial.parentLoopId);

    if (parentLoop) {
      return generateLoopCode(
        parentLoop,
        experimentID,
        uploadedFiles,
        getTrial,
        getLoopTimeline,
        getLoop,
      );
    }
  }

  const result = await generateTrialCode(
    fullTrial,
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
