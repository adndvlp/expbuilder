import { execSync } from "child_process";
import { fetchCloudflared } from "./fetch-cloudflared.mjs";

execSync("npm install", { stdio: "inherit" });
execSync("npm install --prefix client", { stdio: "inherit" });
execSync("npm run build --prefix client", { stdio: "inherit" });
await fetchCloudflared();
const archFlag = process.arch === "arm64" ? "--arm64" : "--x64";
execSync(`electron-builder ${archFlag}`, { stdio: "inherit" });
