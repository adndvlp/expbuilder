import { bindingError, hash } from "./common.js";
import { bindingFingerprint, deploymentContext } from "./context.js";
import {
  storageClient,
  storageAdapters,
  inspectStorageTarget,
} from "./storage.js";
import {
  githubClient,
  verifyGithubBinding,
  inspectRepository,
  ensureRepositoryMarker,
} from "./github.js";
import { repositoryLocator } from "./review.js";
import { prepareGithubBinding } from "./prepare-github.js";
import { persistBindings, resourceClaims } from "./claims.js";

const bindingFor = (data, resource) =>
  resource === "storage" ? data.storageBinding : data.githubBinding;
const safeBinding = (binding, resource) =>
  Object.fromEntries(
    (resource === "storage"
      ? ["provider", "accountId", "folderId", "folderPath", "rootFolderId"]
      : [
          "repositoryId",
          "accountId",
          "ownerLogin",
          "repoName",
          "branch",
          "isPrivate",
        ]
    )
      .filter((key) => binding[key] !== undefined)
      .map((key) => [key, binding[key]]),
  );
async function repairClient(data, uid, resource) {
  if (!["storage", "github"].includes(resource))
    throw bindingError(
      "REPAIR_RESOURCE_INVALID",
      "Choose the data folder or GitHub repository to repair.",
      400,
    );
  if (data.deletionProgress)
    throw bindingError(
      "DELETION_RECOVERY_REQUIRED",
      "Finish the interrupted deletion before repairing destinations.",
    );
  const binding = bindingFor(data, resource);
  if (!binding)
    throw bindingError(
      "BINDING_REVIEW_REQUIRED",
      "Verify the original destination before repairing it.",
    );
  const client =
    resource === "storage"
      ? await storageClient(binding.provider, uid)
      : await githubClient(uid);
  if (client.accountId !== String(binding.accountId))
    throw bindingError(
      resource === "storage"
        ? "STORAGE_BINDING_UNAVAILABLE"
        : "GITHUB_BINDING_UNAVAILABLE",
      "Reconnect the linked account before repairing this destination. Changing accounts requires a separate migration.",
    );
  return client;
}
async function replacementTarget(data, client, resource, selection) {
  const preparation =
    data.destinationRepair?.[
      resource === "storage" ? "storagePreparation" : "githubPreparation"
    ];
  if (resource === "storage" && selection?.storageFolder) {
    if (
      preparation?.folderId &&
      preparation.folderId !== selection.storageFolder
    )
      throw bindingError(
        "BINDING_PREVIEW_STALE",
        "The prepared replacement has another folder identity.",
      );
    return inspectStorageTarget(
      { id: data.id, storageProvider: data.storageProvider },
      client,
      selection.storageFolder,
    );
  }
  if (resource === "github" && selection?.repository) {
    const locator = repositoryLocator(selection.repository);
    return inspectRepository(
      client,
      {
        ...locator,
        ...(preparation?.repositoryId && {
          repositoryId: preparation.repositoryId,
        }),
        preferPages: true,
      },
      data.id,
    );
  }
  return null;
}
export async function inspectRepair(data, uid, resource, selection = {}) {
  const client = await repairClient(data, uid, resource),
    previous = bindingFor(data, resource),
    contextFingerprint = bindingFingerprint(data);
  const job = data.destinationRepair;
  const pending =
    job?.status === "preparing" &&
    job.resource === resource &&
    job.contextFingerprint === contextFingerprint;
  if (job?.status === "preparing" && !pending)
    throw bindingError(
      "REPAIR_IN_PROGRESS",
      "Resume the pending repair before starting another one.",
    );
  if (!pending) {
    try {
      if (resource === "storage") await inspectStorageTarget(data, client);
      else await verifyGithubBinding(data, client);
    } catch (error) {
      if (
        error.status !== 409 ||
        (error.providerStatus !== undefined &&
          ![403, 404, 409].includes(error.providerStatus)) ||
        !["STORAGE_BINDING_UNAVAILABLE", "GITHUB_BINDING_UNAVAILABLE"].includes(
          error.code,
        )
      )
        throw error;
      const preview = {
        kind: "repair",
        resource,
        contextFingerprint,
        previous: safeBinding(previous, resource),
        accountId: client.accountId,
        accountLabel: client.accountLabel || client.login,
        selection: {},
      };
      preview.fingerprint = hash(preview);
      return { preview, client, replacement: null };
    }
    throw bindingError(
      "REPAIR_NOT_NEEDED",
      "The original destination is accessible. Retry publishing with that destination.",
    );
  }
  const replacement = await replacementTarget(
    data,
    client,
    resource,
    selection,
  );
  const preview = {
    ...job.preview,
    selection: replacement
      ? resource === "storage"
        ? { storageFolder: replacement.binding.folderId }
        : {
            repository: `${replacement.binding.ownerLogin}/${replacement.binding.repoName}`,
          }
      : {},
    ...(replacement && {
      replacement: safeBinding(replacement.binding, resource),
    }),
  };
  delete preview.fingerprint;
  preview.fingerprint = hash(preview);
  return { preview, client, replacement };
}
function repairMutation(mutation) {
  return {
    ref: mutation.ref,
    check: mutation.check,
    resourceKey: `${mutation.ref.id}-repair-${mutation.data.destinationRepair.id}`,
    repairId: mutation.data.destinationRepair.id,
    get data() {
      return {
        ...mutation.data,
        storagePreparation: mutation.data.destinationRepair.storagePreparation,
        githubPreparation: mutation.data.destinationRepair.githubPreparation,
      };
    },
    update: (patch) =>
      mutation.update({
        destinationRepair: { ...mutation.data.destinationRepair, ...patch },
      }),
  };
}
export async function confirmRepair(mutation, uid, body) {
  if (body.confirmReplacement !== true || body.acknowledgeDataLoss !== true)
    throw bindingError(
      "REPAIR_CONFIRMATION_REQUIRED",
      "Confirm the replacement and acknowledge that deleted files are not recovered.",
      400,
    );
  const data = { ...mutation.data, id: mutation.ref.id },
    job = data.destinationRepair;
  if (
    job?.status === "completed" &&
    job.confirmedFingerprint === body.fingerprint &&
    job.contextFingerprint === body.contextFingerprint &&
    job.resource === body.resource &&
    job.resultFingerprint === bindingFingerprint(data)
  )
    return {
      ...deploymentContext(data, data.id, uid),
      repairResult: job.result,
    };
  if (
    !body.contextFingerprint ||
    bindingFingerprint(data) !== body.contextFingerprint
  )
    throw bindingError(
      "BINDING_PREVIEW_STALE",
      "The destination changed. Inspect it again before repairing.",
    );
  const inspected = await inspectRepair(
    data,
    uid,
    body.resource,
    body.selection,
  );
  if (inspected.preview.fingerprint !== body.fingerprint)
    throw bindingError(
      "BINDING_PREVIEW_STALE",
      "The account or repair selection changed. Inspect it again.",
    );
  if (job?.status !== "preparing")
    await mutation.update({
      destinationRepair: {
        id: hash(`${body.resource}:${body.contextFingerprint}`).slice(0, 24),
        status: "preparing",
        resource: body.resource,
        contextFingerprint: body.contextFingerprint,
        preview: inspected.preview,
        startedAt: new Date().toISOString(),
      },
    });
  const scoped = repairMutation(mutation),
    resource = body.resource;
  let target = inspected.replacement;
  if (resource === "storage") {
    if (!scoped.data.storagePreparation)
      await scoped.update({
        storagePreparation: {
          provider: data.storageBinding.provider,
          accountId: inspected.client.accountId,
          phase: "planned",
          ...(data.storageBinding.rootFolderId && {
            rootFolderId: data.storageBinding.rootFolderId,
          }),
        },
      });
    if (!target) {
      const created = await storageAdapters[
        data.storageBinding.provider
      ].prepare(inspected.client, scoped);
      target = await inspectStorageTarget(
        {
          id: data.id,
          storageProvider: data.storageProvider,
          storageBinding: {
            provider: data.storageBinding.provider,
            accountId: inspected.client.accountId,
            folderId: created.folderId,
            ...(created.rootFolderId && { rootFolderId: created.rootFolderId }),
          },
        },
        inspected.client,
      );
    }
  } else {
    target =
      target ||
      (await prepareGithubBinding(scoped, inspected.client, {
        repoName: data.githubBinding.repoName,
        isPrivate: data.githubBinding.isPrivate !== false,
        description: `Replacement publication for experiment ${data.id}`,
      }));
    await persistBindings(mutation, {}, resourceClaims(null, target.binding));
    await ensureRepositoryMarker(inspected.client, target, data.id);
  }
  const previous = bindingFor(data, resource);
  if (
    String(
      resource === "storage"
        ? target.binding.folderId
        : target.binding.repositoryId,
    ) ===
    String(resource === "storage" ? previous.folderId : previous.repositoryId)
  )
    throw bindingError(
      "REPAIR_TARGET_INVALID",
      "The replacement must have a different resource identity.",
    );
  const patch =
    resource === "storage"
      ? {
          storageBinding: target.binding,
          ...target.projection,
          ...(!data.legacyStorageBinding && { legacyStorageBinding: previous }),
        }
      : { githubBinding: target.binding, pagesUrl: null };
  const result = {
    resource,
    requiresPublication: resource === "github",
    urlMayChange: resource === "github",
    previous: safeBinding(previous, resource),
    replacement: safeBinding(target.binding, resource),
  };
  const completed = {
    ...mutation.data.destinationRepair,
    status: "completed",
    confirmedFingerprint: body.fingerprint,
    result,
    completedAt: new Date().toISOString(),
    resultFingerprint: bindingFingerprint({ ...data, ...patch }),
  };
  await persistBindings(
    mutation,
    { ...patch, destinationRepair: completed },
    resourceClaims(
      resource === "storage" ? target.binding : null,
      resource === "github" ? target.binding : null,
    ),
    { repairId: scoped.repairId },
  );
  return {
    ...deploymentContext(mutation.data, data.id, uid),
    repairResult: result,
  };
}
