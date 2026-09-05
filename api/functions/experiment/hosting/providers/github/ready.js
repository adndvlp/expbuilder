import fetch from "../../../../utils/fetch-with-timeout.js";
import { PROVIDER_ENDPOINTS as endpoints } from "../../../../utils/provider-endpoints.js";

export async function waitForGithubRepoReady(
  accessToken,
  owner,
  repoName,
  options = {},
) {
  const branch = options.branch ?? "main";
  const maxWaitMs = options.maxWaitMs ?? 30000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const r = await fetch(
      `${endpoints.github.apiBase}/repos/${owner}/${repoName}/branches/${branch}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );
    if (r.ok) {
      return { success: true, waitedMs: Date.now() - startTime };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    errorText: `Repo ${owner}/${repoName} branch ${branch} not ready after ${maxWaitMs}ms`,
  };
}
