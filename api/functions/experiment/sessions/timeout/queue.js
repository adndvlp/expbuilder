import { getFunctions } from "firebase-admin/functions";
import { app } from "../../../app.js";

export const SESSION_TIMEOUT_TASK_REGION = "us-central1";
export const SESSION_TIMEOUT_TASK_FUNCTION = "processSessionTimeout";
export const SESSION_TIMEOUT_TASK_QUEUE =
  `locations/${SESSION_TIMEOUT_TASK_REGION}/functions/${SESSION_TIMEOUT_TASK_FUNCTION}`;
export const SESSION_TIMEOUT_TASK_DISPATCH_DEADLINE_SECONDS = 120;

export function validateSessionTimeoutTaskPayload(data) {
  const experimentID = data?.experimentID;
  const sessionId = data?.sessionId;
  const expiresAt = data?.expiresAt;

  if (
    typeof experimentID !== "string" ||
    experimentID.length === 0 ||
    experimentID.includes("/") ||
    typeof sessionId !== "string" ||
    sessionId.length === 0 ||
    sessionId.includes("/") ||
    typeof expiresAt !== "number" ||
    !Number.isFinite(expiresAt)
  ) {
    throw new Error("INVALID_SESSION_TIMEOUT_TASK_PAYLOAD");
  }

  const extra = data.connectionId ? { connectionId: data.connectionId, connectionGeneration: data.connectionGeneration, ...(data.kind && { kind: data.kind }) } : {};
  if (data.connectionId && (!/^[\w-]{1,128}$/.test(data.connectionId) || !Number.isSafeInteger(data.connectionGeneration) || data.connectionGeneration < 1)) throw new Error('INVALID_SESSION_TIMEOUT_TASK_PAYLOAD');
  return { experimentID, sessionId, expiresAt, ...extra };
}

export async function scheduleSessionTimeoutTask(data) {
  const payload = validateSessionTimeoutTaskPayload(data);
  const queue = getFunctions(app).taskQueue(SESSION_TIMEOUT_TASK_QUEUE);
  await queue.enqueue(payload, {
    scheduleTime: new Date(Math.max(Date.now(), payload.expiresAt)),
    dispatchDeadlineSeconds: SESSION_TIMEOUT_TASK_DISPATCH_DEADLINE_SECONDS,
  });
}
