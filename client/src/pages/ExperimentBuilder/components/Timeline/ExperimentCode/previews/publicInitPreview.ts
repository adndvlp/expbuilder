import {
  getPublicOnDataUpdatePreview,
  getPublicOnFinishPreview,
  getPublicOnTrialStartPreview,
} from "./previewHelpers";

export function getPublicInitJsPsychPreview(
  experimentID: string | undefined,
  progressBar: boolean,
): string {
  const eid = experimentID ?? "[experimentID]";
  return `// __INIT_JSPSYCH_START__
const jsPsych = initJsPsych({
  ${progressBar ? "show_progress_bar: true," : "// show_progress_bar: false,"}

  ${getPublicOnTrialStartPreview()}

  // extensions: [...],  // loaded from experiment config

  ${getPublicOnDataUpdatePreview(eid)}

  ${getPublicOnFinishPreview(eid)}
});
// __INIT_JSPSYCH_END__`;
}
