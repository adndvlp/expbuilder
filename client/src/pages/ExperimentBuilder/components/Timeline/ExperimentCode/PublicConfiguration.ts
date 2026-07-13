import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { CanvasStyles } from "../../ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import ExperimentBase from "./ExperimentBase";
import useDevMode from "../../../hooks/useDevMode";
import { auth } from "../../../../../lib/firebase";
import { buildPublicExperimentCode } from "./services/buildPublicExperimentCode";
import { SessionNameToken } from "./services/localCodeTypes";

/* v8 ignore start -- import-time env fallbacks cannot be toggled after this module is loaded in Vitest. */
const API_URL = import.meta.env.VITE_API_URL ?? "";
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;
const FIREBASE_DATABASE_URL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`;
/* v8 ignore stop */

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
  experimentName: string;
  storage: string | undefined;
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  canvasStyles?: CanvasStyles;
};

export default function PublicConfiguration({
  experimentID,
  evaluateCondition,
  fetchExtensions,
  branchingEvaluation,
  uploadedFiles,
  storage,
  getTrial,
  getLoopTimeline,
  getLoop,
  canvasStyles,
}: Props) {
  const { isDevMode, code, customInitJsPsychParams, customPreInitCode } =
    useDevMode();
  const publicParams = customInitJsPsychParams.public;
  const { generatedBaseCode } = ExperimentBase({
    experimentID,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
    canvasStyles,
  });

  const progressBar = canvasStyles?.progressBar ?? false;

  const generateExperiment = async (storageOverride?: string) => {
    const useStorage = storageOverride || storage;

    // Cargar configuración de batching desde Firestore
    let batchConfig = {
      useIndexedDB: true,
      batchSize: 0,
      resumeTimeoutMinutes: 30,
    };

    let recruitmentConfig = {
      platform: "none" as "none" | "prolific" | "mturk",
      prolificCompletionCode: "",
    };

    let captchaConfig = {
      enabled: false,
      provider: "hcaptcha" as "hcaptcha" | "recaptcha",
      siteKey: "",
    };

    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("../../../../../lib/firebase");

      if (experimentID) {
        const docRef = doc(db, "experiments", experimentID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.batchConfig) {
            batchConfig = {
              useIndexedDB: data.batchConfig.useIndexedDB ?? true,
              batchSize: data.batchConfig.batchSize ?? 0,
              resumeTimeoutMinutes: data.batchConfig.resumeTimeoutMinutes ?? 30,
            };
          }
          if (data.recruitmentConfig) {
            recruitmentConfig = {
              platform: data.recruitmentConfig.platform ?? "none",
              prolificCompletionCode:
                data.recruitmentConfig.prolificCompletionCode ?? "",
            };
          }
          if (data.captchaConfig) {
            captchaConfig = {
              enabled: data.captchaConfig.enabled ?? false,
              provider: data.captchaConfig.provider ?? "hcaptcha",
              siteKey: data.captchaConfig.siteKey ?? "",
            };
          }
        }
      }
    } catch (error) {
      console.error("Error loading batch config:", error);
      // Continuar con valores por defecto
    }

    // Fetch session name config from local API (baked in at code-generation time)
    let sessionNameTokens: SessionNameToken[] = [];
    let sessionNameSeparator = "_";
    if (experimentID) {
      try {
        const snRes = await fetch(
          `${API_URL}/api/session-name-config/${experimentID}`,
        );
        if (snRes.ok) {
          const sn = await snRes.json();
          sessionNameTokens = sn.tokens ?? [];
          sessionNameSeparator = sn.separator ?? "_";
        }
      } catch {
        // local server unavailable — fall back to UUID
      }
    }

    // Fetch extensions before generating experiment
    const extensions = await fetchExtensions();
    // Generate codes dynamically from trial/loop data
    const baseCode = isDevMode ? code : await generatedBaseCode();

    const currentUid = auth.currentUser?.uid ?? "";

    return buildPublicExperimentCode({
      DATA_API_URL,
      FIREBASE_DATABASE_URL,
      experimentID,
      useStorage,
      batchConfig,
      recruitmentConfig,
      captchaConfig,
      sessionNameTokens,
      sessionNameSeparator,
      currentUid,
      evaluateCondition,
      branchingEvaluation,
      customPreInitCode,
      publicParams,
      extensions,
      progressBar,
      baseCode,
    });
  };
  return { generateExperiment };
}
