import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import ExperimentBase from "./ExperimentBase";
import useDevMode from "../../../hooks/useDevMode";
import { CanvasStyles } from "../../ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import { buildLocalExperimentCode } from "./services/buildLocalExperimentCode";
import { SessionNameToken } from "./services/localCodeTypes";

export const resolveApiUrl = (value: string | undefined) => value ?? "";
const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL);

type GetTrialFn = (id: string | number) => Promise<Trial | null>;
type GetLoopTimelineFn = (
  loopId: string | number,
  updateState?: boolean,
) => Promise<TimelineItem[]>;
type GetLoopFn = (id: string | number) => Promise<Loop | null>;

type Props = {
  experimentID: string | undefined;
  evaluateCondition: string;
  fetchExtensions: () => Promise<string>;
  branchingEvaluation: string;
  uploadedFiles: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  canvasStyles?: CanvasStyles;
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
  canvasStyles,
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
    canvasStyles,
  });
  const progressBar = canvasStyles?.progressBar ?? false;

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
