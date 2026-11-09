import { PROVIDER_ENDPOINTS as endpoints } from "../../utils/provider-endpoints.js";
import { waitForGithubRepoReady } from "../hosting/services.js";
import { bindingError, hash, jsonRequest, scalarID } from "./common.js";
import { repositoryPath, inspectRepository } from "./github.js";

function repositoryName(name, id, index) {
  const suffix = hash(id).slice(0, 16),
    extra = index > 1 ? `-${index}` : "";
  const slug =
    String(name || "experiment")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "") || "experiment";
  return `${slug.slice(0, 100 - suffix.length - extra.length - 1)}-${suffix}${extra}`;
}
export async function prepareGithubBinding(
  mutation,
  client,
  { repoName, isPrivate = false, description = "" } = {},
) {
  let preparation = mutation.data.githubPreparation;
  if (preparation && preparation.accountId !== client.accountId)
    throw bindingError(
      "GITHUB_BINDING_UNAVAILABLE",
      "Reconnect the GitHub account used to prepare this repository.",
    );
  if (preparation?.repositoryId)
    return inspectRepository(client, preparation, mutation.ref.id);
  if (preparation?.requiresReview)
    throw bindingError(
      "GITHUB_BINDING_REVIEW_REQUIRED",
      "Repository creation was interrupted. Inspect and explicitly select that repository from Publication destinations.",
    );
  let index = preparation?.index || 1;
  while (index <= 5) {
    preparation = preparation || {
      accountId: client.accountId,
      ownerLogin: client.login,
      repoName: repositoryName(
        repoName,
        mutation.resourceKey || mutation.ref.id,
        index,
      ),
      index,
      phase: "planned",
    };
    await mutation.update({ githubPreparation: preparation });
    const existing = await jsonRequest(
      repositoryPath(preparation.ownerLogin, preparation.repoName),
      {
        token: client.token,
        allowMissing: true,
        code: "GITHUB_BINDING_UNAVAILABLE",
      },
    );
    if (existing) {
      if (preparation.phase === "creating") {
        await mutation.update({
          githubPreparation: { ...preparation, requiresReview: true },
        });
        throw bindingError(
          "GITHUB_BINDING_REVIEW_REQUIRED",
          "The repository may have been created by an interrupted request. Select it explicitly before continuing.",
        );
      }
      index++;
      preparation = null;
      continue;
    }
    preparation = { ...preparation, phase: "creating" };
    await mutation.update({ githubPreparation: preparation });
    await mutation.check();
    let repo;
    try {
      repo = await jsonRequest(`${endpoints.github.apiBase}/user/repos`, {
        token: client.token,
        method: "POST",
        code: "GITHUB_BINDING_UNAVAILABLE",
        body: {
          name: preparation.repoName,
          private: isPrivate,
          description,
          auto_init: true,
        },
      });
    } catch (error) {
      await mutation.update({
        githubPreparation: {
          ...preparation,
          ...(error.providerStatus && error.providerStatus < 500
            ? { phase: "planned" }
            : { requiresReview: true }),
        },
      });
      throw error;
    }
    preparation = {
      ...preparation,
      repositoryId: scalarID(repo.id, "GITHUB_BINDING_UNAVAILABLE"),
      ownerLogin: repo.owner?.login,
      repoName: repo.name,
      branch: repo.default_branch,
      phase: "created",
    };
    if (!preparation.ownerLogin || !preparation.repoName || !preparation.branch)
      throw bindingError(
        "GITHUB_BINDING_UNAVAILABLE",
        "GitHub returned incomplete repository metadata.",
      );
    await mutation.update({ githubPreparation: preparation });
    const ready = await waitForGithubRepoReady(
      client.token,
      preparation.ownerLogin,
      preparation.repoName,
      { branch: preparation.branch },
    );
    if (!ready.success)
      throw bindingError(
        "GITHUB_REPOSITORY_NOT_READY",
        "The reserved repository branch is not ready. Retry without creating another repository.",
        503,
      );
    return inspectRepository(client, preparation, mutation.ref.id);
  }
  throw bindingError(
    "GITHUB_NAME_COLLISION",
    "The new repository names are already in use. No existing repository was overwritten.",
  );
}
