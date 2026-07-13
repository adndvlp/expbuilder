import fs from "fs";
import os from "os";
import path from "path";
import { __dirname } from "../../utils/paths.js";

let tunnelProcess = null;

/* istanbul ignore next -- platform/resource lookup is covered by route-level tunnel tests with mocked binaries. */
export function getCloudflaredPath() {
  const isProduction = process.env.NODE_ENV === "production";
  const baseDir = isProduction
    ? path.join(process.resourcesPath, "cloudflared")
    : path.join(__dirname, "cloudflared");
  const platform = os.platform();
  const arch = os.arch();

  let binaryName;
  if (platform === "darwin") {
    binaryName =
      arch === "arm64"
        ? "cloudflared-darwin-arm64"
        : "cloudflared-darwin-amd64";
  } else if (platform === "win32") {
    binaryName =
      arch === "arm64"
        ? "cloudflared-windows-arm64.exe"
        : "cloudflared-windows-amd64.exe";
  } else if (platform === "linux") {
    binaryName =
      arch === "arm64" ? "cloudflared-linux-arm64" : "cloudflared-linux-amd64";
  } else {
    throw new Error(`Unsupported OS: ${platform}`);
  }

  const binaryPath = path.join(baseDir, binaryName);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      `cloudflared binary not found at: ${binaryPath}\n` +
        `OS: ${platform}, Arch: ${arch}\n` +
        `Download the correct binary from https://github.com/cloudflare/cloudflared/releases and place it in the 'server/cloudflared/' folder as '${binaryName}'.`,
    );
  }
  return binaryPath;
}

export function getTunnelProcess() {
  return tunnelProcess;
}

export function setTunnelProcess(processRef) {
  tunnelProcess = processRef;
}

export function clearTunnelProcess() {
  tunnelProcess = null;
}
