import { bindingError, hash } from "./common.js";
import { bindingFingerprint, deploymentContext } from "./context.js";
import { githubClient, inspectRepository } from "./github.js";
import {
  assertStorageProvider,
  storageClient,
  inspectStorageTarget,
} from "./storage.js";

export function repositoryLocator(value) {
  if (typeof value !== "string")
    throw bindingError(
      "GITHUB_SELECTION_REQUIRED",
      "Enter the URL or owner/name of the original GitHub repository.",
      400,
    );
  let path = value.trim();
  if (/^https?:\/\//.test(path)) {
    let url;
    try {
      url = new URL(path);
    } catch {
      throw bindingError(
        "GITHUB_SELECTION_INVALID",
        "Enter a valid GitHub repository URL.",
        400,
      );
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw bindingError(
        "GITHUB_SELECTION_INVALID",
        "Use a repository URL on github.com.",
        400,
      );
    path = url.pathname;
  }
  const parts = path
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/\.git$/, "")
    .split("/");
  if (
    parts.length !== 2 ||
    !/^[A-Za-z0-9-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(parts[1])
  )
    throw bindingError(
      "GITHUB_SELECTION_INVALID",
      "Enter the repository as owner/name.",
      400,
    );
  return { ownerLogin: parts[0], repoName: parts[1] };
}
export async function inspectBindings(data, uid, selection = {}) {
  const provider = assertStorageProvider(data),
    client = await storageClient(provider, uid);
  const expectedStorageAccount =
    data.storageBinding?.accountId || data.storagePreparation?.accountId;
  if (
    expectedStorageAccount &&
    client.accountId !== String(expectedStorageAccount)
  )
    throw bindingError(
      "STORAGE_BINDING_UNAVAILABLE",
      "Reconnect the linked data account before verifying its destinations.",
    );
  const storage = await inspectStorageTarget(
      data,
      client,
      selection.storageFolder,
    ),
    context = deploymentContext(data, data.id, uid);
  let github = null,
    githubAccount = null;
  if (context.github.state !== "new" || selection.repository) {
    githubAccount = await githubClient(uid);
    if (
      data.githubBinding &&
      githubAccount.accountId !== String(data.githubBinding.accountId)
    )
      throw bindingError(
        "GITHUB_BINDING_UNAVAILABLE",
        "Reconnect the linked GitHub account before verifying its repository.",
      );
    const preparation = data.githubPreparation;
    if (preparation && preparation.accountId !== githubAccount.accountId)
      throw bindingError(
        "GITHUB_BINDING_UNAVAILABLE",
        "Reconnect the GitHub account used to prepare this experiment.",
      );
    const locator = selection.repository
      ? repositoryLocator(selection.repository)
      : data.githubBinding || preparation;
    if (!locator)
      throw bindingError(
        "GITHUB_SELECTION_REQUIRED",
        "Select the original repository explicitly.",
        400,
      );
    github = await inspectRepository(
      githubAccount,
      {
        ...locator,
        ...((data.githubBinding?.repositoryId || preparation?.repositoryId) && {
          repositoryId:
            data.githubBinding?.repositoryId || preparation.repositoryId,
        }),
        branch: data.githubBinding?.branch || selection.branch,
        preferPages: true,
      },
      data.id,
    );
  }
  const preview = {
    contextFingerprint: bindingFingerprint(data),
    selection: {
      storageFolder: storage.binding.folderId,
      ...(github && {
        repository: `${github.binding.ownerLogin}/${github.binding.repoName}`,
        branch: github.binding.branch,
      }),
    },
    storage: {
      ...storage.binding,
      accountLabel: client.accountLabel,
      folderName: storage.label,
    },
    github: github?.binding || null,
  };
  preview.fingerprint = hash(preview);
  return { preview, storage, github, githubAccount };
}
