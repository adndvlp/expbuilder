import { UploadedFile } from "./useExperimentCode";
import { Trial, Loop } from "../../ConfigurationPanel/types";
import { TimelineItem } from "../../../contexts/TrialsContext";

type GetTrialFn = (id: string | number) => Promise<Trial | null>;
type GetLoopTimelineFn = (loopId: string | number) => Promise<TimelineItem[]>;
type GetLoopFn = (id: string | number) => Promise<Loop | null>;

type Props = {
  experimentID: string | undefined;
  uploadedFiles: UploadedFile[];
  getTrial: GetTrialFn;
  getLoopTimeline: GetLoopTimelineFn;
  getLoop: GetLoopFn;
};

export default function ExperimentBase({
  experimentID,
  uploadedFiles,
  getTrial,
  getLoopTimeline,
  getLoop,
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

    ${allCodes}

    jsPsych.run(timeline);
    
`;
  };
  return { generatedBaseCode };
}
