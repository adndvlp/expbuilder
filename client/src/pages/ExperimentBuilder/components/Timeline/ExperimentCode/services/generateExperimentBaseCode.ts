import { runtimeResources } from "../../../../modules/experiment-workspace/runtimeResources";
import { projectExecutionGraph } from "../../../../../../../../shared/experiment-workspace/dist/projection.js";
import { executionRevision } from "../../../../../../../../shared/experiment-workspace/dist/executionRevision.js";
import type { ExperimentAppearance } from "../../../../appearance";
import { loadExperimentGraph } from "../../../../modules/experiment-graph/api";
import { generateExecutionAddressManifestCode } from "../../../../modules/experiment-runtime/executionAddressManifest";
import type {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
  UploadedFile,
} from "../../../../utils/codegen/types";

export type ExperimentBaseCodeOptions = {
  experimentID: string;
  uploadedFiles?: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  appearance?: ExperimentAppearance;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function generateExperimentBaseCode({
  experimentID,
  uploadedFiles = [],
  getTrial,
  getLoopTimeline,
  getLoop,
  appearance,
  apiBaseUrl,
  fetchImpl,
}: ExperimentBaseCodeOptions) {
  let graph = await loadExperimentGraph(experimentID, {
    apiBaseUrl,
    fetchImpl,
  });
  if (graph.workspace?.workspaceSchemaVersion === 2) {
    graph = projectExecutionGraph(graph);
    graph = {
      ...graph,
      revision: await executionRevision(graph.workspace!, [
        ...uploadedFiles,
        runtimeResources,
      ]),
    };
  }
  const { generateAllCodes } = await import(
    "../../../../utils/generateTrialLoopCodes"
  );
  const codes = await generateAllCodes(
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
    { apiBaseUrl, fetchImpl, graph, throwOnError: true },
  );
  return [
    generateExecutionAddressManifestCode(graph),
    renderExperimentBaseCode(codes, uploadedFiles, appearance),
  ].join("\n");
}

export function renderExperimentBaseCode(
  codes: string[],
  uploadedFiles: UploadedFile[] = [],
  appearance?: ExperimentAppearance,
) {
  const fullScreen = appearance?.fullScreen ?? true;
  const getMediaUrls = (type: "img" | "aud" | "vid") =>
    uploadedFiles.flatMap((file) =>
      file?.type === type && file.url ? [file.url] : [],
    );
  const images = getMediaUrls("img");
  const audio = getMediaUrls("aud");
  const video = getMediaUrls("vid");
  const hasMedia = images.length > 0 || audio.length > 0 || video.length > 0;

  return `const timeline = [];
${
  hasMedia
    ? `
    const globalPreload = {
      type: jsPsychPreload,
      images: ${JSON.stringify(images)},
      audio: ${JSON.stringify(audio)},
      video: ${JSON.stringify(video)}
    };
    timeline.push(globalPreload);`
    : ""
}
${
  fullScreen
    ? `
    timeline.push({
      type: jsPsychFullscreen,
      fullscreen_mode: true,
      conditional_function: function() { return !document.fullscreenElement; }
    });`
    : ""
}

${codes.join("\n\n")}

    window.ExpBuilderNavigation?.attach(jsPsych, timeline);
    jsPsych.run(timeline);
`;
}
