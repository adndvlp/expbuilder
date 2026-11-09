import { bindingError } from "./common.js";
import {
  assertStorageProvider,
  storageClient,
  storageAdapters,
  inspectStorageTarget,
} from "./storage.js";
import { persistBindings, resourceClaims } from "./claims.js";

export async function prepareStorageBinding(mutation, uid, requested) {
  const data = mutation.data,
    provider = assertStorageProvider(data, requested);
  if (
    data.initialPublicationPending !== true ||
    (!data.storagePreparation &&
      (data.driveFolderId ||
        data.driveFolderPath ||
        data.dropboxFolder ||
        data.osfComponentId))
  )
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "Verify the original data folder before preparing this experiment again.",
    );
  const client = await storageClient(provider, uid);
  if (
    data.storagePreparation &&
    (data.storagePreparation.accountId !== client.accountId ||
      data.storagePreparation.provider !== provider)
  )
    throw bindingError(
      "STORAGE_BINDING_UNAVAILABLE",
      "Reconnect the account used to prepare this experiment. Its folder was not replaced.",
    );
  if (data.storagePreparation?.requiresReview)
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "The previous folder creation needs explicit verification before continuing.",
    );
  if (!data.storagePreparation)
    await mutation.update({
      storagePreparation: {
        provider,
        accountId: client.accountId,
        phase: "planned",
      },
    });
  const adapter = storageAdapters[provider];
  if (!adapter.prepare)
    throw bindingError(
      "STORAGE_BINDING_UNAVAILABLE",
      "This provider cannot prepare a verified destination.",
    );
  let target;
  try {
    target = await adapter.prepare(client, mutation);
  } catch (error) {
    if (
      ["STORAGE_BINDING_REVIEW_REQUIRED", "STORAGE_BINDING_AMBIGUOUS"].includes(
        error.code,
      ) ||
      (data.storagePreparation?.phase === "creating" &&
        !data.storagePreparation.folderId)
    )
      await mutation.update({
        storagePreparation: {
          ...data.storagePreparation,
          requiresReview: true,
        },
      });
    throw error;
  }
  const inspected = await inspectStorageTarget(
    {
      ...data,
      storageBinding: {
        provider,
        accountId: client.accountId,
        folderId: target.folderId,
        ...(target.rootFolderId && { rootFolderId: target.rootFolderId }),
      },
    },
    client,
  );
  await persistBindings(
    mutation,
    {
      storageProvider: provider,
      storageBinding: inspected.binding,
      ...inspected.projection,
      provisioningState: "ready",
    },
    resourceClaims(inspected.binding, null),
  );
  return { ...inspected, client };
}
