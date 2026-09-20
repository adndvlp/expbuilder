import { createFolder } from "../sessions/services/folder.js";
import { getValidToken } from "../../oauth/index.js";

/**
 * Validates the provider token (unless one is already resolved) and ensures
 * the experiment folder exists. createFolder is idempotent for Drive,
 * Dropbox and OSF, so this doubles as the all-or-nothing check used by
 * creation, provider change and republish.
 */
export async function ensureProviderFolder({
  provider,
  uid,
  token,
  folderPath,
  componentName,
}) {
  let accessToken = token;
  if (!accessToken) {
    const tokenResult = await getValidToken(provider, uid);
    if (!tokenResult.success) {
      return { success: false, code: "TOKEN_ERROR", error: tokenResult.error };
    }
    accessToken = tokenResult.access_token;
  }

  const folderResult = await createFolder(
    provider,
    accessToken,
    folderPath,
    componentName,
  );
  if (!folderResult.success) {
    return {
      success: false,
      code: "FOLDER_ERROR",
      error: folderResult.errorText,
    };
  }

  return {
    success: true,
    folderId: folderResult.folderId || folderResult.componentId,
    uploadLink: folderResult.uploadLink,
    alreadyExists: folderResult.alreadyExists === true,
  };
}

export function buildProviderFields(provider, folderPath, folderResult) {
  if (provider === "googledrive") {
    return {
      driveFolderPath: folderPath,
      driveFolderId: folderResult.folderId,
    };
  }
  if (provider === "dropbox") {
    return { dropboxFolder: folderPath };
  }
  if (provider === "osf") {
    return {
      osfComponentId: folderResult.folderId,
      osfUploadLink: folderResult.uploadLink,
    };
  }
  return {};
}
