import { bindingError, jsonRequest } from "./common.js";
import { storageAdapters, verifyStorageBinding } from "./storage.js";
import { githubClient, verifyGithubBinding, repositoryPath } from "./github.js";

export async function deleteBoundResources(mutation, uid) {
  const data = { ...mutation.data, id: mutation.ref.id };
  if (
    !data.githubBinding &&
    (data.initialPublicationPending !== true ||
      data.githubPreparation?.repositoryId ||
      data.githubPreparation?.phase === "creating" ||
      data.githubPreparation?.requiresReview)
  )
    throw bindingError(
      "GITHUB_BINDING_REQUIRED",
      "Verify the original repository from Publication destinations before deleting published resources.",
    );
  if (
    !data.storageBinding &&
    (data.driveFolderId ||
      data.driveFolderPath ||
      data.dropboxFolder ||
      data.osfComponentId ||
      data.storagePreparation?.folderId ||
      data.storagePreparation?.phase === "creating" ||
      data.storagePreparation?.requiresReview)
  )
    throw bindingError(
      "STORAGE_BINDING_REVIEW_REQUIRED",
      "Verify the original data folder from Publication destinations before deleting it.",
    );
  const progress = data.deletionProgress || {
    startedAt: new Date().toISOString(),
    storageId: data.storageBinding?.folderId || null,
    repositoryId: data.githubBinding?.repositoryId || null,
    storageDeleted: !data.storageBinding,
    repositoryDeleted: !data.githubBinding,
  };
  if (
    String(progress.storageId) !==
      String(data.storageBinding?.folderId || null) ||
    String(progress.repositoryId) !==
      String(data.githubBinding?.repositoryId || null)
  )
    throw bindingError(
      "DELETION_RECOVERY_REQUIRED",
      "The deletion targets changed. Preserve the experiment for recovery.",
    );
  const storage = progress.storageDeleted
    ? null
    : await verifyStorageBinding(data, uid);
  const github = progress.repositoryDeleted ? null : await githubClient(uid);
  const repository = github ? await verifyGithubBinding(data, github) : null;
  if (repository && repository.repository.permissions?.admin !== true)
    throw bindingError(
      "GITHUB_BINDING_UNAVAILABLE",
      "The linked GitHub account cannot delete this repository.",
    );
  if (
    storage &&
    storage.binding.provider !== "dropbox" &&
    storage.canDelete !== true
  )
    throw bindingError(
      "STORAGE_BINDING_UNAVAILABLE",
      "The linked account cannot delete this data folder.",
    );
  // Both targets are verified before the first deletion. Progress survives a partial failure.
  await mutation.update({ deletionProgress: progress });
  if (storage) {
    await mutation.check();
    await storageAdapters[storage.binding.provider].remove(
      storage.client.token,
      storage.binding,
    );
    progress.storageDeleted = true;
    await mutation.update({ deletionProgress: { ...progress } });
  }
  if (repository) {
    await mutation.check();
    await jsonRequest(
      repositoryPath(
        repository.binding.ownerLogin,
        repository.binding.repoName,
      ),
      {
        token: github.token,
        method: "DELETE",
        code: "GITHUB_BINDING_UNAVAILABLE",
      },
    );
    progress.repositoryDeleted = true;
    await mutation.update({ deletionProgress: { ...progress } });
  }
  return {
    folderDeleted: Boolean(data.storageBinding && progress.storageDeleted),
    repoDeleted: Boolean(data.githubBinding && progress.repositoryDeleted),
  };
}
