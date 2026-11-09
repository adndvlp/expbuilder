import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
import {
  backendProjectId,
  bindingError,
  jsonRequest,
  scalarID,
  resourceName,
} from "../common.js";
const code = "STORAGE_BINDING_UNAVAILABLE";
export async function identify(token) {
  const response = await jsonRequest(
    `${endpoints.googleDrive.apiBase}/drive/v3/about?fields=user(permissionId,emailAddress)`,
    { token, code },
  );
  return {
    accountId: scalarID(response.user?.permissionId, code),
    accountLabel: response.user?.emailAddress || "Google Drive",
  };
}
export async function read(token, folderId) {
  const folder = await jsonRequest(
    `${endpoints.googleDrive.apiBase}/drive/v3/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=id,name,mimeType,trashed,capabilities(canAddChildren,canDelete),appProperties`,
    { token, code },
  );
  if (
    String(folder.id) !== String(folderId) ||
    folder.mimeType !== "application/vnd.google-apps.folder" ||
    folder.trashed ||
    folder.capabilities?.canAddChildren !== true
  )
    throw bindingError(
      code,
      "The original data folder is missing or cannot accept data. No replacement was created.",
    );
  return {
    folderId: String(folder.id),
    label: folder.name,
    appProperties: folder.appProperties,
    canDelete: folder.capabilities.canDelete === true,
  };
}
export const remove = (token, binding) =>
  jsonRequest(
    `${endpoints.googleDrive.apiBase}/drive/v3/files/${encodeURIComponent(binding.folderId)}`,
    { token, method: "DELETE", code },
  );
export async function prepare(client, mutation) {
  const experimentID = mutation.ref.id,
    project = backendProjectId();
  const escape = (value) =>
    String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='expbuilderProject' and value='${escape(project)}' } and appProperties has { key='expbuilderExperiment' and value='${escape(experimentID)}' }${mutation.repairId ? ` and appProperties has { key='expbuilderRepair' and value='${escape(mutation.repairId)}' }` : ""}`;
  const found = await jsonRequest(
    `${endpoints.googleDrive.apiBase}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id),nextPageToken&pageSize=100`,
    { token: client.token, code },
  );
  if (
    !Array.isArray(found.files) ||
    found.nextPageToken ||
    found.files.length > 1
  )
    throw bindingError(
      "STORAGE_BINDING_AMBIGUOUS",
      "More than one folder matches this experiment identity. Review the original destination.",
    );
  if (found.files.length === 1) return read(client.token, found.files[0].id);
  if (mutation.data.storagePreparation?.folderId)
    return read(client.token, mutation.data.storagePreparation.folderId);
  if (mutation.data.storagePreparation?.phase === "creating")
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "The previous folder creation is uncertain. Inspect its existing folder ID before continuing.",
    );
  await mutation.check();
  const preparation = {
    ...mutation.data.storagePreparation,
    phase: "creating",
  };
  await mutation.update({ storagePreparation: preparation });
  const folder = await jsonRequest(
    `${endpoints.googleDrive.apiBase}/drive/v3/files?fields=id`,
    {
      token: client.token,
      method: "POST",
      code,
      body: {
        name: `ExpBuilder-${resourceName(mutation.resourceKey || experimentID)}`,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: {
          expbuilderProject: project,
          expbuilderExperiment: experimentID,
          ...(mutation.repairId && { expbuilderRepair: mutation.repairId }),
        },
      },
    },
  );
  const id = scalarID(folder.id, code);
  await mutation.update({
    storagePreparation: { ...preparation, phase: "created", folderId: id },
  });
  return read(client.token, id);
}

export async function resolvePath(token, path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > 2048)
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "Enter the original Google Drive folder ID.",
    );
  const names = path.slice(1).split("/");
  if (
    !names.length ||
    names.length > 16 ||
    names.some((name) => !name || name === "." || name === "..")
  )
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "The saved folder path needs explicit verification by ID.",
    );
  const escape = (value) =>
    String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  let parent = "root";
  for (const name of names) {
    const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escape(name)}' and '${escape(parent)}' in parents`;
    const result = await jsonRequest(
      `${endpoints.googleDrive.apiBase}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id),nextPageToken&pageSize=100&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      { token, code },
    );
    if (
      !Array.isArray(result.files) ||
      result.nextPageToken ||
      result.files.length !== 1
    )
      throw bindingError(
        "STORAGE_BINDING_AMBIGUOUS",
        "The saved folder path is missing or ambiguous. Select and verify the original folder by ID.",
      );
    parent = scalarID(result.files[0].id, code);
  }
  return parent;
}
