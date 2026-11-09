import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
import {
  bindingError,
  jsonRequest,
  scalarID,
  resourceName,
  identityMarker,
  checkMarker,
} from "../common.js";
const code = "STORAGE_BINDING_UNAVAILABLE";
export async function identify(token) {
  const response = await jsonRequest(
    `${endpoints.dropbox.apiBase}/2/users/get_current_account`,
    { token, method: "POST", body: null, code },
  );
  return {
    accountId: scalarID(response.account_id, code),
    accountLabel: response.email || "Dropbox",
  };
}
export async function read(token, folderId) {
  const folder = await jsonRequest(
    `${endpoints.dropbox.apiBase}/2/files/get_metadata`,
    { token, method: "POST", body: { path: folderId }, code },
  );
  if (
    folder[".tag"] !== "folder" ||
    folder.sharing_info?.read_only === true ||
    typeof folder.path_lower !== "string" ||
    !folder.path_lower.startsWith("/")
  )
    throw bindingError(
      code,
      "The original Dropbox folder cannot be verified for writing. No replacement was created.",
    );
  return {
    folderId: scalarID(folder.id, code),
    folderPath: folder.path_lower,
    label: folder.name,
    marker: await readMarker(token, folder.path_lower),
  };
}
export const remove = (token, binding) =>
  jsonRequest(`${endpoints.dropbox.apiBase}/2/files/delete_v2`, {
    token,
    method: "POST",
    body: { path: binding.folderId },
    code,
  });
const missing = (error) =>
  error.providerStatus === 409 &&
  (error.providerBody?.error?.path?.[".tag"] === "not_found" ||
    error.providerBody?.error_summary?.startsWith("path/not_found"));
async function metadata(token, path) {
  try {
    return await jsonRequest(
      `${endpoints.dropbox.apiBase}/2/files/get_metadata`,
      { token, method: "POST", body: { path }, code },
    );
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}
export async function readMarker(token, folderPath) {
  try {
    return await jsonRequest(
      `${endpoints.dropbox.contentBase}/2/files/download`,
      {
        token,
        method: "POST",
        headers: {
          "Dropbox-API-Arg": JSON.stringify({
            path: `${folderPath}/.expbuilder-binding.json`,
          }),
        },
        code,
      },
    );
  } catch (error) {
    if (missing(error) || error.providerStatus === 404) return null;
    throw error;
  }
}
export async function prepare(client, mutation) {
  const token = client.token,
    experimentID = mutation.ref.id,
    path = `/ExpBuilder/${resourceName(mutation.resourceKey || experimentID)}`;
  const root = await metadata(token, "/ExpBuilder");
  if (!root) {
    await mutation.check();
    await jsonRequest(`${endpoints.dropbox.apiBase}/2/files/create_folder_v2`, {
      token,
      method: "POST",
      body: { path: "/ExpBuilder", autorename: false },
      code,
    });
  } else if (root[".tag"] !== "folder")
    throw bindingError(
      code,
      "The Dropbox application directory is not a folder.",
    );
  let folder = await metadata(
    token,
    mutation.data.storagePreparation?.folderId || path,
  );
  if (folder) {
    const marker = await readMarker(token, folder.path_lower);
    if (marker) {
      checkMarker(marker, experimentID, "STORAGE_RESOURCE_CONFLICT");
      return read(token, folder.id);
    }
    if (
      String(folder.id) !== String(mutation.data.storagePreparation?.folderId)
    ) {
      await mutation.update({
        storagePreparation: {
          ...mutation.data.storagePreparation,
          requiresReview: true,
        },
      });
      throw bindingError(
        "STORAGE_BINDING_REVIEW_REQUIRED",
        "An existing Dropbox folder has no experiment marker. Inspect it explicitly before linking it.",
      );
    }
  } else {
    if (mutation.data.storagePreparation?.phase === "creating")
      throw bindingError(
        "STORAGE_BINDING_REVIEW_REQUIRED",
        "The previous Dropbox creation is uncertain. Inspect its existing folder ID or path before continuing.",
      );
    await mutation.update({
      storagePreparation: {
        ...mutation.data.storagePreparation,
        phase: "creating",
        folderPath: path,
      },
    });
    await mutation.check();
    const result = await jsonRequest(
      `${endpoints.dropbox.apiBase}/2/files/create_folder_v2`,
      { token, method: "POST", body: { path, autorename: false }, code },
    );
    folder = result.metadata;
    const folderId = scalarID(folder?.id, code);
    await mutation.update({
      storagePreparation: {
        ...mutation.data.storagePreparation,
        phase: "created",
        folderId,
      },
    });
  }
  const target = await read(token, folder.id);
  try {
    await mutation.check();
    await jsonRequest(`${endpoints.dropbox.contentBase}/2/files/upload`, {
      token,
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: `${target.folderPath}/.expbuilder-binding.json`,
          mode: "add",
          autorename: false,
          mute: true,
        }),
      },
      rawBody: JSON.stringify({
        ...identityMarker(experimentID),
        ...(mutation.repairId && { repairId: mutation.repairId }),
      }),
      code,
    });
  } catch (error) {
    if (error.providerStatus !== 409) throw error;
    const marker = await readMarker(token, target.folderPath);
    if (!marker) throw error;
    checkMarker(marker, experimentID, "STORAGE_RESOURCE_CONFLICT");
  }
  return target;
}
