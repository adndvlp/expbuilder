import { getPublicSettingsError } from '../../../../../../lib/publicSettings';
import type { PublicExperimentCodeOptions } from './publicCodeTypes';

export function publicHandshakeCode(options: PublicExperimentCodeOptions): string {
  const { DATA_API_URL, experimentID } = options;
  return `
  const _publicSettingsError = ${getPublicSettingsError.toString()};
  const _publicWriter = { connectionId: crypto.randomUUID(), writeToken: crypto.randomUUID() + crypto.randomUUID(), connectionGeneration: 0 };
  async function createSession(action = 'createSession', renewConnection = false) {
    const sessionName = !_sessionNameHasDynamic() ? _generateSessionName(null) : null;
    const response = await fetch(${JSON.stringify(DATA_API_URL)}, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, experimentID: ${JSON.stringify(experimentID)}, sessionId: trialSessionId,
        sessionProtocolVersion: 3,
        ..._publicWriter, renewConnection, metadata, ...(sessionName && { sessionName }) })
    });
    const result = await response.json();
    if (result?.decision && result.sessionProtocolVersion === 3) {
      const settingsError = _publicSettingsError(result.configuration);
      if (settingsError) throw new Error('Invalid session settings: ' + settingsError);
      return result;
    }
    throw new Error(result?.message || 'This publication requires the current session service');
  }
`;
}
