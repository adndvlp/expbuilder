import type { ManagedMediaAPI } from "../../../client/src/pages/ExperimentBuilder/modules/experiment-runtime/managedMediaTypes";

export const getMediaOwnership = (jsPsych: { pluginAPI: unknown }) =>
  (jsPsych.pluginAPI as { expBuilderMedia?: ManagedMediaAPI }).expBuilderMedia;
