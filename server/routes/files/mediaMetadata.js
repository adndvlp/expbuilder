import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

export function parseMediaMetadata(text) {
  const duration = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(text);
  const video = /Video:[^\r\n]*?\b([1-9]\d*)x([1-9]\d*)\b/.exec(text);
  const audio = /Audio:[^\r\n]*?,\s*(\d+) Hz,\s*([^,\r\n]+)/.exec(text);
  const layout = audio?.[2].trim();
  const surround = /^(\d+)\.(\d+)(?:\(|$)/.exec(layout || "");
  const channelCount = /^(\d+) channels?\b/.exec(layout || "");
  const channels =
    layout === "mono"
      ? 1
      : layout === "stereo"
        ? 2
        : channelCount
          ? Number(channelCount[1])
          : surround
            ? Number(surround[1]) + Number(surround[2])
            : undefined;
  return {
    ...(duration && {
      durationSeconds:
        Number(duration[1]) * 3600 +
        Number(duration[2]) * 60 +
        Number(duration[3]),
    }),
    ...(video && { width: Number(video[1]), height: Number(video[2]) }),
    ...(audio && { sampleRate: Number(audio[1]) }),
    ...(channels && { channels }),
  };
}

function inspectStreams(filePath, signal) {
  if (!ffmpegPath)
    return Promise.reject(new Error("Media inspection unavailable"));
  return new Promise((resolve, reject) => {
    // Inspect headers only; no output file, playback or full audio/video decode.
    execFile(
      ffmpegPath.replace("app.asar", "app.asar.unpacked"),
      [
        "-hide_banner",
        "-nostdin",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "mov,matroska,webm,wav,mp3,ogg,flac,aac,avi,mpeg,mpegts",
        "-i",
        filePath,
      ],
      {
        timeout: 4000,
        maxBuffer: 128 * 1024,
        encoding: "utf8",
        windowsHide: true,
        signal,
      },
      (error, _stdout, stderr) => {
        if (signal?.aborted || error?.killed || error?.code === "ENOENT")
          reject(error);
        else resolve(parseMediaMetadata(stderr));
      },
    );
  });
}

export async function inspectMediaFile(filePath, type, signal) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile())
    throw Object.assign(new Error("Not a file"), { code: "ENOENT" });
  const metadata = { sizeBytes: stat.size };
  try {
    if (type === "img") {
      const image = await sharp(filePath, {
        limitInputPixels: false,
      }).metadata();
      Object.assign(metadata, {
        width: image.width,
        height: image.pageHeight || image.height,
      });
      if (image.pages > 1) metadata.animated = true;
    } else Object.assign(metadata, await inspectStreams(filePath, signal));
  } catch (error) {
    if (signal?.aborted) throw error;
    // The stored file size is still measured even for an unsupported codec.
  }
  return metadata;
}
