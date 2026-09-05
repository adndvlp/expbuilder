import {
  createWriteStream,
  existsSync,
  chmodSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { Readable } from "stream";

const DEFAULT_VERSION = "2026.8.2";

const TARGETS = {
  "darwin-arm64": {
    asset: "cloudflared-darwin-arm64.tgz",
    file: "cloudflared-darwin-arm64",
    tgz: true,
  },
  "darwin-x64": {
    asset: "cloudflared-darwin-amd64.tgz",
    file: "cloudflared-darwin-amd64",
    tgz: true,
  },
  "linux-arm64": {
    asset: "cloudflared-linux-arm64",
    file: "cloudflared-linux-arm64",
    tgz: false,
  },
  "linux-x64": {
    asset: "cloudflared-linux-amd64",
    file: "cloudflared-linux-amd64",
    tgz: false,
  },
  "win32-arm64": {
    asset: "cloudflared-windows-arm64.exe",
    file: "cloudflared-windows-arm64.exe",
    tgz: false,
  },
  "win32-x64": {
    asset: "cloudflared-windows-amd64.exe",
    file: "cloudflared-windows-amd64.exe",
    tgz: false,
  },
};

export async function fetchCloudflared({
  platform = process.env.npm_config_platform || process.platform,
  arch = process.env.npm_config_arch || process.arch,
  force = false,
} = {}) {
  const target = TARGETS[`${platform}-${arch}`];
  if (!target) {
    throw new Error(`cloudflared: no binary available for ${platform}-${arch}`);
  }

  const outDir =
    process.env.CLOUDFLARED_DIR ||
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "server",
      "cloudflared",
    );
  const outFile = path.join(outDir, target.file);

  if (existsSync(outFile) && !force) {
    console.log(`cloudflared: ${target.file} already present, skipping download`);
    return outFile;
  }

  mkdirSync(outDir, { recursive: true });
  const version = process.env.CLOUDFLARED_VERSION || DEFAULT_VERSION;
  const url = `https://github.com/cloudflare/cloudflared/releases/download/${version}/${target.asset}`;
  console.log(`cloudflared: downloading ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`cloudflared: download failed with HTTP ${res.status}`);
  }

  const tmp = `${outFile}.part`;
  await new Promise((resolve, reject) => {
    const stream = createWriteStream(tmp);
    Readable.fromWeb(res.body).pipe(stream);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  if (target.tgz) {
    const result = spawnSync("tar", ["-xzf", tmp, "-C", outDir], {
      stdio: "inherit",
    });
    rmSync(tmp, { force: true });
    if (result.status !== 0) {
      throw new Error("cloudflared: failed to extract archive");
    }
    const extracted = path.join(outDir, "cloudflared");
    if (!existsSync(extracted)) {
      throw new Error("cloudflared: extracted binary not found");
    }
    renameSync(extracted, outFile);
    chmodSync(outFile, 0o755);
  } else {
    renameSync(tmp, outFile);
    if (platform !== "win32") {
      chmodSync(outFile, 0o755);
    }
  }

  console.log(`cloudflared: saved to ${outFile}`);
  return outFile;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fetchCloudflared({ force: process.argv.includes("--force") }).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
