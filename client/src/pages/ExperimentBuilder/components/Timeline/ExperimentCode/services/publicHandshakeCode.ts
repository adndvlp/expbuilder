import type { PublicExperimentCodeOptions } from './publicCodeTypes';
import { publicPublicationLocationCode } from './publicPublicationLocationCode';

export function publicHandshakeCode(options: PublicExperimentCodeOptions): string {
  const { DATA_API_URL, experimentID, batchConfig, recruitmentConfig, captchaConfig } = options;
  return `
  const _PUBLIC_PUBLICATION_CONFIG = ${JSON.stringify({ batchConfig, recruitmentConfig, captchaConfig })};
  const _PUBLIC_PUBLICATION_ID = '__PUBLICATION_ID__';
  const _PUBLIC_EXECUTION_REVISION = '__EXECUTION_REVISION__';
  ${publicPublicationLocationCode()}
  const _publicWriter = { connectionId: crypto.randomUUID(), writeToken: crypto.randomUUID() + crypto.randomUUID(), connectionGeneration: 0 };
  async function createSession(action = 'createSession', renewConnection = false) {
    const sessionName = !_sessionNameHasDynamic() ? _generateSessionName(null) : null;
    const response = await fetch(${JSON.stringify(DATA_API_URL)}, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, experimentID: ${JSON.stringify(experimentID)}, sessionId: trialSessionId,
        sessionProtocolVersion: 3, publicationId: _PUBLIC_PUBLICATION_ID, executionRevision: _PUBLIC_EXECUTION_REVISION,
        ..._publicWriter, renewConnection, metadata, ...(sessionName && { sessionName }) })
    });
    const result = await response.json();
    if (result?.decision && result.sessionProtocolVersion === 3) return result;
    throw new Error(result?.message || 'This publication requires the current session service');
  }
`;
}
