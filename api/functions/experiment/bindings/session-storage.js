import { db } from "../../app.js";
import { assertExperimentOwner } from "../access.js";
import { bindingError } from "./common.js";

/** Pin once, including batch=0 sessions. A repaired folder never redirects old sessions. */
export async function pinSessionStorage(
  data,
  experimentID,
  sessionId,
  { readOnly = false } = {},
) {
  if (!data.storageBinding || !sessionId) return data.storageBinding;
  const ref = db.collection("experiments").doc(experimentID),
    meta = ref.collection("session_metadata").doc(sessionId),
    session = ref.collection("sessions").doc(sessionId);
  return db.runTransaction(async (transaction) => {
    const [experiment, metadata, temporary] = await Promise.all([
      transaction.get(ref),
      transaction.get(meta),
      transaction.get(session),
    ]);
    const current = experiment.data();
    assertExperimentOwner(current, data.owner);
    if (current.deletionProgress)
      throw bindingError(
        "DELETION_RECOVERY_REQUIRED",
        "Session storage is unavailable while deletion is pending.",
      );
    const pinned =
      metadata.data()?.storageBinding || temporary.data()?.storageBinding;
    const historical =
      (metadata.exists || temporary.exists || readOnly) &&
      current.legacyStorageBinding;
    const binding = pinned || historical || current.storageBinding;
    if (!readOnly && !pinned)
      transaction.set(
        meta,
        { sessionId, storageBinding: binding },
        { merge: true },
      );
    return binding;
  });
}
