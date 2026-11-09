import { enableGithubPages } from "../hosting/services.js";

/**
 * Enable/verify GitHub Pages. Falls back to constructing the estimated URL
 * when the API call fails so the client still gets a usable link.
 *
 * @returns {Promise<string>} pages URL (always returns a URL)
 */
export async function enablePages(
  accessToken,
  owner,
  repoName,
  branch = "main",
) {
  console.log("Enabling/verifying GitHub Pages...");
  const enablePagesResult = await enableGithubPages(
    accessToken,
    owner,
    repoName,
    branch,
    "/",
  );

  if (enablePagesResult.success) {
    console.log("GitHub Pages is active:", enablePagesResult.pagesUrl);
    return enablePagesResult.pagesUrl;
  }

  const estimated = `https://${owner}.github.io/${repoName}/`;
  console.warn(
    "Could not verify GitHub Pages, using estimated URL:",
    estimated,
  );
  return estimated;
}
