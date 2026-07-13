import {
  CustomInitJsPsychParams,
  CustomPreInitCode,
} from "../../../../contexts/DevModeContext";
import { SessionNameToken } from "./localCodeTypes";

export type PublicExperimentCodeOptions = {
  DATA_API_URL: string | undefined;
  FIREBASE_DATABASE_URL: string;
  experimentID: string | undefined;
  useStorage: string | undefined;
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
  sessionNameTokens: SessionNameToken[];
  sessionNameSeparator: string;
  currentUid: string;
  evaluateCondition: string;
  branchingEvaluation: string;
  customPreInitCode: CustomPreInitCode;
  publicParams: CustomInitJsPsychParams["public"];
  extensions: string;
  progressBar: boolean;
  baseCode: string;
};
