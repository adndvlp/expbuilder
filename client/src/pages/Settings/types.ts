export interface Experiment {
  experimentID: string;
  name: string;
}

export type SettingsNotification = {
  type: "success" | "error";
  message: string;
};
