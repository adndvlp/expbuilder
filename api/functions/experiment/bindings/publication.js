import { bindingError } from "./common.js";
import {
  githubClient,
  verifyGithubBinding,
  ensureRepositoryMarker,
} from "./github.js";
import { assertStorageProvider, verifyStorageBinding } from "./storage.js";
import { persistBindings, resourceClaims } from "./claims.js";
import { prepareStorageBinding } from "./prepare-storage.js";
import { prepareGithubBinding } from "./prepare-github.js";

export async function ensurePublicationBindings(
  mutation,
  uid,
  requestedProvider,
  repositoryOptions,
) {
  const data = { ...mutation.data, id: mutation.ref.id };
  if (data.deletionProgress)
    throw bindingError(
      "DELETION_RECOVERY_REQUIRED",
      "Retry the interrupted deletion before publishing this experiment again.",
    );
  if (data.destinationRepair?.status === "preparing")
    throw bindingError(
      "REPAIR_IN_PROGRESS",
      "Resume the pending destination repair before publishing.",
    );
  assertStorageProvider(data, requestedProvider);
  if (!data.githubBinding && data.initialPublicationPending !== true)
    throw bindingError(
      "GITHUB_BINDING_REQUIRED",
      "Select and verify the existing GitHub repository from Publication destinations before publishing.",
    );
  const storage = data.storageBinding
    ? await verifyStorageBinding(data, uid, requestedProvider)
    : await prepareStorageBinding(mutation, uid, requestedProvider);
  const github = await githubClient(uid);
  const repository = data.githubBinding
    ? await verifyGithubBinding(data, github)
    : await prepareGithubBinding(mutation, github, repositoryOptions);
  await mutation.check();
  const claims = resourceClaims(storage.binding, repository.binding);
  await persistBindings(mutation, {}, claims);
  await ensureRepositoryMarker(github, repository, data.id);
  await persistBindings(
    mutation,
    {
      storageBinding: storage.binding,
      storageProvider: storage.binding.provider,
      ...storage.projection,
      githubBinding: repository.binding,
    },
    claims,
  );
  return {
    storage: storage.binding,
    github: repository.binding,
    accessToken: github.token,
    repoExists: data.initialPublicationPending !== true,
  };
}
