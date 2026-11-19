import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildWorkspace } from "./workspaceBuild.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
await buildWorkspace();
for (const [compiler, project] of [
  [
    "node_modules/typescript/bin/tsc",
    "shared/experiment-workspace/tsconfig.contracts.json",
  ],
  ["client/node_modules/typescript/bin/tsc", "client/tsconfig.app.json"],
  ["client/node_modules/typescript/bin/tsc", "client/tsconfig.workspace.json"],
]) {
  const result = spawnSync(
    process.execPath,
    [join(root, compiler), "-p", join(root, project), "--noEmit"],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
