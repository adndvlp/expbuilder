export type StatusMessage = {
  type: "success" | "error";
  text: string;
};

export type BatchConfig = {
  useIndexedDB: boolean;
  batchSize: number;
  resumeTimeoutMinutes: number;
};

export type RecruitmentPlatform = "none" | "prolific" | "mturk";

export type RecruitmentConfig = {
  platform: RecruitmentPlatform;
  prolificCompletionCode: string;
};

export type CaptchaProvider = "hcaptcha" | "recaptcha";

export type CaptchaConfig = {
  enabled: boolean;
  provider: CaptchaProvider;
  siteKey: string;
};

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
