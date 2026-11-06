import type { PublicExperimentCodeOptions } from "./publicCodeTypes";
import { publicEventTransportCode } from "./publicEventTransportCode";
import { publicResponsePersistenceCode } from "./publicResponsePersistenceCode";
import { publicCompletionCode } from "./publicCompletionCode";
import { publicExportStatusCode } from './publicExportStatusCode';

export function publicBatchCode(options: PublicExperimentCodeOptions): string {
  return `
    const pendingBatchSaves = [];
${publicEventTransportCode(options)}
${publicResponsePersistenceCode()}
${publicExportStatusCode(options)}
${publicCompletionCode(options)}
`;
}
