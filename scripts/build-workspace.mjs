import { buildWorkspace } from "./workspaceBuild.mjs";
await buildWorkspace({ force: process.argv.includes("--force") });
