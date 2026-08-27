import { getRuntimeGuardSource } from "../../runtime/runtimeGuard.js";

export function applyBackgroundStyle($, canvasStyles) {
  $("style#canvas-styles").remove();
  if (!canvasStyles?.backgroundColor) return;
  const background = canvasStyles.backgroundColor;
  $("head").append(
    `<style id="canvas-styles">
  body { background-color: ${background}; }
  .jspsych-display-element { background-color: ${background}; }
</style>`,
  );
}

export function applyGeneratedArtifact(
  $,
  generatedCode,
  canvasStyles,
  options = {},
) {
  $("script#expbuilder-runtime-guard").remove();
  $("script#generated-script").remove();
  $("base#experiment-base").remove();
  if (options.requiresDynamicPlugin === false) {
    $('script[src*="dynamicplugin"]').remove();
  }
  applyBackgroundStyle($, canvasStyles);
  if (options.experimentID) {
    $("head").append(
      `<base id="experiment-base" href="/${options.experimentID}/">`,
    );
  }
  $("body").append(
    `<script id="expbuilder-runtime-guard">\n${getRuntimeGuardSource()}\n</script>`,
  );
  $("body").append(
    `<script id="generated-script">\n${generatedCode}\n</script>`,
  );
}
