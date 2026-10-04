import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const encodeVideo = promisify(execFile);

export async function createResponsiveVideo(): Promise<string> {
  if (!ffmpegPath) throw new Error("FFmpeg is required for the video test");
  const directory = await mkdtemp(join(tmpdir(), "expbuilder-runtime-video-"));
  try {
    const videoPath = join(directory, "responsive-video.webm");
    await encodeVideo(
      ffmpegPath,
      [
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=32x32:r=10",
        "-t",
        "12",
        "-an",
        "-c:v",
        "libvpx",
        "-f",
        "webm",
        videoPath,
      ],
      { timeout: 30_000 },
    );
    const bytes = await readFile(videoPath);
    return `data:video/webm;base64,${bytes.toString("base64")}`;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
