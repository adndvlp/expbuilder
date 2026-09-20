import { db } from "../../app.js";
import {
  buildProviderFields,
  ensureProviderFolder,
} from "./provider-folder.js";

function failure(status, message, error) {
  return {
    ok: false,
    response: {
      status,
      body: { success: false, message, error },
    },
  };
}

/**
 * All-or-nothing storage check for republishing with the same provider.
 * Validates the provider token and ensures the experiment folder still
 * exists (createFolder is idempotent for Drive, Dropbox and OSF), updating
 * the stored folder fields when they change so the runtime keeps writing to
 * the right place.
 */
export async function ensureExperimentStorage(
  experimentRef,
  experimentData,
  provider,
  uid,
  fallbackName,
) {
  const fallbackPath = `/ExpBuilder/${fallbackName}`;
  let folderPath;
  let componentName = fallbackName;

  if (provider === "googledrive") {
    folderPath = experimentData.driveFolderPath || fallbackPath;
  } else if (provider === "dropbox") {
    folderPath = experimentData.dropboxFolder || fallbackPath;
  } else if (provider === "osf") {
    componentName = experimentData.title || fallbackName;
    const userDoc = await db.collection("users").doc(uid).get();
    folderPath = userDoc.exists ? userDoc.data()?.osfProjectId : null;
    if (!folderPath) {
      return failure(
        400,
        "Could not create the experiment folder in osf",
        "OSF project not found. Connect your OSF account and try again.",
      );
    }
  } else {
    return failure(400, "Unknown storage provider", provider);
  }

  const folderResult = await ensureProviderFolder({
    provider,
    uid,
    folderPath,
    componentName,
  });
  if (!folderResult.success) {
    return folderResult.code === "TOKEN_ERROR"
      ? failure(
          400,
          `Could not get a valid ${provider} token to create the experiment folder`,
          folderResult.error,
        )
      : failure(
          400,
          `Could not create the experiment folder in ${provider}`,
          folderResult.error,
        );
  }

  await experimentRef.update(
    buildProviderFields(provider, folderPath, folderResult),
  );
  return { ok: true };
}
