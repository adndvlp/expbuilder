import { publicDatabaseCode } from "./publicDatabaseCode";
import { publicFirebaseCode } from "./publicFirebaseCode";
import { publicSessionCode } from "./publicSessionCode";
import { publicBootstrapCode } from "./publicBootstrapCode";
import { publicBatchCode } from "./publicBatchCode";
import { publicInitCode } from "./publicInitCode";
import { publicFinishCode } from "./publicFinishCode";
import { PublicExperimentCodeOptions } from "./publicCodeTypes";

export function buildPublicExperimentCode(
  options: PublicExperimentCodeOptions,
): string {
  return [
    publicDatabaseCode(options),
    publicFirebaseCode(options),
    publicSessionCode(options),
    publicBootstrapCode(options),
    publicBatchCode(options),
    publicInitCode(options),
    publicFinishCode(options),
  ].join("");
}
