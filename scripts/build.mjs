import { execSync } from "child_process";
import { fetchCloudflared } from "./fetch-cloudflared.mjs";

execSync("npm install", { stdio: "inherit" });
execSync("npm install --prefix client", { stdio: "inherit" });
execSync("npm install --prefix server/jspsych-bundler", { stdio: "inherit" });
execSync("npm run build --prefix server/jspsych-bundler", {
  stdio: "inherit",
});
execSync("npm run build --prefix client", { stdio: "inherit" });
await fetchCloudflared();
const platformFlag = {
  darwin: "--mac",
  linux: "--linux",
  win32: "--win",
}[process.platform];
const archFlag = {
  arm64: "--arm64",
  x64: "--x64",
}[process.arch];

if (!platformFlag || !archFlag) {
  throw new Error(
    `Unsupported local build target: ${process.platform}/${process.arch}`,
  );
}

execSync(`electron-builder ${platformFlag} ${archFlag}`, {
  stdio: "inherit",
});
