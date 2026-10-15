import { getRuntimeGuardSource } from "../../runtime/runtimeGuard.js";
import { resolveExperimentAppearance } from "./appearanceSettings.js";

export function applyBackgroundStyle($, experiment) {
  $("style#experiment-appearance, style#canvas-styles").remove();
  const { backgroundColor } = resolveExperimentAppearance(experiment);
  $("head").append(
    `<style id="experiment-appearance">
  body { background-color: ${backgroundColor}; }
  .jspsych-display-element:not(body) { background-color: transparent; }
</style>`,
  );
}

export function applyGeneratedArtifact(
  $,
  generatedCode,
  experiment,
  options = {},
) {
  $("script#expbuilder-runtime-guard").remove();
  $("script#generated-script").remove();
  if (options.requiresDynamicPlugin === false) {
    $('script[src*="dynamicplugin"]').remove();
  }
  applyBackgroundStyle($, experiment);
  $("body").append(
    `<script id="expbuilder-runtime-guard">\n${getRuntimeGuardSource()}\n</script>`,
  );
  $("body").append(
    `<script id="generated-script">\n${generatedCode}\n</script>`,
  );
}
