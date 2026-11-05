import { db } from "../app.js";

export class ExperimentAccessError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "ExperimentAccessError";
    this.code = code;
    this.status = status;
  }
}

export function assertExperimentID(experimentID) {
  if (
    typeof experimentID !== "string" ||
    !experimentID.trim() ||
    experimentID !== experimentID.trim() ||
    Buffer.byteLength(experimentID) > 1500 ||
    /[\/\x00-\x1f]/.test(experimentID) ||
    experimentID === "." ||
    experimentID === ".." ||
    /^__.*__$/.test(experimentID)
  ) {
    throw new ExperimentAccessError(
      "INVALID_EXPERIMENT_ID",
      400,
      "A valid experimentID is required",
    );
  }
}

export function assertExperimentOwner(data, uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    throw new ExperimentAccessError(
      "AUTH_REQUIRED",
      401,
      "An authenticated user is required",
    );
  }
  if (typeof data?.owner !== "string" || !data.owner.trim()) {
    throw new ExperimentAccessError(
      "OWNERSHIP_UNRESOLVED",
      409,
      "Experiment ownership must be resolved before administration",
    );
  }
  if (data.owner !== uid) {
    throw new ExperimentAccessError(
      "EXPERIMENT_FORBIDDEN",
      403,
      "Authenticated user does not own this experiment",
    );
  }
}

export async function getOwnedExperiment(experimentID, uid) {
  assertExperimentID(experimentID);
  const ref = db.collection("experiments").doc(experimentID);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new ExperimentAccessError(
      "EXPERIMENT_NOT_FOUND",
      404,
      "Experiment not found",
    );
  }
  const data = snapshot.data();
  assertExperimentOwner(data, uid);
  return { ref, data };
}

// Documents without this field predate reservations and retain their runtime contract.
export function isExperimentPrepared(data) {
  return (
    Boolean(data) &&
    (data?.provisioningState === undefined ||
      data.provisioningState === "ready") &&
    data?.initialPublicationPending !== true &&
    data?.mutationLease?.operation !== "delete"
  );
}

export function assertExperimentPrepared(data) {
  if (!isExperimentPrepared(data)) {
    throw new ExperimentAccessError(
      "EXPERIMENT_NOT_READY",
      409,
      "Experiment resources are not ready for participant data",
    );
  }
}

export function requireExperimentPrepared(data, res) {
  try {
    assertExperimentPrepared(data);
    return true;
  } catch (error) {
    sendExperimentAccessError(res, error);
    return false;
  }
}

export function sendExperimentAccessError(res, error) {
  if (!(error instanceof ExperimentAccessError)) return false;
  res
    .status(error.status)
    .json({ success: false, code: error.code, message: error.message });
  return true;
}
