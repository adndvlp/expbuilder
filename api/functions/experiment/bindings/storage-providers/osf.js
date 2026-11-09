import { PROVIDER_ENDPOINTS as endpoints } from "../../../utils/provider-endpoints.js";
import {
  backendProjectId,
  bindingError,
  jsonRequest,
  scalarID,
  resourceName,
  identityMarker,
} from "../common.js";
import { ensureOsfProject } from "../../publish/osf-project.js";
const code = "STORAGE_BINDING_UNAVAILABLE";
export async function identify(token) {
  const response = await jsonRequest(`${endpoints.osf.apiBase}/v2/users/me/`, {
    token,
    code,
  });
  return {
    accountId: scalarID(response.data?.id, code),
    accountLabel: response.data?.attributes?.full_name || "OSF",
  };
}
export async function read(token, folderId) {
  const node = await jsonRequest(
    `${endpoints.osf.apiBase}/v2/nodes/${encodeURIComponent(folderId)}/`,
    { token, code },
  );
  if (
    String(node.data?.id) !== String(folderId) ||
    !node.data?.attributes?.current_user_permissions?.some((permission) =>
      ["write", "admin"].includes(permission),
    )
  )
    throw bindingError(
      code,
      "The original OSF component cannot be verified for writing. No replacement was created.",
    );
  const files = await jsonRequest(
    `${endpoints.osf.apiBase}/v2/nodes/${encodeURIComponent(folderId)}/files/`,
    { token, code },
  );
  const provider = files.data?.find(
    (item) =>
      item.attributes?.name === "osfstorage" ||
      item.id === "osfstorage" ||
      String(item.id).endsWith(":osfstorage"),
  );
  let upload;
  try {
    upload = new URL(provider.links.upload);
  } catch {
    throw bindingError(
      code,
      "OSF did not return a verifiable upload destination.",
    );
  }
  const origin = new URL(endpoints.osf.apiBase).origin;
  if (
    ![origin, "https://files.osf.io"].includes(upload.origin) ||
    upload.search ||
    upload.hash ||
    !upload.pathname.startsWith(
      `/v1/resources/${encodeURIComponent(folderId)}/providers/osfstorage/`,
    )
  )
    throw bindingError(
      code,
      "OSF returned an upload destination for another resource.",
    );
  let marker = null;
  if (node.data.attributes.description?.startsWith("ExpBuilder binding: ")) {
    try {
      marker = JSON.parse(
        node.data.attributes.description.slice("ExpBuilder binding: ".length),
      );
    } catch {
      throw bindingError(
        "STORAGE_RESOURCE_CONFLICT",
        "The OSF experiment marker cannot be verified.",
      );
    }
  }
  return {
    folderId: String(folderId),
    uploadLink: upload.href,
    label: node.data.attributes.title,
    marker,
    canDelete: node.data.attributes.current_user_permissions.includes("admin"),
  };
}
export const remove = (token, binding) =>
  jsonRequest(
    `${endpoints.osf.apiBase}/v2/nodes/${encodeURIComponent(binding.folderId)}/`,
    { token, method: "DELETE", code },
  );
export async function prepare(client, mutation) {
  if (mutation.data.storagePreparation?.folderId)
    return read(client.token, mutation.data.storagePreparation.folderId);
  const root =
    mutation.data.storagePreparation?.rootFolderId ||
    (await ensureOsfProject(mutation.data.owner, {
      token: client.token,
      check: mutation.check,
    }));
  const parent = await jsonRequest(
    `${endpoints.osf.apiBase}/v2/nodes/${encodeURIComponent(root)}/`,
    { token: client.token, code },
  );
  if (
    !parent.data?.attributes?.current_user_permissions?.some((permission) =>
      ["write", "admin"].includes(permission),
    )
  )
    throw bindingError(
      code,
      "The connected OSF account cannot add a component to the original project.",
    );
  await mutation.update({
    storagePreparation: {
      ...mutation.data.storagePreparation,
      rootFolderId: root,
    },
  });
  const title = resourceName(mutation.resourceKey || mutation.ref.id),
    matches = [];
  let url = `${endpoints.osf.apiBase}/v2/nodes/${encodeURIComponent(root)}/children/?page[size]=100`;
  for (let page = 0; url; page++) {
    if (
      page >= 20 ||
      new URL(url).origin !== new URL(endpoints.osf.apiBase).origin
    )
      throw bindingError(
        "STORAGE_BINDING_AMBIGUOUS",
        "OSF components could not be inspected completely. No component was created.",
      );
    const result = await jsonRequest(url, { token: client.token, code });
    if (!Array.isArray(result.data))
      throw bindingError(code, "OSF returned an incomplete component list.");
    for (const node of result.data) {
      let marker = null;
      try {
        if (node.attributes?.description?.startsWith("ExpBuilder binding: "))
          marker = JSON.parse(
            node.attributes.description.slice("ExpBuilder binding: ".length),
          );
      } catch {
        // A malformed marker cannot prove that this is the prepared component.
      }
      if (
        marker?.backendProjectId === backendProjectId() &&
        marker.experimentID === mutation.ref.id &&
        (marker.repairId || null) === (mutation.repairId || null)
      )
        matches.push(node);
      else if (node.attributes?.title === title)
        throw bindingError(
          "STORAGE_BINDING_REVIEW_REQUIRED",
          "An existing OSF component has no matching experiment marker. Verify its identity explicitly.",
        );
    }
    url = result.links?.next || null;
  }
  if (matches.length > 1)
    throw bindingError(
      "STORAGE_BINDING_AMBIGUOUS",
      "Multiple OSF components identify this experiment. Review the original component.",
    );
  let id = matches[0]?.id;
  if (!id) {
    if (mutation.data.storagePreparation?.phase === "creating")
      throw bindingError(
        "STORAGE_BINDING_REVIEW_REQUIRED",
        "The previous OSF creation is uncertain. Inspect the original component ID before continuing.",
      );
    await mutation.update({
      storagePreparation: {
        ...mutation.data.storagePreparation,
        phase: "creating",
      },
    });
    await mutation.check();
    const result = await jsonRequest(
      `${endpoints.osf.apiBase}/v2/nodes/${encodeURIComponent(root)}/children/?region=us`,
      {
        token: client.token,
        method: "POST",
        body: {
          data: {
            type: "nodes",
            attributes: {
              title,
              category: "data",
              description: `ExpBuilder binding: ${JSON.stringify({ ...identityMarker(mutation.ref.id), ...(mutation.repairId && { repairId: mutation.repairId }) })}`,
              public: false,
            },
          },
        },
        code,
      },
    );
    id = scalarID(result.data?.id, code);
  }
  await mutation.update({
    storagePreparation: {
      ...mutation.data.storagePreparation,
      phase: "created",
      folderId: id,
    },
  });
  return { ...(await read(client.token, id)), rootFolderId: root };
}
