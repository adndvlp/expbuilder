import { UploadedFile } from "./useExperimentCode";
import ExperimentBase from "./ExperimentBase";
import useDevMode from "../../../hooks/useDevMode";
import { ExperimentAppearance } from "../../../appearance";
import { buildLocalExperimentCode } from "./services/buildLocalExperimentCode";
import { SessionNameToken } from "./services/localCodeTypes";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";
import type {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
} from "../../../utils/codegen/types";

export const resolveApiUrl = (value: string | undefined) => value ?? "";
const API_URL = resolveApiUrl(getApiBaseUrl());

type Props = {
  experimentID: string | undefined;
  evaluateCondition: string;
  fetchExtensions: () => Promise<string>;
  branchingEvaluation: string;
  uploadedFiles: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  appearance?: ExperimentAppearance;
};

export default function LocalConfiguration({
  experimentID,
  evaluateCondition,
  fetchExtensions,
  branchingEvaluation,
  uploadedFiles,
  getTrial,
  getLoopTimeline,
  getLoop,
  appearance,
}: Props) {
  const {
    isDevMode,
    code,
    customCode,
    customInitJsPsychParams,
    customPreInitCode,
  } = useDevMode();
  const localParams = customInitJsPsychParams.local;
  const { generatedBaseCode } = ExperimentBase({
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
    appearance,
  });
  const progressBar = appearance?.progressBar ?? false;

  const generateLocalExperiment = async () => {
    // Fetch extensions before generating experiment
    const extensions = await fetchExtensions();
    // Generate codes dynamically from trial/loop data
    const baseCode = isDevMode ? code : await generatedBaseCode();

    // Fetch session name config from local API
    let sessionNameTokens: SessionNameToken[] = [];
    let sessionNameSeparator = "_";
    try {
      const snRes = await (experimentID
        ? fetch(`${API_URL}/api/session-name-config/${experimentID}`)
        : Promise.resolve(null));
      if (snRes?.ok) {
        const sn = await snRes.json();
        sessionNameTokens = sn.tokens ?? [];
        sessionNameSeparator = sn.separator ?? "_";
      }
    } catch {
      // local server unavailable — fall back to UUID
    }

    return buildLocalExperimentCode({
      experimentID,
      sessionNameTokens,
      sessionNameSeparator,
      evaluateCondition,
      branchingEvaluation,
      baseCode,
      customCode,
      customPreInitCode,
      extensions,
      localParams,
      progressBar,
    });
  };
  return { generateLocalExperiment };
}
