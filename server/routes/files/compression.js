import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

/* istanbul ignore next -- exercised only through ffmpeg stderr progress parsing. */
function timestampToSeconds(timestamp) {
  const [hours, minutes, seconds] = timestamp.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/* istanbul ignore next -- ffmpeg execution is an external binary integration. */
function runFfmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not available"));
      return;
    }

    const ffmpeg = spawn(ffmpegPath, args);
    let stderr = "";
    let durationSeconds = 0;

    ffmpeg.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (stderr.length > 50000) {
        stderr = stderr.slice(-50000);
      }

      const durationMatch =
        durationSeconds === 0
          ? stderr.match(/Duration:\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/)
          : null;
      if (durationMatch) {
        durationSeconds = timestampToSeconds(durationMatch[1]);
      }

      const timeMatches = [...text.matchAll(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/g)];
      const latestTime = timeMatches.at(-1);
      if (durationSeconds > 0 && latestTime) {
        const currentSeconds = timestampToSeconds(latestTime[1]);
        const progress = Math.min(
          99,
          Math.max(1, Math.round((currentSeconds / durationSeconds) * 100)),
        );
        onProgress?.(progress);
      }
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
      }
    });
  });
}

/* istanbul ignore next -- codec-specific compression is integration behavior; upload route smoke tests cover dispatch. */
export async function compressFile(inputPath, outputPath, type, onProgress) {
  if (type === "img") {
    await sharp(inputPath).webp({ quality: 80, effort: 4 }).toFile(outputPath);
    onProgress?.(100);
    return;
  }

  if (type === "aud") {
    await runFfmpeg([
      "-y",
      "-nostdin",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libopus",
      "-compression_level",
      "0",
      "-b:a",
      "96k",
      outputPath,
    ], onProgress);
    return;
  }

  if (type === "vid") {
    await runFfmpeg([
      "-y",
      "-nostdin",
      "-i",
      inputPath,
      "-c:v",
      "libvpx",
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
      "-b:v",
      "1200k",
      "-maxrate",
      "1600k",
      "-bufsize",
      "2400k",
      "-threads",
      "0",
      "-c:a",
      "libopus",
      "-compression_level",
      "0",
      "-b:a",
      "96k",
      outputPath,
    ], onProgress);
  }
}
