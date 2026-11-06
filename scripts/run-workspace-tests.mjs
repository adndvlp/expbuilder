import { buildWorkspace } from "./workspaceBuild.mjs";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
await buildWorkspace();
const files = [
  "shared/experiment-workspace",
  "server/__tests__/workspace",
].flatMap((dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => dir + "/" + name),
);
files.push("scripts/workspaceBuild.test.mjs");
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
if (process.exitCode === 0) {
  const parity = spawnSync(
    process.execPath,
    ["--test", "docs/demos/branching-workspace.test.mjs"],
    { stdio: "inherit", env: { ...process.env, WORKSPACE_SHARED_MODEL: "1" } },
  );
  process.exitCode = parity.status ?? 1;
}
