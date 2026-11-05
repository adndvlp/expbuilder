import { createExperiment } from "../create.js";

export async function createExperimentIfMissing(
  experimentID,
  repoName,
  uid,
  storageProvider,
  mutation,
) {
  const result = await createExperiment(
    experimentID,
    repoName,
    uid,
    storageProvider || "googledrive",
    {},
    mutation ? { mutation } : {},
  );
  if (!result.success) {
    const error = new Error(
      result.storageError || "Could not create the experiment storage folder",
    );
    error.code = "EXPERIMENT_STORAGE_SETUP_FAILED";
    throw error;
  }
  return result;
}
