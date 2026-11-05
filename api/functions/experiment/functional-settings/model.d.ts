export type SettingsSections = {
  batchConfig: {
    useIndexedDB: boolean;
    batchSize: number;
    resumeTimeoutMinutes: number;
  };
  recruitmentConfig: {
    platform: "none" | "prolific" | "mturk";
    prolificCompletionCode: string;
  };
  captchaConfig: {
    enabled: boolean;
    provider: "hcaptcha" | "recaptcha";
    siteKey: string;
  };
};
export type FunctionalSettings = SettingsSections & {
  schemaVersion: 1;
  revision: number;
};
export class FunctionalSettingsError extends Error {
  code: string;
  status: number;
}
export function defaultFunctionalSettings(
  revision?: number,
): FunctionalSettings;
export function validateSettingsSections(value: unknown): SettingsSections;
export function validateFunctionalSettings(value: unknown): FunctionalSettings;
