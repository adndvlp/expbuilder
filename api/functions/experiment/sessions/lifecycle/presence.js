import { onValueWritten } from 'firebase-functions/v2/database';
import { refreshLifecycle } from './state.js';

export async function handleConnectionPresence(params, presence) {
  if (!presence) return;
  return refreshLifecycle(params.experimentID, params.sessionId, { connectionId: params.connectionId, connectionGeneration: presence.generation });
}
export const onSessionConnectionWritten = onValueWritten({ ref: '/session_connections/{experimentID}/{sessionId}/{connectionId}', region: 'us-central1', maxInstances: 5 },
  event => handleConnectionPresence(event.params, event.data.after.val()));
