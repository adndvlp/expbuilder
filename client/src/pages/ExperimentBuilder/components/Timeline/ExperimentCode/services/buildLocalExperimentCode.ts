import type { LocalExperimentCodeOptions } from "./localCodeTypes";
import { buildLocalRuntime } from "./localRuntime";
import { buildLocalSessionPrelude } from "./localSessionPrelude";
import { buildLocalOutboxCode } from "./localOutboxCode";

export function buildLocalExperimentCode(
  options: LocalExperimentCodeOptions,
): string {
  return (
    buildLocalSessionPrelude(options) +
    buildLocalOutboxCode() +
    buildLocalRuntime(options)
  );
}
