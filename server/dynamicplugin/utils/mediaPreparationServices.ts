import type {
  MediaPreparationRuntime,
  RuntimeMediaTrial,
  PreparedAssets,
} from "../../../client/src/pages/ExperimentBuilder/modules/experiment-runtime/mediaPreparationTypes";

import { collectStandardAssets, type MediaFile } from "./mediaAssets";
import { prepareMedia, retainHtmlImages } from "./mediaResources";

const libraries = new WeakMap<object, MediaFile[]>();
export const getMediaLibrary = (jsPsych: object) =>
  libraries.get(jsPsych) || [];

export function mediaPreparationServices(
  jsPsych: MediaPreparationRuntime,
  library: MediaFile[],
) {
  libraries.set(jsPsych, library);
  return {
    collect: (trial: RuntimeMediaTrial) => {
      const assets = collectStandardAssets(jsPsych, trial, library);
      return { ...assets, images: assets.htmlImages };
    },
    reserveImages: retainHtmlImages,
    prepareAV: (
      assets: PreparedAssets,
      timeoutMs: number,
      signal?: AbortSignal,
    ) =>
      prepareMedia(
        jsPsych,
        { audio: assets.audio, video: assets.video },
        timeoutMs,
        signal,
      ),
  };
}
