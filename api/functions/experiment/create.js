import { FieldValue } from "firebase-admin/firestore";
import writeLog from "./sessions/logging/write-log.js";
import { prepareStorageBinding } from "./bindings/prepare-storage.js";
import { withExperimentMutation } from "./mutation.js";
import { assertExperimentOwner } from "./access.js";

const DEFAULTS = {
  limitSessions: false,
  maxSessions: 1,
  useValidation: true,
  allowJSON: true,
  allowCSV: true,
  requiredFields: ["trial_type"],
  activeConditionAssignment: true,
  nConditions: 1,
};

export function buildExperimentReservation(
  experimentID,
  title,
  uid,
  storageProvider = "googledrive",
  overrides = {},
) {
  assertExperimentOwner({ owner: uid }, uid);
  const allowed = [
    ...Object.keys(DEFAULTS),
    "batchConfig",
    "recruitmentConfig",
    "captchaConfig",
  ];
  const safeOverrides = Object.fromEntries(
    Object.entries(overrides || {}).filter(([key]) => allowed.includes(key)),
  );
  return {
    ...DEFAULTS,
    ...safeOverrides,
    schemaVersion: 2,
    id: experimentID,
    owner: uid,
    title,
    storageProvider,
    sessions: 0,
    currentCondition: 0,
    createdAt: FieldValue.serverTimestamp(),
    active: false,
    provisioningState: "preparing",
    initialPublicationPending: true,
  };
}

/** Reserve the owner before creating folders, including OSF projects. */
export async function createExperiment(
  experimentID,
  experimentName,
  uid,
  storageProvider = "googledrive",
  overrides = {},
  options = {},
) {
  const initialData = buildExperimentReservation(
    experimentID,
    experimentName,
    uid,
    storageProvider,
    overrides,
  );
  const prepare = async (mutation) => {
    assertExperimentOwner(mutation.data, uid);
    if (
      !mutation.created &&
      !["preparing", "failed"].includes(mutation.data.provisioningState)
    ) {
      return {
        success: true,
        experimentID,
        alreadyExists: true,
        folderCreated: false,
      };
    }
    try {
      await mutation.update({ provisioningState: "preparing" });
      await writeLog(experimentID, "createExperiment");
      const target = await prepareStorageBinding(
        mutation,
        uid,
        mutation.data.storageProvider,
      );
      return {
        success: true,
        experimentID,
        folderCreated: true,
        folderId: target.binding.folderId,
        ...(target.binding.folderPath && {
          folderPath: target.binding.folderPath,
        }),
      };
    } catch (error) {
      // update() rechecks the lease; a stale worker cannot mark a newer attempt failed.
      await mutation.update({ provisioningState: "failed" });
      return { success: false, storageError: error.message };
    }
  };
  if (options.mutation) return prepare(options.mutation);
  return withExperimentMutation(
    { experimentID, uid, operation: "prepare", initialData },
    prepare,
  );
}
