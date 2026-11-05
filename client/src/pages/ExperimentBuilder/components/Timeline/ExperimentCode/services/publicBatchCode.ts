import type { PublicExperimentCodeOptions } from "./publicCodeTypes";
import { publicEventTransportCode } from "./publicEventTransportCode";
import { publicResponsePersistenceCode } from "./publicResponsePersistenceCode";
import { publicCompletionCode } from "./publicCompletionCode";

export function publicBatchCode(options: PublicExperimentCodeOptions): string {
  return `
    const pendingBatchSaves = [];
${publicEventTransportCode(options)}
${publicResponsePersistenceCode()}
${publicCompletionCode(options)}
`;
}
