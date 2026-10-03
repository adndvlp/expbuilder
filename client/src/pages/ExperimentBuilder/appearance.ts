export type ExperimentAppearance = {
  backgroundColor: string;
  fullScreen: boolean;
  progressBar: boolean;
};

export const DEFAULT_EXPERIMENT_APPEARANCE: ExperimentAppearance = {
  backgroundColor: "#ffffff",
  fullScreen: true,
  progressBar: false,
};
