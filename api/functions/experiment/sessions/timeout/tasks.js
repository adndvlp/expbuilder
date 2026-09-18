import { getDatabase } from "firebase-admin/database";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { db, app } from "../../../app.js";
import { finalizeSession } from "../finalization/finalize.js";
import {
  scheduleSessionTimeoutTask,
  SESSION_TIMEOUT_TASK_REGION,
  validateSessionTimeoutTaskPayload,
} from "./queue.js";

export { scheduleSessionTimeoutTask };

const NO_DATA_ERRORS = new Set(["SESSION_NOT_FOUND", "NO_RESULTS"]);

async function writeExpiredSessionMetadata(
  experimentID,
  sessionId,
  sessionData,
  extra = {},
) {
  await db
    .collection("experiments")
    .doc(experimentID)
    .collection("session_metadata")
    .doc(sessionId)
    .set(
      {
        sessionId,
        state: "expired",
        completedAt: new Date().toISOString(),
        expiredAt: new Date().toISOString(),
        metadata: sessionData.metadata || {},
        storageProvider: sessionData.storageProvider || "googledrive",
        ...extra,
      },
      { merge: true },
    );
}

function buildExpiredRtdbUpdate(extra = {}) {
  return {
    state: "expired",
    finalizationProcessed: true,
    expiredAt: Date.now(),
    timeoutTaskProcessedAt: Date.now(),
    resumeTimeoutTaskStatus: "processed",
    ...extra,
  };
}

export async function handleSessionTimeoutTask(data) {
  const { experimentID, sessionId, expiresAt } =
    validateSessionTimeoutTaskPayload(data);
  const sessionRef = getDatabase(app).ref(`sessions/${experimentID}/${sessionId}`);
  const sessionSnapshot = await sessionRef.once("value");
  const currentData = sessionSnapshot.val();

  if (!currentData) {
    return { status: "missing_session" };
  }

  if (currentData.finalizationProcessed === true) {
    return { status: "already_processed" };
  }

  if (currentData.connected !== false || currentData.state !== "disconnected") {
    return { status: "not_disconnected" };
  }

  if (currentData.resumeExpiresAt !== expiresAt) {
    return { status: "stale_task" };
  }

  if (Date.now() < expiresAt) {
    throw new Error("SESSION_TIMEOUT_NOT_EXPIRED");
  }

  // The participant never reconnected: save whatever was collected so far to
  // the experiment storage. finalizeSession cleans the temporary Firestore
  // session data only after a successful upload, so a failed save never
  // destroys the trials.
  try {
    const result = await finalizeSession(experimentID, sessionId);
    const resultsSent = result?.resultsSent ?? 0;
    await writeExpiredSessionMetadata(experimentID, sessionId, currentData, {
      resultsSent,
    });
    await sessionRef.update(buildExpiredRtdbUpdate({ resultsSent }));

    return { status: "expired_session_saved", resultsSent };
  } catch (error) {
    if (!NO_DATA_ERRORS.has(error.message)) {
      throw error;
    }

    await writeExpiredSessionMetadata(experimentID, sessionId, currentData, {
      finalizationError: error.message,
      noDataToFinalize: true,
    });
    await sessionRef.update(
      buildExpiredRtdbUpdate({
        finalizationError: error.message,
        noDataToFinalize: true,
      }),
    );

    return { status: "expired_no_data", error: error.message };
  }
}

export const processSessionTimeout = onTaskDispatched(
  {
    region: SESSION_TIMEOUT_TASK_REGION,
    timeoutSeconds: 300,
    retryConfig: {
      maxAttempts: 5,
      minBackoffSeconds: 30,
      maxBackoffSeconds: 300,
      maxDoublings: 3,
    },
    rateLimits: {
      maxConcurrentDispatches: 20,
      maxDispatchesPerSecond: 20,
    },
  },
  async (request) => {
    await handleSessionTimeoutTask(request.data);
  },
);
