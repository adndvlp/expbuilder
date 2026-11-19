import { UploadedFile } from "./useExperimentCode";
import { ExperimentAppearance } from "../../../appearance";
import ExperimentBase from "./ExperimentBase";
import useDevMode from "../../../hooks/useDevMode";
import { auth } from "../../../../../lib/firebase";
import {
  getActiveFirebaseConfig,
  getBackendProjectId,
} from "../../../../../lib/oauthConfig";
import { buildPublicExperimentCode } from "./services/buildPublicExperimentCode";
import { resolvePublicDataApiUrl } from "./services/resolvePublicDataApiUrl";
import { resolvePublicFirebaseConfig } from "./services/resolvePublicFirebaseConfig";
import { SessionNameToken } from "./services/localCodeTypes";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";
import type {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
} from "../../../utils/codegen/types";

/* v8 ignore start -- import-time env fallbacks cannot be toggled after this module is loaded in Vitest. */
const API_URL = getApiBaseUrl() ?? "";
const DATA_API_URL = import.meta.env.VITE_DATA_API_URL;
const FIREBASE_DATABASE_URL =
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseio.com`;
/* v8 ignore stop */

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
  appearance?: ExperimentAppearance;
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
  appearance,
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
    appearance,
  });

  const progressBar = appearance?.progressBar ?? false;

  const generateExperiment = async (storageOverride?: string) => {
    const useStorage = storageOverride || storage;

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

    const currentUid = auth?.currentUser?.uid ?? "";

    // Bake the ACTIVE backend's data URL (not the build env's): members on
    // other backends — or builds missing the env var — would otherwise ship
    // pages that POST sessions to the wrong place (or GitHub Pages itself).
    // Keyed on the build (import.meta.env.DEV), NOT the experiment's dev-mode
    // flag: dev-server flows must keep the emulator URL.
    const dataApiUrl = await resolvePublicDataApiUrl({
      dev: import.meta.env.DEV,
      bakedUrl: DATA_API_URL,
      getBackendProjectId,
    });

    // Same rule for Firebase credentials: the active backend wins so member
    // machines without build env still ship working pages.
    const activeFirebase = await getActiveFirebaseConfig().catch(() => null);
    const firebaseWebConfig = resolvePublicFirebaseConfig(
      {
        VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        VITE_FIREBASE_DATABASE_URL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        VITE_FIREBASE_STORAGE_BUCKET:
          import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        VITE_FIREBASE_MESSAGING_SENDER_ID:
          import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
      },
      activeFirebase,
    );

    return buildPublicExperimentCode({
      DATA_API_URL: dataApiUrl,
      FIREBASE_DATABASE_URL,
      firebaseWebConfig,
      experimentID,
      useStorage,
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
