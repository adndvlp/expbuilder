export const runtimeApiBaseUrl =
  process.env.RUNTIME_SERVER_URL ?? "http://127.0.0.1:3000";

export function localRuntimeStorageKeys(experimentId: string) {
  const namespace = `expbuilder:local:${experimentId}:`;
  return {
    sessionId: `${namespace}session-id`,
    participant: `${namespace}participant-number`,
    resumeTrial: `${namespace}resume-trial`,
    jumpRequest: `${namespace}jump-request`,
    jumpTarget: `${namespace}jump-to-trial`,
    jumpReload: `${namespace}jump-reload`,
    jumpContext: `${namespace}jump-context`,
  };
}

export type PersistedSession = {
  session: {
    state: string;
    data: Array<Record<string, unknown>>;
  };
};

export async function loadPersistedSession(
  experimentId: string,
  sessionId: string,
) {
  const response = await fetch(
    `${runtimeApiBaseUrl}/api/session-result/${experimentId}/${sessionId}`,
  );
  if (!response.ok) {
    throw new Error(`Session result request failed: ${response.status}`);
  }
  return response.json() as Promise<PersistedSession>;
}

export const builderIds = (rows: Array<Record<string, unknown>>) =>
  rows
    .map((row) => row.builder_id)
    .filter((id): id is string | number => id !== null && id !== undefined)
    .map(String);
