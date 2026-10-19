import type { LocalExperimentCodeOptions } from "./localCodeTypes";
import { buildLocalRuntime } from "./localRuntime";
import { buildLocalSessionPrelude } from "./localSessionPrelude";
import { buildLocalOutboxCode } from "./localOutboxCode";
import { composeRuntimeCode } from "../../../../modules/experiment-runtime/runtimeStateContract";

export function buildLocalExperimentCode(
  options: LocalExperimentCodeOptions,
): string {
  const prelude = buildLocalSessionPrelude(options);
  const outbox = buildLocalOutboxCode();
  const runtime = buildLocalRuntime(options);
  return composeRuntimeCode([
    {
      owner: "local-session-prelude",
      code: prelude,
      accesses: [
        {
          state: "custom-parameters",
          mode: "writer",
          evidence: "parameters: options.parameters ?? null",
        },
        {
          state: "cleanup",
          mode: "writer",
          evidence: "clearTransientState() {",
        },
      ],
    },
    { owner: "local-outbox", code: outbox, accesses: [] },
    {
      owner: "local-runtime",
      code: runtime,
      accesses: [
        {
          state: "route",
          mode: "writer",
          evidence: "JSON.stringify(_createResumeCheckpoint(data))",
        },
        {
          state: "route",
          mode: "consumer",
          evidence: "_resolveResumeBranch(resumeRaw)",
        },
        {
          state: "custom-parameters",
          mode: "consumer",
          evidence: /Object\.entries\([^)]*[Bb]ranch(?:Custom)?Parameters\)/,
        },
        {
          state: "cleanup",
          mode: "consumer",
          evidence: "window.ExpBuilderNavigation.clearTransientState()",
        },
      ],
    },
  ]);
}
