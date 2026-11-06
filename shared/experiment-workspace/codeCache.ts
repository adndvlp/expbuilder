// New generated caches carry provenance. Keep unmarked stored WebGazer source
// opaque unless its existing structured configuration can regenerate it.
export function isRegenerableTrialCode(trial: {
  plugin?: string;
  trialCodeSource?: string;
  parameters?: Record<string, unknown>;
}) {
  return (
    trial.plugin !== "webgazer" ||
    trial.trialCodeSource === "generated" ||
    (trial.trialCodeSource !== "custom" &&
      trial.parameters?.include_instructions !== undefined)
  );
}
