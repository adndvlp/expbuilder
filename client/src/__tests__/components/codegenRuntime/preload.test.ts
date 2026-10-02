import { describe, expect, it, vi } from "vitest";
import { renderExperimentBaseCode } from "../../../pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/generateExperimentBaseCode";
import type { UploadedFile } from "../../../pages/ExperimentBuilder/utils/codegen/types";

const preloadPlugin = Symbol("jsPsychPreload");

function runGeneratedExperiment(uploadedFiles: UploadedFile[]) {
  const run = vi.fn<(timeline: unknown[]) => void>();
  const code = renderExperimentBaseCode(
    ['timeline.push({ type: "generated-trial" });'],
    uploadedFiles,
    {
      width: 1024,
      height: 768,
      backgroundColor: "#fff",
      fullScreen: false,
      progressBar: false,
    },
  );

  new Function("jsPsych", "jsPsychPreload", code)({ run }, preloadPlugin);
  expect(run).toHaveBeenCalledOnce();
  return run.mock.calls[0][0];
}

describe("generated media preload", () => {
  it("passes images, audio and video to jsPsych before the generated trials", () => {
    const timeline = runGeneratedExperiment([
      { name: "portrait.png", url: "img/portrait.png", type: "img" },
      { name: "alert.mp3", url: "aud/alert.mp3", type: "aud" },
      { name: "clip.mp4", url: "vid/clip.mp4", type: "vid" },
      { name: "rows.csv", url: "others/rows.csv", type: "others" },
      { name: "missing.png", type: "img" },
      { url: "", type: "aud" },
    ]);

    expect(timeline).toEqual([
      {
        type: preloadPlugin,
        images: ["img/portrait.png"],
        audio: ["aud/alert.mp3"],
        video: ["vid/clip.mp4"],
      },
      { type: "generated-trial" },
    ]);
  });

  it("uses the stored media type and preserves encoded and signed URLs", () => {
    const imageUrl = "img/portrait%20%22one%22.PNG";
    const audioUrl = "https://cdn.test/download?token=abc&file=voice";
    const videoUrl = "vid/clip%20one.webm";
    const timeline = runGeneratedExperiment([
      { name: 'portrait "one".PNG', url: imageUrl, type: "img" },
      { name: "voice", url: audioUrl, type: "aud" },
      { name: "clip one.webm", url: videoUrl, type: "vid" },
    ]);

    expect(timeline[0]).toEqual({
      type: preloadPlugin,
      images: [imageUrl],
      audio: [audioUrl],
      video: [videoUrl],
    });
  });

  it.each<{ name: string; files: UploadedFile[] }>([
    { name: "an empty library", files: [] },
    {
      name: "non-media files",
      files: [{ url: "others/rows.csv", type: "others" }],
    },
    {
      name: "media entries without URLs",
      files: [
        { name: "missing.png", type: "img" },
        { url: "", type: "vid" },
      ],
    },
    {
      name: "entries without a recognized media type",
      files: [
        { url: "others/document.pdf", type: "other" },
        { url: "unknown" },
      ],
    },
  ])("omits the preload for $name", ({ files }) => {
    expect(runGeneratedExperiment(files)).toEqual([
      { type: "generated-trial" },
    ]);
  });
});
