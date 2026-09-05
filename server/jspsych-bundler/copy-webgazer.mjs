import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WEBGAZER_JS_SHA256, WEBGAZER_JS_URL } from "../utils/plugin-scripts.js";

const bundlerRoot = dirname(fileURLToPath(import.meta.url));
const destDir = join(bundlerRoot, "public");
const destFile = join(destDir, "webgazer.js");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function copyWebgazer({ force = false } = {}) {
  if (!force && existsSync(destFile)) {
    const existing = sha256(readFileSync(destFile));
    if (existing === WEBGAZER_JS_SHA256) {
      console.log("webgazer.js already present with expected hash, skipping download");
      return destFile;
    }
    console.log("webgazer.js exists but hash does not match; re-downloading");
  }

  console.log(`Downloading webgazer.js from ${WEBGAZER_JS_URL}`);
  const response = await fetch(WEBGAZER_JS_URL);
  if (!response.ok) {
    throw new Error(`webgazer download failed with HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const digest = sha256(buffer);
  if (digest !== WEBGAZER_JS_SHA256) {
    throw new Error(
      `webgazer.js integrity check failed: expected ${WEBGAZER_JS_SHA256}, got ${digest}`,
    );
  }

  mkdirSync(destDir, { recursive: true });
  writeFileSync(destFile, buffer);
  console.log(`Saved webgazer.js to ${destFile}`);
  return destFile;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  copyWebgazer({ force: process.argv.includes("--force") }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
