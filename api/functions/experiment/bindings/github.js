import { getGithubToken } from "../../oauth/providers/github/token.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../utils/provider-endpoints.js";
import {
  bindingError,
  checkMarker,
  identityMarker,
  jsonRequest,
  scalarID,
} from "./common.js";

const unavailable = "GITHUB_BINDING_UNAVAILABLE";
export const repositoryPath = (owner, name) =>
  `${endpoints.github.apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
export async function githubClient(uid) {
  const result = await getGithubToken(uid);
  if (!result.success || !result.access_token)
    throw bindingError(
      unavailable,
      "Connect the GitHub account linked to this experiment in Settings.",
    );
  const user = await jsonRequest(`${endpoints.github.apiBase}/user`, {
    token: result.access_token,
    code: unavailable,
  });
  if (typeof user.login !== "string" || !user.login)
    throw bindingError(
      unavailable,
      "GitHub account identity could not be verified.",
    );
  return {
    token: result.access_token,
    accountId: scalarID(user.id, unavailable),
    login: user.login,
  };
}
export async function readRepositoryMarker(client, repository, branch) {
  const data = await jsonRequest(
    `${repositoryPath(repository.owner.login, repository.name)}/contents/expbuilder-manifest.json?ref=${encodeURIComponent(branch)}`,
    { token: client.token, code: unavailable, allowMissing: true },
  );
  if (!data) return null;
  try {
    if (
      data.encoding !== "base64" ||
      typeof data.content !== "string" ||
      data.content.length > 128 * 1024
    )
      throw new Error();
    return {
      value: JSON.parse(Buffer.from(data.content, "base64").toString("utf8")),
      sha: data.sha,
    };
  } catch {
    throw bindingError(
      "GITHUB_MARKER_INVALID",
      "The repository marker could not be verified. Preserve it for review.",
    );
  }
}
export async function inspectRepository(client, locator, experimentID) {
  const repo = await jsonRequest(
    repositoryPath(locator.ownerLogin, locator.repoName),
    { token: client.token, code: unavailable },
  );
  const id = scalarID(repo.id, unavailable);
  if (locator.repositoryId && id !== String(locator.repositoryId))
    throw bindingError(
      unavailable,
      "The repository at this address has a different identity. The linked repository was not replaced.",
    );
  if (repo.permissions?.push !== true && repo.permissions?.admin !== true)
    throw bindingError(
      unavailable,
      "The connected GitHub account does not have write access to this repository.",
    );
  if (!repo.owner?.login || !repo.name)
    throw bindingError(unavailable, "Repository metadata is incomplete.");
  const pages = locator.preferPages
    ? await jsonRequest(
        `${repositoryPath(repo.owner.login, repo.name)}/pages`,
        { token: client.token, code: unavailable, allowMissing: true },
      )
    : null;
  if (pages?.build_type === "workflow")
    throw bindingError(
      unavailable,
      "This repository uses a custom Pages workflow. Its publication branch must be reviewed separately.",
    );
  if (pages?.source?.path && pages.source.path !== "/")
    throw bindingError(
      unavailable,
      "The Pages source directory changed. Review the original publication configuration before publishing.",
    );
  const branch = locator.branch || pages?.source?.branch || repo.default_branch;
  if (pages?.source?.branch && branch !== pages.source.branch)
    throw bindingError(
      unavailable,
      "Selecting a different publication branch requires a separate migration.",
    );
  if (typeof branch !== "string" || !branch)
    throw bindingError(
      unavailable,
      "The repository branch must be selected explicitly.",
    );
  await jsonRequest(
    `${repositoryPath(repo.owner.login, repo.name)}/branches/${encodeURIComponent(branch)}`,
    { token: client.token, code: unavailable },
  );
  const marker = await readRepositoryMarker(client, repo, branch);
  if (marker)
    checkMarker(marker.value, experimentID, "GITHUB_RESOURCE_CONFLICT");
  return {
    repository: repo,
    marker,
    binding: {
      repositoryId: id,
      accountId: client.accountId,
      accountLogin: client.login,
      ownerLogin: repo.owner.login,
      repoName: repo.name,
      branch,
      isPrivate: repo.private === true,
    },
  };
}
export async function verifyGithubBinding(data, client) {
  if (!data.githubBinding)
    throw bindingError(
      "GITHUB_BINDING_REQUIRED",
      "Verify and select this experiment's existing repository before publishing.",
    );
  if (client.accountId !== String(data.githubBinding.accountId))
    throw bindingError(
      unavailable,
      "Reconnect the GitHub account linked to this experiment. Its repository was not replaced.",
    );
  return inspectRepository(
    client,
    { ...data.githubBinding, preferPages: true },
    data.id,
  );
}
export async function ensureRepositoryMarker(client, inspected, experimentID) {
  if (inspected.marker) return;
  const { binding } = inspected;
  try {
    await jsonRequest(
      `${repositoryPath(binding.ownerLogin, binding.repoName)}/contents/expbuilder-manifest.json`,
      {
        token: client.token,
        method: "PUT",
        code: unavailable,
        body: {
          message: "Identify ExpBuilder experiment",
          branch: binding.branch,
          content: Buffer.from(
            JSON.stringify(identityMarker(experimentID)),
          ).toString("base64"),
        },
      },
    );
  } catch (error) {
    // Creating without a SHA cannot overwrite a marker installed concurrently.
    if (![409, 422].includes(error.providerStatus)) throw error;
    const current = await readRepositoryMarker(
      client,
      inspected.repository,
      binding.branch,
    );
    if (!current) throw error;
    checkMarker(current.value, experimentID, "GITHUB_RESOURCE_CONFLICT");
  }
}
