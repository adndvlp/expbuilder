import type { LocalExperimentCodeOptions } from "./localCodeTypes";
import {
  buildLocalDataCallback,
  buildLocalFinishCallback,
} from "./localRuntimeCallbacks";
import { buildLocalExtraOptions } from "./localRuntimeOptions";
import { buildLocalRuntimeStart } from "./localRuntimeStart";

export function buildLocalRuntime(options: LocalExperimentCodeOptions): string {
  const { baseCode, extensions, localParams, progressBar } = options;
  return `${buildLocalRuntimeStart(options)}
    const jsPsych = initJsPsych({
      ${progressBar ? "show_progress_bar: true," : ""}
      ${extensions}
      ${localParams.on_trial_start?.trim() ? `on_trial_start: function(trial) {
        // --- User code (on_trial_start) ---
        ${localParams.on_trial_start.trim()}
      },` : ""}
      ${buildLocalDataCallback(options)}
      ${buildLocalFinishCallback(options)}${buildLocalExtraOptions(options)}
    });
    // __INIT_JSPSYCH_END__

${baseCode}

  })().catch(function(error) {
    console.error('[session-persistence] experiment startup blocked', {
      experimentID: window.JSPSYCH_EXPERIMENT_ID,
      sessionId: window.JSPSYCH_SESSION_ID || null,
      error: error.message
    });
    _setLoadingMsg('Could not start safely. Check the local server connection.');
  });
`;
}
