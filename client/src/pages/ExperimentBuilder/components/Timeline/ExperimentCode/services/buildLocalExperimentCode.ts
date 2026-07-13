import { LocalExperimentCodeOptions } from "./localCodeTypes";
import { buildLocalRuntime } from "./localRuntime";
import { buildLocalSessionPrelude } from "./localSessionPrelude";

export function buildLocalExperimentCode(
  options: LocalExperimentCodeOptions,
): string {
  return buildLocalSessionPrelude(options) + buildLocalRuntime(options);
}
