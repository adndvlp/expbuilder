import { useEffect, useState } from "react";
import {
  fetchExperimentNameByID,
  useExperimentID,
} from "../../../hooks/useExperimentID";
import useCanvasStyles from "../../../hooks/useCanvasStyles";
import useTrials from "../../../hooks/useTrials";
import type { UploadedFile } from "../../../utils/codegen/types";
import ExperimentBase from "./ExperimentBase";
import LocalConfiguration from "./LocalConfiguration";
import PublicConfiguration from "./PublicConfiguration";
import {
  branchingEvaluationRuntimeCode,
  evaluateConditionRuntimeCode,
} from "./services/branchingRuntimeCode";

export type { UploadedFile } from "../../../utils/codegen/types";

export function useExperimentCode(uploadedFiles: UploadedFile[] = []) {
  const [experimentName, setExperimentName] = useState("Experiment");
  const experimentID = useExperimentID();

  useEffect(() => {
    if (experimentID) {
      fetchExperimentNameByID(experimentID).then(setExperimentName);
    }
  }, [experimentID]);

  const fetchExtensions = async (): Promise<string> => {
    if (!experimentID) return "";
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/trials-extensions/${experimentID}`,
      );
      const data = (await response.json()) as { extensions?: string[] };
      const extensions = data.extensions ?? [];
      return extensions.length
        ? `extensions: [${extensions.map((type) => `{ type: ${type} }`).join(", ")}],`
        : "";
    } catch (error) {
      console.error("Error loading extensions:", error);
      return "";
    }
  };

  const { getTrial, getLoopTimeline, getLoop } = useTrials();
  const { canvasStyles } = useCanvasStyles();
  const shared = {
    experimentID,
    evaluateCondition: evaluateConditionRuntimeCode,
    fetchExtensions,
    branchingEvaluation: branchingEvaluationRuntimeCode,
    uploadedFiles,
    getTrial,
    getLoopTimeline,
    getLoop,
    canvasStyles,
  };

  const { generateLocalExperiment } = LocalConfiguration(shared);
  const { generateExperiment } = PublicConfiguration({
    ...shared,
    experimentName,
    storage: undefined,
  });
  const { generatedBaseCode } = ExperimentBase(shared);

  return { generateLocalExperiment, generateExperiment, generatedBaseCode };
}
