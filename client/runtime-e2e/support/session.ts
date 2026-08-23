export const runtimeApiBaseUrl =
  process.env.RUNTIME_SERVER_URL ?? "http://127.0.0.1:3000";

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
