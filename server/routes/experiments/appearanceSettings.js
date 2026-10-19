export function resolveExperimentAppearance(experiment) {
  const saved = experiment.appearanceSettings ?? {};
  return {
    backgroundColor: saved.backgroundColor?.trim() || "#ffffff",
    fullScreen: saved.fullScreen ?? true,
    progressBar: saved.progressBar ?? false,
  };
}

export function assertNoAppearanceOverride(body) {
  if (Object.hasOwn(body ?? {}, "canvasStyles")) {
    const error = new Error("canvasStyles is not supported; save the experiment appearance settings instead");
    error.status = 400;
    throw error;
  }
}
