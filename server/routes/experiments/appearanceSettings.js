export function resolveExperimentAppearance(experiment) {
  const saved = experiment.appearanceSettings ?? {};
  return {
    backgroundColor: saved.backgroundColor?.trim() || "#ffffff",
    fullScreen: saved.fullScreen ?? true,
    progressBar: saved.progressBar ?? false,
  };
}
