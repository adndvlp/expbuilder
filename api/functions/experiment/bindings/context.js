import { backendProjectId, hash } from "./common.js";
import { assertStorageProvider } from "./storage.js";

export function bindingFingerprint(data) {
  const fields = [
    "id",
    "owner",
    "storageProvider",
    "storageBinding",
    "githubBinding",
    "driveFolderId",
    "driveFolderPath",
    "dropboxFolder",
    "osfComponentId",
    "osfUploadLink",
    "storagePreparation",
    "githubPreparation",
  ];
  return hash({
    projectId: backendProjectId(),
    ...Object.fromEntries(
      fields
        .filter((field) => data[field] !== undefined)
        .map((field) => [field, data[field]]),
    ),
  });
}
export function deploymentContext(data, experimentID, uid) {
  const pick = (object, fields) =>
    Object.fromEntries(
      fields
        .filter((field) => object?.[field] !== undefined)
        .map((field) => [field, object[field]]),
    );
  const pending = data?.initialPublicationPending === true;
  const legacyStorage =
    data &&
    !data.storagePreparation &&
    (data.driveFolderId ||
      data.driveFolderPath ||
      data.dropboxFolder ||
      data.osfComponentId);
  const storageState = data?.storageBinding
    ? "bound"
    : pending && !legacyStorage && !data.storagePreparation?.requiresReview
      ? "new"
      : "needs_confirmation";
  const githubState = data?.githubBinding
    ? "bound"
    : pending && !data.githubPreparation?.requiresReview
      ? "new"
      : "needs_selection";
  return {
    success: true,
    exists: Boolean(data),
    projectId: backendProjectId(),
    experimentID,
    verifiedOwnerUid: uid,
    storage: data
      ? {
          state: storageState,
          provider: assertStorageProvider(data),
          ...(data.storageBinding && {
            binding: pick(data.storageBinding, [
              "provider",
              "accountId",
              "accountLabel",
              "folderId",
              "folderPath",
              "rootFolderId",
            ]),
          }),
        }
      : { state: "new" },
    ...(data?.destinationRepair?.status === "preparing" && {
      pendingRepair: {
        resource: data.destinationRepair.resource,
        ...(data.destinationRepair.githubPreparation?.ownerLogin &&
          data.destinationRepair.githubPreparation?.repoName && {
            suggestedRepository: `${data.destinationRepair.githubPreparation.ownerLogin}/${data.destinationRepair.githubPreparation.repoName}`,
          }),
        ...((data.destinationRepair.storagePreparation?.folderId ||
          data.destinationRepair.storagePreparation?.folderPath) && {
          suggestedFolder:
            data.destinationRepair.storagePreparation.folderId ||
            data.destinationRepair.storagePreparation.folderPath,
        }),
      },
    }),
    github: data
      ? {
          state: githubState,
          ...(data.githubPreparation?.requiresReview &&
            data.githubPreparation.ownerLogin &&
            data.githubPreparation.repoName && {
              suggestedRepository: `${data.githubPreparation.ownerLogin}/${data.githubPreparation.repoName}`,
            }),
          ...(data.githubBinding && {
            binding: pick(data.githubBinding, [
              "repositoryId",
              "accountId",
              "accountLogin",
              "ownerLogin",
              "repoName",
              "branch",
              "isPrivate",
            ]),
          }),
        }
      : { state: "new" },
  };
}
