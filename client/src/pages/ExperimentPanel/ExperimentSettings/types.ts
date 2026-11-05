import type { SettingsSections } from "../../../lib/functionalSettings";

export type StatusMessage = {
  type: "success" | "error";
  text: string;
};

export type BatchConfig = SettingsSections["batchConfig"];

export type RecruitmentPlatform = "none" | "prolific" | "mturk";

export type RecruitmentConfig = SettingsSections["recruitmentConfig"];

export type CaptchaProvider = "hcaptcha" | "recaptcha";

export type CaptchaConfig = SettingsSections["captchaConfig"];

export type SessionNameTokenType =
  | "date"
  | "time"
  | "randomAlpha"
  | "customText"
  | "counter";

export type SessionNameToken = {
  id: string;
  type: SessionNameTokenType;
  dateFormat: string;
  timeFormat: string;
  randomLength: number;
  customValue: string;
  counterDigits: number;
};

export type SessionTokenMetadata = {
  type: SessionNameTokenType;
  label: string;
  color: string;
};
