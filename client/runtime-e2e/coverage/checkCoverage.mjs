import process from "node:process";
import { fileURLToPath } from "node:url";
import { runtimeScenarios } from "./coverageRegistry.mjs";
import { validateRuntimeRegistry } from "./validateRegistry.mjs";

const result = await validateRuntimeRegistry(
  fileURLToPath(new URL("../scenarios", import.meta.url)),
  runtimeScenarios,
);

if (result.errors.length > 0) {
  console.error("Runtime scenario registry errors:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Runtime scenario registry: ${result.registered} tags verified in ` +
      `${result.taggedFiles} scenario files.`,
  );
  console.log(
    "This validates test declarations, not execution results or code coverage.",
  );
}
