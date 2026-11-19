import { spawn } from "node:child_process";
import { buildWorkspace } from "./workspaceBuild.mjs";
await buildWorkspace();
const args = process.argv.slice(2);
if (!args.length) throw Error("A Node command is required");
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
