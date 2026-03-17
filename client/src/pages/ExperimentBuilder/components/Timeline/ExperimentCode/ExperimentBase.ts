import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";
import { CanvasStyles } from "../../ConfigurationPanel/TrialsConfiguration/TrialDesigner/types";

type GetTrialFn = (id: string | number) => Promise<Trial | null>;
type GetLoopTimelineFn = (loopId: string | number) => Promise<TimelineItem[]>;
type GetLoopFn = (id: string | number) => Promise<Loop | null>;

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
    let allCodes = "";
    try {
      const { generateAllCodes } = await import(
        "../../../utils/generateTrialLoopCodes"
      );
      const codes = await generateAllCodes(
        experimentID || "",
        uploadedFiles,
        getTrial,
        getLoopTimeline,
        getLoop,
      );
      allCodes = codes.join("\n\n");
    } catch (error) {
      console.error("Error generating codes:", error);
    }

    const fullScreen = canvasStyles?.fullScreen ?? false;

    return `const timeline = [];

    // Global preload for all uploaded files from Timeline
    ${
      uploadedFiles.length > 0
        ? `
    const globalPreload = {
      type: jsPsychPreload,
      files: ${JSON.stringify(uploadedFiles.filter((f) => f && f.url).map((f) => f.url))}
    };
    timeline.push(globalPreload);
    `
        : ""
    }

    //Full screen
    ${
      fullScreen
        ? `
      timeline.push({
      type: jsPsychFullscreen,
      fullscreen_mode: true
      });`
        : ""
    }

    ${allCodes}

    jsPsych.run(timeline);
    
`;
  };
  return { generatedBaseCode };
}
