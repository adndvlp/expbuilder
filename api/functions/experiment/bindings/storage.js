import { getValidToken } from "../../oauth/index.js";
import { bindingError, checkMarker } from "./common.js";
import * as drive from "./storage-providers/drive.js";
import * as dropbox from "./storage-providers/dropbox.js";
import * as osf from "./storage-providers/osf.js";

export const storageAdapters = { googledrive: drive, dropbox, osf };

const unavailable = "STORAGE_BINDING_UNAVAILABLE";
export function assertStorageProvider(data, requested) {
  const provider =
    data.storageBinding?.provider || data.storageProvider || "googledrive";
  if (requested && requested !== provider)
    throw bindingError(
      "STORAGE_CHANGE_REQUIRES_MIGRATION",
      "Publishing cannot change the data provider. Reconnect the linked account; moving data requires a separate migration.",
    );
  if (
    !["googledrive", "dropbox", "osf"].includes(provider) ||
    (data.storageBinding &&
      data.storageProvider &&
      data.storageBinding.provider !== data.storageProvider)
  )
    throw bindingError(
      unavailable,
      "The saved storage association needs review.",
    );
  return provider;
}
export async function storageClient(provider, uid) {
  const token = await getValidToken(provider, uid);
  if (!token.success || !token.access_token)
    throw bindingError(
      unavailable,
      "Reconnect the data account linked to this experiment in Settings.",
    );
  const identity = await storageAdapters[provider].identify(token.access_token);
  return { token: token.access_token, ...identity, provider };
}
export async function inspectStorageTarget(data, client, selectedFolder) {
  const pinned =
    data.storageBinding?.folderId ||
    data.storagePreparation?.folderId ||
    (client.provider === "googledrive"
      ? data.driveFolderId
      : client.provider === "osf"
        ? data.osfComponentId
        : null);
  if (selectedFolder && pinned && selectedFolder !== String(pinned))
    throw bindingError(
      unavailable,
      "The recorded folder identity cannot be replaced by destination verification. Use Repair destination.",
    );
  let folderId =
    selectedFolder ||
    data.storageBinding?.folderId ||
    data.storagePreparation?.folderId ||
    (client.provider === "googledrive"
      ? data.driveFolderId
      : client.provider === "dropbox"
        ? data.dropboxFolder || data.storagePreparation?.folderPath
        : data.osfComponentId);
  if (!folderId && client.provider === "googledrive" && data.driveFolderPath)
    folderId = await drive.resolvePath(client.token, data.driveFolderPath);
  if (!folderId)
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "The original data folder must be verified before publishing.",
    );
  const folder = await storageAdapters[client.provider].read(
    client.token,
    folderId,
  );
  const marker =
    folder.marker ||
    (folder.appProperties?.expbuilderProject ||
    folder.appProperties?.expbuilderExperiment
      ? {
          format: "expbuilder",
          backendProjectId: folder.appProperties.expbuilderProject,
          experimentID: folder.appProperties.expbuilderExperiment,
        }
      : null);
  if (marker) checkMarker(marker, data.id, "STORAGE_RESOURCE_CONFLICT");
  if (
    data.storageBinding &&
    String(folder.folderId) !== String(data.storageBinding.folderId)
  )
    throw bindingError(
      unavailable,
      "The selected folder has a different identity. Its association was not replaced.",
    );
  const projection =
    client.provider === "googledrive"
      ? {
          driveFolderId: folder.folderId,
          ...(data.driveFolderPath && {
            driveFolderPath: data.driveFolderPath,
          }),
        }
      : client.provider === "dropbox"
        ? { dropboxFolder: folder.folderPath }
        : { osfComponentId: folder.folderId, osfUploadLink: folder.uploadLink };
  return {
    binding: {
      provider: client.provider,
      accountId: client.accountId,
      accountLabel: client.accountLabel,
      folderId: folder.folderId,
      ...(folder.folderPath && { folderPath: folder.folderPath }),
      ...(folder.uploadLink && { uploadLink: folder.uploadLink }),
      ...(data.storageBinding?.rootFolderId && {
        rootFolderId: data.storageBinding.rootFolderId,
      }),
    },
    projection,
    label: folder.label,
    canDelete: folder.canDelete,
  };
}
export async function verifyStorageBinding(data, uid, requested) {
  const provider = assertStorageProvider(data, requested);
  if (!data.storageBinding)
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "Verify this experiment's original data folder before publishing.",
    );
  const client = await storageClient(provider, uid);
  if (client.accountId !== String(data.storageBinding.accountId))
    throw bindingError(
      unavailable,
      "The connected data account differs from the linked account. No substitute folder was created.",
    );
  return { ...(await inspectStorageTarget(data, client)), client };
}
