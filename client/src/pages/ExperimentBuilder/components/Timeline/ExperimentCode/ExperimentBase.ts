import { UploadedFile } from "./useExperimentCode";
import { CanvasStyles } from "../../ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";
import type {
  GetLoopFn,
  GetLoopTimelineFn,
  GetTrialFn,
} from "../../../utils/codegen/types";
import { getApiBaseUrl } from "../../../../../lib/apiBaseUrl";
import {
  generateExperimentBaseCode,
  renderExperimentBaseCode,
} from "./services/generateExperimentBaseCode";

const API_URL = getApiBaseUrl();

type Props = {
  experimentID: string | undefined;
  uploadedFiles: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
  canvasStyles?: CanvasStyles;
};

export default function ExperimentBase({
  experimentID,
  uploadedFiles,
  getTrial,
  getLoopTimeline,
  getLoop,
  canvasStyles,
}: Props) {
  const generatedBaseCode = async () => {
    try {
      return await generateExperimentBaseCode({
        experimentID: experimentID || "",
        uploadedFiles,
        getTrial,
        getLoopTimeline,
        getLoop,
        canvasStyles,
        apiBaseUrl: API_URL,
      });
    } catch (error) {
      console.error("Error generating codes:", error);
      return renderExperimentBaseCode([], uploadedFiles, canvasStyles);
    }
  };
  return { generatedBaseCode };
}
