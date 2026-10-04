import type { ExperimentAppearance } from "../../../../appearance";
import { loadExperimentGraph } from "../../../../modules/experiment-graph/api";
import { generateExecutionAddressManifestCode } from "../../../../modules/experiment-runtime/executionAddressManifest";
import { createStandaloneMediaServices } from "../../../../modules/experiment-runtime/standaloneMediaServices";
import { createMediaPreparation } from "../../../../modules/experiment-runtime/mediaPreparation";
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
  const graph = await loadExperimentGraph(experimentID, {
    apiBaseUrl,
    fetchImpl,
  });
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
  const library = uploadedFiles.filter(
    (file) => file.url && ["img", "aud", "vid"].includes(file.type || ""),
  );

  return `const timeline = [];
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

    const mediaLibrary = ${JSON.stringify(library)};
    window.ExpBuilderMediaPreparation?.dispose();
    window.ExpBuilderMediaPreparation = (${createMediaPreparation.toString()})(
      jsPsych,
      mediaLibrary,
      typeof DynamicPlugin !== 'undefined' && typeof DynamicPlugin.mediaPreparationServices === 'function'
        ? DynamicPlugin.mediaPreparationServices(jsPsych, mediaLibrary)
        : undefined,
      ${createStandaloneMediaServices.toString()}
    );
    window.ExpBuilderMediaPreparation.install(timeline);
    jsPsych.run(timeline);
`;
}
